"""
Flow de Playwright para cargar facturas de ARRENDAMIENTO DE SOPORTES en FinnegansGO.

Proveedor: EDET S.A. (Empresa de Distribución Eléctrica de Tucumán S.A.)
Workflow FinnegansGO: "Compras - Productos & Insumos - Sin Asistente"

Flujo (resumen):
  1. Login + select empresa + abrir nueva factura
  2. Header
  3. Items → modal: producto + cantidad + precio + Dimensiones (centro de costos)
  4. Información Fiscal (CAE / tipo / vto.)
  5. Retenciones / Percepciones (cada una con fecha = fecha_vencimiento)
  6. Total de Control (= monto_total)
  7. Si |Total - Total de Control| < 1 → agregar item de ajuste
  8. Guardar como borrador + Adjuntar PDF
"""

from __future__ import annotations

import re
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

from agent.flows.base import (
    WORKFLOW_DEFAULT,
    ControlTotalMismatchError,
    DuplicateComprobanteError,
    EmpresaSelectionError,
    FinnegansSession,
    _log,
)
from agent.knowledge_base import (
    lookup_centro_costos,
    lookup_centro_costos_by_company_id,
    lookup_centro_costos_by_empresa,
    lookup_company,
    lookup_nombre_finnegans,
    resolve_empresa_finnegans,
)


def _resolve_centro_costos(numero_servicio, empresa_finnegans, datos=None) -> str:
    """Centro de costos a usar para esta factura.
    1) match por NUM_SERVICIO (Excel)
    2) default por EMPRESA PROPIA (company id resuelto desde el cliente del PDF).
       Es robusto aunque se fuerce una empresa sandbox ('Prueba') vía override,
       porque usa el cliente real de `datos`, no el nombre seleccionado en Finnegans.
    3) fallback legacy por nombre de empresa destino en Finnegans.
    4) string vacío → primer resultado del autocomplete.

    Loguea cuál ramita matchó para que el run output sea autoexplicativo.
    """
    cc = lookup_centro_costos(numero_servicio)
    if cc:
        _log(f"Centro de Costos via NUM_SERVICIO={numero_servicio} → {cc!r}")
        return cc
    # 2) por company id del cliente del PDF (robusto a override sandbox).
    if datos:
        company = lookup_company(
            cuit=datos.get("cuit_cliente"), nombre=datos.get("cliente")
        )
        if company:
            cc = lookup_centro_costos_by_company_id(company.get("id"))
            if cc:
                _log(
                    f"Centro de Costos via company id ({company.get('id')!r}, "
                    f"cliente={datos.get('cliente')!r}) → {cc!r}"
                )
                return cc
    cc = lookup_centro_costos_by_empresa(empresa_finnegans)
    if cc:
        _log(f"Centro de Costos via empresa default ({empresa_finnegans!r}) → {cc!r}")
        return cc
    _log(
        f"⚠️ Centro de Costos NO mapeado (NUM_SERVICIO={numero_servicio!r}, "
        f"empresa={empresa_finnegans!r}, cliente={(datos or {}).get('cliente')!r}); "
        f"se va a elegir el primer resultado del autocomplete (revisar el mapeo)."
    )
    return ""

# Términos de búsqueda para los campos selector (el flow elige siempre el primer
# resultado del autocomplete). Si el primer resultado no es el esperado, ajustar acá.
SEARCH_EDET = "EDET"
SEARCH_PRODUCTO_SOPORTES = "ARRENDAMIENTO DE SOPORTES"
# Para el item de ajuste (caso diferencia < $1):
SEARCH_PRODUCTO_AJUSTE = "Servicio Energia Fuente/ Oficina No Gravado"
SEARCH_PROVINCIA = "Tucuman"
SEARCH_PERCEPCION_IIBB_TIPO = "Percepción de II.BB. Tucuman"
SEARCH_PERCEPCION_IIBB_RET = "Percepción de II.BB. Tucuman"
SEARCH_PERCEPCION_IVA_TIPO = "Percepción de IVA"
SEARCH_PERCEPCION_IVA_RET = "Percepción 3%"

# Tipo de comprobante (letra) → término de búsqueda en "Comprobante Tipo Impositivo".
_TIPO_IMPOSITIVO_SEARCH = {
    "A": "001",   # → 001-Factura Electrónica A
}

