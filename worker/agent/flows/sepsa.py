"""Flow de carga para facturas SEPSA (Servicio Electrónico de Pago S.A. / PagoFácil).

A diferencia del flow GIRE (recaudacion.py) que parsea el PDF para detectar
jurisdicciones IIBB, este flow lee directamente la lista `percepciones_iibb`
extraída por el LLM desde el schema FacturaSEPSA.  Esto permite un manejo
preciso de percepciones multi-provincia sin depender del regex del texto del PDF.

Estructura esperada de un FacturaSEPSA:
  subtotal_gravado   = neto gravado (base del IVA 21 %)
  iva_21             = I.V.A. 21 % (lo calcula Finnegans; se extrae solo para
                       validación cruzada)
  percepciones_iibb  = lista de {provincia, alicuota_pct, importe} – una por
                       fila de la tabla "Otros Tributos".  Puede ser vacía.
  total_tributos     = suma de percepciones_iibb (pie de tabla, NO es una fila)
  monto_total        = total a pagar = subtotal + iva_21 + total_tributos
"""
from __future__ import annotations

from datetime import date
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
from agent.flows.gire import (
    EXPECTED_PRODUCTO_RECAUDACION,
    SEARCH_CENTRO_COSTOS_RECAUDACION,
    SEARCH_RET_IVA,
    SEARCH_TIPO_PERCEP_IIBB,
    SEARCH_TIPO_PERCEP_IVA,
    _agregar_item_recaudacion,
    _aplicar_ajuste_decimal,
    _has_value,
    _tipo_iibb_expected,
)
from agent.flows.soportes import (
    _compute_fecha_registro,
    _expected_cliente,
    _fmt_importe,
    _letra_comprobante,
    _nro_comprobante_mascara,
    _search_cliente,
    _tipo_impositivo_search,
    _validar_nro_comprobante,
)
from agent.knowledge_base import resolve_empresa_finnegans

# ── Mapeo provincia PDF → búsqueda/expected en Finnegans ─────────────────────
# Cada entrada: (clave_lower, search_ret, expected_ret)
# search_ret   → valor que se tipea en wdg_Retencion para filtrar la lista
# expected_ret → texto EXACTO que debe quedar seleccionado en wdg_Retencion
#
# Lista de wdg_TipoRetencion verificada en Finnegans 2026-05-28 via Playwright:
#   17 opciones: CABA (Padrón), Catamarca, Chaco, Cordoba, Corrientes,
#   Formosa, Jujuy, La Pampa, Mendoza, Misiones, Neuquen, Rio Negro,
#   Salta, San Luis, Santa Fe, Santiago del Estero, Tucuman.
#
# IMPORTANTE: "Entre Ríos", "San Juan", "La Rioja", "Santa Cruz", "Chubut"
# y "Tierra del Fuego" NO existen en Finnegans — si aparecen en un PDF
# se loguea un aviso y se usa el nombre tal cual (posible falla en selector).
#
# expected_ret ≠ wdg_TipoRetencion. Ej. para Santa Fe:
#   TipoRetencion = "Percepción de II.BB. Santa Fe"
#   Retencion     = "Percepcion IIBB Santa Fe Sufridas"
_PROV_MAP: list[tuple[str, str, str]] = [
    ("tucum",        "Tucuman",                         "Percepción de II.BB. Tucuman"),
    ("santa fe",     "Santa Fe",                        "Percepcion IIBB Santa Fe Sufridas"),
    ("buenos aires", "Ciudad Autonoma de Buenos Aires", "Percepción de II.BB. Ciudad Autónoma de Buenos Aires"),
    ("capital fed",  "Ciudad Autonoma de Buenos Aires", "Percepción de II.BB. Ciudad Autónoma de Buenos Aires"),
    ("caba",         "Ciudad Autonoma de Buenos Aires", "Percepción de II.BB. Ciudad Autónoma de Buenos Aires"),
    ("salta",        "Salta",                           "Percepción IIBB salta"),
    ("cordoba",      "Cordoba",                         "Percepción de II.BB. Cordoba"),
    ("corrientes",   "Corrientes",                      "Percepción de II.BB. Corrientes"),
    ("mendoza",      "Mendoza",                         "Percepción de II.BB. Mendoza"),
    ("misiones",     "Misiones",                        "Percepción de II.BB. Misiones"),
    ("jujuy",        "Jujuy",                           "Percepción de II.BB. Jujuy"),
    ("catamarca",    "Catamarca",                       "Percepción de II.BB. Catamarca"),
    ("chaco",        "Chaco",                           "Percepción de II.BB. Chaco"),
    ("formosa",      "Formosa",                         "Percepción de II.BB. Formosa"),
    ("la pampa",     "La Pampa",                        "Percepción de II.BB. La Pampa"),
    ("neuquen",      "Neuquen",                         "Percepción de II.BB. Neuquen"),
    ("rio negro",    "Rio Negro",                       "Percepción de II.BB. Rio Negro"),
    ("san luis",     "San Luis",                        "Percepción de II.BB. San Luis"),
    ("santiago",     "Santiago del Estero",             "Percepción de II.BB. Santiago del Estero"),
]


def _map_provincia(provincia_raw: str) -> tuple[str, str]:
    """Mapea el nombre de provincia del PDF al (search_ret, expected_ret) de Finnegans."""
    prov_lower = (provincia_raw or "").lower().strip()
    for key, search_ret, expected_ret in _PROV_MAP:
        if key in prov_lower:
            return search_ret, expected_ret
    # Provincia no mapeada: loguear y usar tal cual
    prov_title = provincia_raw.strip().title()
    _log(f"AVISO: provincia SEPSA no mapeada: {prov_title!r} — se usará el nombre como está.")
    return prov_title, f"Percepción de II.BB. {prov_title}"


async def _cargar_percepcion_iibb_sepsa(
    s: FinnegansSession,
    search_ret: str,
    expected_ret: Optional[str],
    importe: float,
    fecha_venc: Optional[date],
) -> None:
    """Agrega una fila de percepción IIBB en la grilla de Retenciones / Percepciones."""
    expected_tipo = _tipo_iibb_expected(search_ret, expected_ret)
    is_caba = "BUENOS AIRES" in (expected_ret or "").upper()

    await s.grid_add_row()
    await s.set_selector(
        "wdg_TipoRetencion",
        SEARCH_TIPO_PERCEP_IIBB,
        expected=expected_tipo,
    )
    if is_caba:
        # CABA: el selector de Retención trae una sola opción al abrir.
        await s.set_selector("wdg_Retencion", "a")
    else:
        await s.set_selector("wdg_Retencion", search_ret, expected=expected_ret)
    await s.set_text_keyboard("wdg_ImporteRetencion", _fmt_importe(importe))
    if fecha_venc:
        await s.set_fecha("wdg_FechaRetencion", fecha_venc)
    await s.modal_aceptar()