# Tolerancia (inclusiva) para considerar un ajuste de redondeo (en $).
# Una diferencia de hasta $1.00 (inclusive) se ajusta automáticamente.
AJUSTE_THRESHOLD = 1.0


# ----------------------------------------------------------------------
# Helpers de datos
# ----------------------------------------------------------------------

def _letra_comprobante(tipo: str) -> str:
    if not tipo:
        return ""
    t = str(tipo).strip().upper()
    m = re.search(r"\b([A-Z])\b", t)
    return m.group(1) if m else (t[-1] if t else "")


def _tipo_impositivo_search(tipo_comprobante: str) -> Optional[str]:
    letra = _letra_comprobante(tipo_comprobante)
    val = _TIPO_IMPOSITIVO_SEARCH.get(letra)
    if not val:
        _log(
            f"tipo_comprobante {tipo_comprobante!r} (letra {letra!r}) sin mapeo de "
            f"'Comprobante Tipo Impositivo' — se omite ese campo"
        )
    return val


def _compute_fecha_registro(fecha_emision: str) -> date:
    """Fecha de registro: hoy, salvo que la emisión sea del mes anterior
    (en cuyo caso = último día del mes anterior)."""
    emis = date.fromisoformat(str(fecha_emision)[:10])
    today = date.today()
    if (emis.year, emis.month) < (today.year, today.month):
        return today.replace(day=1) - timedelta(days=1)
    return today


_NRO_COMPROBANTE_RE = re.compile(r"^[A-Z]-\d{5}-\d{8}$")


def _nro_comprobante_mascara(letra: str, numero_factura: str) -> str:
    """Arma el Nro. Comprobante en formato máscara EXACTO: {letra}-{pv:5}-{num:8}.

    ⚠️ La máscara de Finnegans (A-_____-________) **solo acepta** 5+8 dígitos.
    Si se envía PV con menos de 5 dígitos, Finnegans rellena con un '0' a la
    DERECHA del PV (no izquierda) y desplaza el resto → corrupción silenciosa
    del número (ej. enviar 'A-0097-72565816' termina como 'A-00970-02565816').
    Verificado vía MCP de Playwright contra el formulario real.

    Esta función SIEMPRE produce el formato canónico 5+8 con padding de ceros
    a la izquierda. El llamador puede usar `_validar_nro_comprobante()` o el
    parámetro `verify=True` de `set_text` para asegurar que se envía bien."""
    nf = (numero_factura or "").strip()
    if not nf:
        return letra or ""
    if "-" in nf:
        parts = nf.split("-")
        pv_raw = re.sub(r"\D", "", parts[0])
        num_raw = re.sub(r"\D", "", parts[-1])
    else:
        digits = re.sub(r"\D", "", nf)
        num_raw = digits[-8:]
        pv_raw = digits[:-8]
    pv = pv_raw[-5:].zfill(5)
    num = num_raw[-8:].zfill(8)
    return f"{letra}-{pv}-{num}"


def _validar_nro_comprobante(value: str) -> None:
    """Valida que el Nro. Comprobante esté en formato EXACTO 'X-NNNNN-NNNNNNNN'.
    Lanza ValueError si no. Llamar antes de mandarlo a Finnegans."""
    if not _NRO_COMPROBANTE_RE.match(value or ""):
        raise ValueError(
            f"Nro. Comprobante {value!r} no coincide con el formato esperado "
            f"'LETRA-PV(5)-NUM(8)'. Esto corrompería el campo en Finnegans."
        )


def _fmt_importe(value) -> str:
    if value is None or value == "":
        return ""
    return f"{float(value):.2f}"


def _search_cliente(cliente: str) -> str:
    """Texto a TIPEAR en el autocomplete del Destinatario.

    Pasos:
      1) Si existe un alias mapeado al nombre EXACTO de FinnegansGO
         (agent/knowledge/empresas_finnegans.json), usar ese nombre como base.
      2) Quitar puntos, colapsar espacios y eliminar el sufijo legal típico
         al final (S A / SAS / SRL / etc.) para ensanchar la búsqueda.

    Esto es lo que se TIPEA. La fila concreta a clickear se decide con
    `_expected_cliente()` (ver abajo).
    """
    if not cliente:
        return ""
    finnegans = lookup_nombre_finnegans(cliente)
    base = finnegans if finnegans else cliente
    s = re.sub(r"\.", "", str(base))
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(
        r"\s+(S\s*A\s*S|S\s*R\s*L|S\s*C\s*A|S\s*A|SAS|SRL|SA|SCA)\s*$",
        "",
        s,
        flags=re.IGNORECASE,
    )
    return s.strip()


def _expected_cliente(cliente: str) -> Optional[str]:
    """Nombre EXACTO de la fila a elegir en el dropdown del Destinatario.

    Si hay alias en `empresas_finnegans.json` → ese es el nombre canónico
    (ej. cliente='INTER SAS' → alias='INTER SAS', cliente='PROVIDERS SA' →
    alias='PROVIDERS S.A.'). Si no hay alias, devuelve el nombre crudo del
    PDF (que el autocomplete suele matchear bien).

    Si `expected` es None, set_selector cae al comportamiento legacy
    (primera fila), que es OK para casos sin ambigüedad.
    """
    if not cliente:
        return None
    finnegans = lookup_nombre_finnegans(cliente)
    return finnegans or cliente


# ----------------------------------------------------------------------
# Helper de carga de item con Dimensión (centro de costos)
# ----------------------------------------------------------------------

async def _agregar_item_con_dimension(
    s: FinnegansSession,
    producto_search: str,
    cantidad,
    precio,
    centro_costos_search: str = "",
):
    """Abre el modal '+', completa General y Dimensiones, y acepta.

    Si `centro_costos_search` está vacío, se usa el primer resultado disponible
    (modo "no tengo mapeo todavía").
    """
    await s.grid_add_row()
    # --- General ---
    await s.set_selector("wdg_Producto", producto_search)
    if cantidad is not None:
        await s.set_text_keyboard("wdg_CantidadWorkflow", str(cantidad))
    if precio is not None:
        await s.set_text_keyboard("wdg_Precio", _fmt_importe(precio))
    # --- Dimensiones (centro de costos en fila 0) ---
    # Espera explícita antes de abrir Dimensiones: tras seleccionar el producto,
    # Finnegans carga asincrónicamente la configuración de dimensiones desde el
    # servidor. Si se hace click en el subtab 'Dimensiones' antes de que termine,
    # el tab aparece vacío y se cae en 'no-input-dimension'. Mismo patrón que
    # gire.py / sepsa.py. 3 s alcanza en condiciones normales.
    await s.frame.wait_for_timeout(3000)
    await s.click_modal_subtab("Dimensiones")
    await s.set_dimension_centro_costos(row=0, search=centro_costos_search)
    # --- Aceptar ---
    await s.modal_aceptar()


# ----------------------------------------------------------------------
# Flow principal
# ----------------------------------------------------------------------