async def cargar_sepsa(
    datos: dict,
    pdf_path: Optional[Path] = None,
    empresa: Optional[str] = None,
    session: Optional[FinnegansSession] = None,
) -> dict:
    """Carga una factura SEPSA en FinnegansGO.

    Args:
        datos:   dict con los campos de FacturaSEPSA (resultado de extracción).
        pdf_path: ruta al PDF original (para adjuntar al borrador).
        empresa: nombre de empresa en Finnegans (override).  Si None, se
                 auto-detecta desde datos["cliente"] / datos["cuit_cliente"].
        session: instancia FinnegansSession existente (modo batch).
    """
    if datos.get("_estado") != "listo":
        return {
            "exito": False,
            "mensaje": f"Estado del documento no es 'listo': {datos.get('_estado')}",
            "nro_interno": None,
        }

    numero_factura = datos.get("numero_factura", "")
    tipo_comprobante = datos.get("tipo_comprobante", "") or "A"
    letra = _letra_comprobante(tipo_comprobante) or "A"
    nro_comprobante = _nro_comprobante_mascara(letra, numero_factura)

    # ── Resolución de empresa ─────────────────────────────────────────────────
    if empresa:
        empresa_finnegans = empresa
        _log(f"Empresa: override del caller → {empresa_finnegans!r}")
    else:
        empresa_finnegans = resolve_empresa_finnegans(datos, log=_log)
        if not empresa_finnegans:
            return {
                "exito": False,
                "mensaje": (
                    f"No se pudo resolver la empresa destino. "
                    f"cliente={datos.get('cliente')!r}, "
                    f"cuit_cliente={datos.get('cuit_cliente')!r}. "
                    f"Pasar --empresa para forzar."
                ),
                "nro_interno": None,
            }

    subtotal_gravado = float(datos.get("subtotal_gravado") or 0)
    if subtotal_gravado <= 0:
        return {
            "exito": False,
            "mensaje": "subtotal_gravado es 0 o no viene en los datos.",
            "nro_interno": None,
        }

    # ── Percepciones IIBB ─────────────────────────────────────────────────────
    # Puede ser lista de dicts (model_dump) o lista de objetos Pydantic.
    percepciones_raw = datos.get("percepciones_iibb") or []
    percepciones: list[dict] = [
        p if isinstance(p, dict) else p.model_dump()
        for p in percepciones_raw
    ]

    # ── Log de datos clave ────────────────────────────────────────────────────
    _log("--- Datos clave SEPSA ---")
    for k in (
        "_provider_id", "emisor", "numero_factura", "tipo_comprobante",
        "cliente", "fecha_emision", "fecha_vencimiento",
        "subtotal_gravado", "iva_21", "total_tributos", "monto_total",
    ):
        _log(f"  {k} = {datos.get(k)!r}")
    _log(f"  percepciones_iibb ({len(percepciones)} fila(s)):")
    for p in percepciones:
        _log(f"    {p.get('provincia')!r}  {p.get('alicuota_pct')}%  =  {p.get('importe')}")

    # ── Función principal (puede inyectarse una sesión batch) ─────────────────
    async def _work(s: FinnegansSession) -> dict:
        await s.select_empresa(empresa_finnegans)
        await s.goto_facturas()
        await s.open_nueva_factura(WORKFLOW_DEFAULT)

        # ── Header ────────────────────────────────────────────────────────────
        await s.set_selector("wdg_Organizacion", "SERVICIO ELECTRONICO")
        if await s.wait_field_enabled("wdg_NumeroDocumento"):
            _validar_nro_comprobante(nro_comprobante)
            await s.set_text("wdg_NumeroDocumento", nro_comprobante, verify=True)
        await s.set_fecha("wdg_Fecha", _compute_fecha_registro(datos["fecha_emision"]))
        await s.set_fecha(
            "wdg_FechaComprobante",
            date.fromisoformat(str(datos["fecha_emision"])[:10]),
        )

        # SEPSA: wdg_ProvinciaOrigen no se toca (regla de negocio).
        _log("wdg_ProvinciaOrigen: proveedor SEPSA — no se toca por regla de negocio.")

        # wdg_ProvinciaDestino: solo acepta Tucuman o Salta (regla de negocio).
        # Si la primera percepción es de otra provincia, se omite el campo.
        _PROVINCIAS_DESTINO_VALIDAS = {"tucuman", "salta"}
        prov_destino_set = False
        for p in percepciones:
            prov_raw = (p.get("provincia") or "").lower()
            if any(k in prov_raw for k in ("tucum",)):
                prov_destino_set = True
                prov_destino_actual = await s.get_field_value("wdg_ProvinciaDestino")
                if _has_value(prov_destino_actual):
                    _log(f"wdg_ProvinciaDestino ya tiene valor ({prov_destino_actual!r}). No se sobreescribe.")
                else:
                    await s.set_selector("wdg_ProvinciaDestino", "Tucuman")
                break
            if any(k in prov_raw for k in ("salta",)):
                prov_destino_set = True
                prov_destino_actual = await s.get_field_value("wdg_ProvinciaDestino")
                if _has_value(prov_destino_actual):
                    _log(f"wdg_ProvinciaDestino ya tiene valor ({prov_destino_actual!r}). No se sobreescribe.")
                else:
                    await s.set_selector("wdg_ProvinciaDestino", "Salta")
                break
        if not prov_destino_set:
            _log("wdg_ProvinciaDestino: ninguna percepción es de Tucumán/Salta — no se toca.")

        # Destinatario (empresa propia)
        cliente_raw = datos.get("cliente", "")
        cliente_search = _search_cliente(cliente_raw)
        cliente_expected = _expected_cliente(cliente_raw)
        if cliente_search:
            await s.set_selector(
                "wdg_OrganizacionOrigen", cliente_search, expected=cliente_expected
            )
        await s.set_text("wdg_Descripcion", datos.get("concepto") or "Recaudación")
        await s.screenshot("sepsa_header_completo")

        # ── Items ─────────────────────────────────────────────────────────────
        await s.click_tab("Items")
        await _agregar_item_recaudacion(s, subtotal_gravado)

        # ── Información fiscal ────────────────────────────────────────────────
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

        # ── Retenciones / Percepciones ────────────────────────────────────────
        fecha_registro = _compute_fecha_registro(datos["fecha_emision"])
        # Fecha de la percepción/retención = FECHA DE REGISTRO contable (la misma
        # que wdg_Fecha). NO se usa el vencimiento del CAE: para facturas de fin de
        # mes ese vencimiento cae en el mes siguiente y registraría la percepción en
        # el período equivocado (p.ej. una factura de junio quedaría en julio).
        fecha_venc: Optional[date] = fecha_registro

        await s.click_tab("Retenciones / Percepciones")

        if percepciones:
            for p in percepciones:
                prov_raw = p.get("provincia") or ""
                importe = float(p.get("importe") or 0)
                if importe <= 0:
                    _log(f"AVISO: percepción IIBB {prov_raw!r} tiene importe ≤ 0 — se saltea.")
                    continue
                search_ret, expected_ret = _map_provincia(prov_raw)
                await _cargar_percepcion_iibb_sepsa(
                    s=s,
                    search_ret=search_ret,
                    expected_ret=expected_ret,
                    importe=importe,
                    fecha_venc=fecha_venc,
                )
        else:
            _log("percepciones_iibb vacía — no se cargan retenciones IIBB (ej. TARTAGAL).")

        # Percepción de IVA RG3337 (3%) — línea propia, igual que en EDET/GIRE.
        perc_iva = float(datos.get("percepcion_rg3337") or 0)
        if perc_iva > 0:
            await s.grid_add_row()
            await s.set_selector("wdg_TipoRetencion", SEARCH_TIPO_PERCEP_IVA)
            await s.set_selector("wdg_Retencion", SEARCH_RET_IVA)
            await s.set_text_keyboard("wdg_ImporteRetencion", _fmt_importe(perc_iva))
            if fecha_venc:
                await s.set_fecha("wdg_FechaRetencion", fecha_venc)
            await s.modal_aceptar()
        else:
            _log("percepcion_rg3337 = 0 → no se carga Percepción de IVA.")

        # ── Total de control ──────────────────────────────────────────────────
        monto_total = datos.get("monto_total")
        if monto_total is not None:
            mt = float(monto_total)
            await s.set_text("wdg_ImporteControl", _fmt_importe(mt))
            total_control_set = await s.get_field_value("wdg_ImporteControl")
            if not _has_value(total_control_set):
                _log("wdg_ImporteControl quedó vacío; se reintenta set.")
                await s.set_text("wdg_ImporteControl", _fmt_importe(mt))
            # Cuadrar el redondeo de IVA con un item 'AJUSTE DECIMAL'. Si el
            # descuadre supera el umbral, _aplicar_ajuste_decimal lanza
            # ControlTotalMismatchError y abortamos ANTES de guardar, para no
            # dejar un borrador huérfano en Finnegans.
            try:
                await _aplicar_ajuste_decimal(s, mt)
            except ControlTotalMismatchError as exc:
                await s.screenshot("control_mismatch_preflight")
                _log(f"Descuadre detectado antes de guardar: {exc}. Marcando para revisión.")
                return {
                    "exito": False,
                    "estado": "revision",
                    "mensaje": (
                        f"Factura SEPSA {numero_factura}: descuadre de importe "
                        f"de control en Finnegans ({exc})."
                    ),
                    "nro_interno": None,
                }
        else:
            _log("AVISO: monto_total no disponible — no se carga total de control.")

        await s.screenshot("sepsa_antes_de_guardar")

        # ── Guardar y adjuntar PDF ────────────────────────────────────────────
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
                        f"Factura SEPSA {numero_factura}: "
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
                        f"Factura SEPSA {numero_factura}: descuadre de importe "
                        f"de control en Finnegans ({exc})."
                    ),
                    "nro_interno": None,
                }
            except Exception as exc:
                _log(f"AVISO: falló save_draft ({exc}).")
            if guardado_ok:
                try:
                    await s.attach_pdf(pdf_path)
                    adjuntado_ok = True
                    await s.screenshot("sepsa_post_adjuntar")
                except Exception as exc:
                    _log(f"AVISO: falló attach_pdf ({exc}).")
            if guardado_ok and adjuntado_ok:
                estado_guardado = "guardada como borrador + PDF adjuntado"
            elif guardado_ok:
                estado_guardado = "guardada como borrador (PDF NO adjuntado)"
            else:
                estado_guardado = "NO se pudo guardar"
                return {
                    "exito": False,
                    "mensaje": f"Factura SEPSA {numero_factura}: {estado_guardado}.",
                    "nro_interno": None,
                }

        return {
            "exito": True,
            "mensaje": f"Factura SEPSA {numero_factura}: {estado_guardado}.",
            "nro_interno": nro_interno,
        }

    try:
        if session is not None:
            return await _work(session)
        async with FinnegansSession(empresa=empresa_finnegans, keep_open=True) as s:
            return await _work(s)
    except EmpresaSelectionError as exc:
        return {
            "exito": False,
            "estado": "revision",
            "mensaje": (
                f"SEPSA: no se pudo seleccionar la empresa destino "
                f"{empresa_finnegans!r} en Finnegans ({exc}). Se aborta para no "
                "cargarla en la empresa equivocada."
            ),
            "nro_interno": None,
        }
    except Exception as exc:
        return {
            "exito": False,
            "mensaje": f"Error al cargar factura SEPSA: {exc}",
            "nro_interno": None,
        }