async def cargar_arrendamiento_soportes(
    datos: dict,
    pdf_path: Optional[Path] = None,
    empresa: Optional[str] = None,
    session: Optional[FinnegansSession] = None,
) -> dict:
    """Carga una factura de arrendamiento de soportes en FinnegansGO.

    Args:
        datos: dict del extractor (FacturaSoportes.model_dump()) con _estado='listo'.
        pdf_path: ruta al PDF original. Si se provee, se guarda la factura como
            borrador y se adjunta el PDF. Si es None, no se guarda.
        empresa: empresa destino en FinnegansGO. Si es None (default), se
            auto-detecta a partir de `numero_servicio` → `empresa pagadora`
            del Excel → nombre exacto en Finnegans (alias). Pasar un nombre
            explícito (ej. 'Prueba') para forzar — útil para testing.
        session: si se provee, se reutiliza esa session (modo batch: caller
            ya hizo login). Si es None se abre una nueva.
    """
    if datos.get("_estado") != "listo":
        return {
            "exito": False,
            "mensaje": f"Estado del documento no es 'listo': {datos.get('_estado')}",
            "nro_interno": None,
        }

    numero_factura = datos.get("numero_factura", "")
    tipo_comprobante = datos.get("tipo_comprobante", "")
    letra = _letra_comprobante(tipo_comprobante)
    nro_comprobante = _nro_comprobante_mascara(letra, numero_factura)

    # ─── Resolver empresa destino en FinnegansGO ───
    # Si el caller pasó un nombre explícito, se respeta. Sino: auto-detect con
    # cross-check NS↔cliente (ver knowledge_base.resolve_empresa_finnegans).
    if empresa:
        empresa_finnegans = empresa
        _log(f"Empresa: override del caller → {empresa_finnegans!r}")
    else:
        empresa_finnegans = resolve_empresa_finnegans(datos, log=_log)
        if not empresa_finnegans:
            return {
                "exito": False,
                "mensaje": (
                    f"No se pudo resolver la empresa destino. NUM_SERVICIO="
                    f"{datos.get('numero_servicio')!r}, cliente="
                    f"{datos.get('cliente')!r}, cuit_cliente="
                    f"{datos.get('cuit_cliente')!r}. Revisar centros_costo.json, "
                    f"empresas_finnegans.json y companies/. Pasar --empresa NOMBRE "
                    f"explícito para forzar."
                ),
                "nro_interno": None,
            }

    # Centro de costos: NS → company id (cliente del PDF) → empresa default →
    # vacío (primer resultado). Se pasa `datos` para resolver por cliente real
    # aunque haya override de empresa sandbox.
    numero_servicio = datos.get("numero_servicio")
    centro_costos_search = _resolve_centro_costos(
        numero_servicio, empresa_finnegans, datos=datos
    )

    # Log de los campos clave que el extractor debería haber rellenado.
    # Si alguno es None / 0, va a hacer fallar partes del flow más adelante.
    _log("--- Datos clave del extractor ---")
    for k in (
        "numero_factura", "tipo_comprobante", "numero_servicio",
        "cliente", "fecha_emision", "fecha_vencimiento", "concepto",
        "subtotal_gravado", "percepcion_ib_3_5_pct", "percepcion_rg3337",
        "monto_total", "cae", "fecha_vencimiento_cae",
    ):
        _log(f"  {k} = {datos.get(k)!r}")
    if datos.get("monto_total") in (None, 0, 0.0):
        _log("AVISO: monto_total vacío o 0 → no se va a setear el Total de Control")

    async def _work(s: FinnegansSession) -> dict:
        """El trabajo real. Asume que `s` ya hizo login.
        select_empresa se hace acá adentro para que también funcione en batch
        cuando facturas consecutivas tienen empresas distintas."""
        await s.select_empresa(empresa_finnegans)
        await s.goto_facturas()
        await s.open_nueva_factura(WORKFLOW_DEFAULT)

        # ====================== HEADER ======================
        await s.set_selector("wdg_Organizacion", SEARCH_EDET)

        if await s.wait_field_enabled("wdg_NumeroDocumento"):
            _validar_nro_comprobante(nro_comprobante)
            # verify=True → set_text leerá el valor de vuelta y abortará si
            # Finnegans lo corrompió (ver doc de _nro_comprobante_mascara).
            await s.set_text("wdg_NumeroDocumento", nro_comprobante, verify=True)
        else:
            _log("wdg_NumeroDocumento sigue disabled — no se cargó Nro. Comprobante")

        await s.set_fecha("wdg_Fecha", _compute_fecha_registro(datos["fecha_emision"]))
        await s.set_fecha(
            "wdg_FechaComprobante",
            date.fromisoformat(str(datos["fecha_emision"])[:10]),
        )

        await s.set_selector("wdg_ProvinciaOrigen", SEARCH_PROVINCIA)
        await s.set_selector("wdg_ProvinciaDestino", SEARCH_PROVINCIA)
        cliente_raw = datos.get("cliente", "")
        cliente_search = _search_cliente(cliente_raw)
        cliente_expected = _expected_cliente(cliente_raw)
        if cliente_search:
            await s.set_selector(
                "wdg_OrganizacionOrigen",
                cliente_search,
                expected=cliente_expected,
            )
        await s.set_text("wdg_Descripcion", datos.get("concepto", ""))
        await s.screenshot("header_completo")

        # ====================== ITEMS ======================
        subtotal = datos.get("subtotal_gravado")
        await s.click_tab("Items")
        await _agregar_item_con_dimension(
            s,
            producto_search=SEARCH_PRODUCTO_SOPORTES,
            cantidad=1,
            precio=subtotal,
            centro_costos_search=centro_costos_search,
        )

        # ====================== INFORMACIÓN FISCAL ======================
        await s.click_tab("Información Fiscal")
        tipo_imp_search = _tipo_impositivo_search(tipo_comprobante)
        if tipo_imp_search:
            await s.set_selector("wdg_comprobanteTipoImpositivo", tipo_imp_search)
        if datos.get("cae"):
            await s.set_text("wdg_cai", datos["cae"])
        if datos.get("fecha_vencimiento_cae"):
            await s.set_fecha(
                "wdg_caiFechaVto",
                date.fromisoformat(str(datos["fecha_vencimiento_cae"])[:10]),
            )

        # ====================== RETENCIONES / PERCEPCIONES ======================
        # Fecha de la percepción/retención = FECHA DE REGISTRO contable (la misma
        # que wdg_Fecha). NO se usa el vencimiento del CAE: para facturas de fin de
        # mes ese vencimiento cae en el mes siguiente y registraría la percepción en
        # el período equivocado (p.ej. una factura de junio quedaría en julio).
        fecha_registro = _compute_fecha_registro(datos["fecha_emision"])
        fecha_venc = fecha_registro

        await s.click_tab("Retenciones / Percepciones")

        perc_iibb = float(datos.get("percepcion_ib_3_5_pct") or 0)
        if perc_iibb > 0:
            await s.grid_add_row()
            await s.set_selector("wdg_TipoRetencion", SEARCH_PERCEPCION_IIBB_TIPO)
            await s.set_selector("wdg_Retencion", SEARCH_PERCEPCION_IIBB_RET)
            await s.set_text_keyboard("wdg_ImporteRetencion", _fmt_importe(perc_iibb))
            if fecha_venc:
                await s.set_fecha("wdg_FechaRetencion", fecha_venc)
            await s.modal_aceptar()
        else:
            _log("percepcion_ib_3_5_pct = 0 / None → se omite la Percepción II.BB.")

        perc_iva = float(datos.get("percepcion_rg3337") or 0)
        if perc_iva > 0:
            await s.grid_add_row()
            await s.set_selector("wdg_TipoRetencion", SEARCH_PERCEPCION_IVA_TIPO)
            await s.set_selector("wdg_Retencion", SEARCH_PERCEPCION_IVA_RET)
            await s.set_text_keyboard("wdg_ImporteRetencion", _fmt_importe(perc_iva))
            if fecha_venc:
                await s.set_fecha("wdg_FechaRetencion", fecha_venc)
            await s.modal_aceptar()
        else:
            _log("percepcion_rg3337 = 0 / None → se omite la Percepción de IVA")

        # ====================== TOTAL DE CONTROL + AJUSTE ======================
        monto_total = datos.get("monto_total")
        if monto_total is not None:
            await s.set_text("wdg_ImporteControl", _fmt_importe(monto_total))
            await s.frame.wait_for_timeout(1500)
            total_calc = await s.get_total_calculado()
            diff = float(monto_total) - total_calc
            _log(
                f"Total calculado={total_calc:.2f}  "
                f"Total de control={float(monto_total):.2f}  diff={diff:+.2f}"
            )
            if abs(diff) < 0.005:
                _log("Total = Total de Control → no hace falta ajuste")
            elif 0 < abs(diff) <= AJUSTE_THRESHOLD:
                _log(f"diferencia <= ${AJUSTE_THRESHOLD} → agregando item de ajuste por {diff:+.4f}")
                await s.click_tab("Items")
                await _agregar_item_con_dimension(
                    s,
                    producto_search=SEARCH_PRODUCTO_AJUSTE,
                    cantidad=1,
                    precio=diff,
                    centro_costos_search=centro_costos_search,
                )
                # verificación post-ajuste
                await s.frame.wait_for_timeout(1500)
                total_calc2 = await s.get_total_calculado()
                _log(
                    f"Post-ajuste Total={total_calc2:.2f} "
                    f"(diff vs control: {float(monto_total)-total_calc2:+.4f})"
                )
            else:
                _log("=" * 70)
                _log(
                    f"⚠️ ATENCIÓN: diferencia de ${abs(diff):,.2f} entre Total ({total_calc:,.2f}) "
                    f"y Total de Control ({float(monto_total):,.2f})."
                )
                _log("   Supera el umbral de $1 → NO se agrega ajuste automático.")
                _log("   Probablemente el LLM extrajo mal algún importe. REVISAR antes de guardar.")
                _log("   Se ABORTA antes de guardar para no dejar un borrador huérfano en Finnegans.")
                _log("=" * 70)
                await s.screenshot("control_mismatch_preflight")
                return {
                    "exito": False,
                    "estado": "revision",
                    "mensaje": (
                        f"Factura {numero_factura}: descuadre de importe de control "
                        f"en Finnegans (Total {total_calc:.2f} vs control "
                        f"{float(monto_total):.2f}, dif {diff:+.2f})."
                    ),
                    "nro_interno": None,
                }

        await s.dump_diag("soportes")
        await s.screenshot("antes_de_guardar")

        # ====================== GUARDAR (borrador) + ADJUNTAR ======================
        estado_guardado = "sin guardar"
        nro_interno = None
        if pdf_path:
            guardado_ok = False
            adjuntado_ok = False
            try:
                nro_interno = await s.save_draft()
                guardado_ok = True
            except DuplicateComprobanteError as dup_exc:
                _log(f"Comprobante ya existe en Finnegans: {dup_exc}. No se crea duplicado.")
                return {
                    "exito": True,
                    "mensaje": (
                        f"Factura {numero_factura}: "
                        "ya existe en Finnegans, no se creó duplicado."
                    ),
                    "nro_interno": None,
                }
            except ControlTotalMismatchError as exc:
                await s.screenshot("control_mismatch")
                _log(f"Descuadre de importe de control: {exc}. Marcando para revisión.")
                return {
                    "exito": False,
                    "estado": "revision",
                    "mensaje": (
                        f"Factura {numero_factura}: descuadre de importe "
                        f"de control en Finnegans ({exc})."
                    ),
                    "nro_interno": None,
                }
            except Exception as exc:
                _log(f"AVISO: falló save_draft ({exc}). El form queda lleno.")
            if guardado_ok:
                try:
                    await s.attach_pdf(pdf_path)
                    adjuntado_ok = True
                    await s.screenshot("post_adjuntar")
                except Exception as exc:
                    _log(f"AVISO: falló attach_pdf ({exc}). Adjuntar manualmente.")
            if guardado_ok and adjuntado_ok:
                estado_guardado = "guardada como borrador + PDF adjuntado"
            elif guardado_ok:
                estado_guardado = "guardada como borrador (PDF NO adjuntado)"
            else:
                estado_guardado = "NO se pudo guardar (form lleno para inspección)"
                return {
                    "exito": False,
                    "mensaje": f"Factura {numero_factura}: {estado_guardado}.",
                    "nro_interno": None,
                }
        else:
            _log("pdf_path no provisto → no se guarda ni se adjunta")

        return {
            "exito": True,
            "mensaje": f"Factura {numero_factura}: {estado_guardado}.",
            "nro_interno": nro_interno,
        }

    # ----------------------------------------------------------------------
    # Dispatcher: usar session provista (batch) o abrir una nueva (single-shot)
    # ----------------------------------------------------------------------
    try:
        if session is not None:
            # batch: el caller solo maneja login + cierre. select_empresa lo
            # hace _work (porque puede variar entre facturas).
            return await _work(session)
        # single-shot: abrir nuestra propia session
        async with FinnegansSession(empresa=empresa_finnegans, keep_open=True) as s:
            return await _work(s)
    except EmpresaSelectionError as exc:
        return {
            "exito": False,
            "estado": "revision",
            "mensaje": (
                f"Soportes: no se pudo seleccionar la empresa destino "
                f"{empresa_finnegans!r} en Finnegans ({exc}). Se aborta para no "
                "cargarla en la empresa equivocada."
            ),
            "nro_interno": None,
        }
    except Exception as exc:
        return {
            "exito": False,
            "mensaje": f"Error al cargar factura de soportes: {exc}",
            "nro_interno": None,
        }
