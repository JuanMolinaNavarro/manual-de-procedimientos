"""
Flow de Playwright para cargar facturas de ENERGÍA ELÉCTRICA en FinnegansGO.

Proveedor: EDET S.A. (Empresa de Distribución Eléctrica de Tucumán S.A.)
Workflow FinnegansGO: "Compras - Productos & Insumos - Sin Asistente"

Diferencias con `soportes.py`:
  - Hasta 5 items en lugar de 1, según corresponda:
      gravado_iva_27 > 0 → producto "EDETENE"   (ENERGIA IVA 27%)
      gravado_iva_21 > 0 → producto "EDESA21"   (ENERGIA IVA 21%)
      gravado_iva_0  > 0 → producto "EDESAEXE"  (ENERGIA IVA 0% / EXENTO)
      otros_impuestos_cargos > 0 → producto "Otros Impuestos y cargos"
        (suma de Ord. Mun. + TIC Art)
      subtotal_no_gravado != 0 → producto "Servicio Energia Fuente/ Oficina
        No Gravado" (Neto de Redondeo de la factura, puede ser negativo).
  - Solo se carga el item si su importe es != 0 (líneas vacías omitidas).

Interpretación del mapeo de precios: el "precio" del item es la BASE GRAVADA
a esa alícuota (no el monto del IVA). Los productos EDETENE/EDESA21/EDESAEXE
están configurados en FinnegansGO para aplicar el IVA correspondiente sobre
ese precio. Si el mapeo correcto fuera otro (ej. precio = monto del IVA),
ajustar las llamadas a `_agregar_item_con_dimension` en `_work`.

El resto del flujo (header, percepciones, total de control + ajuste, save +
attach) es idéntico a soportes.py.
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
    FinnegansSession,
    _log,
)
from agent.flows.soportes import (
    AJUSTE_THRESHOLD,
    SEARCH_PERCEPCION_IIBB_RET,
    SEARCH_PERCEPCION_IIBB_TIPO,
    SEARCH_PERCEPCION_IVA_RET,
    SEARCH_PERCEPCION_IVA_TIPO,
    SEARCH_PRODUCTO_AJUSTE,
    SEARCH_PROVINCIA,
    SEARCH_EDET,
    _agregar_item_con_dimension,
    _compute_fecha_registro,
    _expected_cliente,
    _fmt_importe,
    _letra_comprobante,
    _nro_comprobante_mascara,
    _resolve_centro_costos,
    _search_cliente,
    _tipo_impositivo_search,
    _validar_nro_comprobante,
)
from agent.knowledge_base import resolve_empresa_finnegans

# Búsquedas de productos en el autocomplete por bracket de IVA.
SEARCH_PRODUCTO_IVA_27 = "EDETENE"
SEARCH_PRODUCTO_IVA_21 = "EDESA21"
SEARCH_PRODUCTO_IVA_0 = "EDESAEXE"
SEARCH_PRODUCTO_OTROS = "Otros Impuestos y cargos"


async def cargar_energia_electrica(
    datos: dict,
    pdf_path: Optional[Path] = None,
    empresa: Optional[str] = None,
    session: Optional[FinnegansSession] = None,
) -> dict:
    """Carga una factura de energía eléctrica en FinnegansGO.

    Args mismos que `cargar_arrendamiento_soportes`.
    """
    if datos.get("_estado") != "listo":
        return {
            "exito": False,
            "mensaje": f"Estado del documento no es 'listo': {datos.get('_estado')}",
            "nro_interno": None,
        }

    numero_factura = datos.get("numero_factura", "")
    tipo_comprobante = datos.get("tipo_comprobante", "") or ""
    letra = _letra_comprobante(tipo_comprobante)
    # Las facturas de energía EDET son "Comprobante Liquidación Servicios
    # Públicos A (Código 17)" — siempre letra A. El LLM a veces no la extrae
    # porque no figura literal como "FACTURA A". Default a 'A'.
    if not letra:
        letra = "A"
        _log("tipo_comprobante vacío → asumiendo 'A' (default para energía EDET)")
    nro_comprobante = _nro_comprobante_mascara(letra, numero_factura)

    # ─── Resolver empresa destino en FinnegansGO ───
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

    # Log de datos clave del extractor.
    _log("--- Datos clave del extractor (energía) ---")
    for k in (
        "numero_factura", "tipo_comprobante", "numero_servicio",
        "cliente", "fecha_emision", "fecha_vencimiento", "tarifa",
        "consumo_activo_kwh",
        "gravado_iva_27", "gravado_iva_21", "gravado_iva_0",
        "otros_impuestos_cargos", "subtotal_no_gravado",
        "percepcion_ib_3_5_pct", "percepcion_rg3337",
        "monto_total", "cae", "fecha_vencimiento_cae",
    ):
        _log(f"  {k} = {datos.get(k)!r}")
    if datos.get("monto_total") in (None, 0, 0.0):
        _log("AVISO: monto_total vacío o 0 → no se va a setear el Total de Control")
    if not datos.get("fecha_vencimiento"):
        _log("AVISO: fecha_vencimiento vacío → no se va a setear la Fecha en las retenciones")

    # Lista de (search_producto, precio) — sólo los != 0.
    # subtotal_no_gravado usa el mismo producto que el ajuste (porque
    # conceptualmente es lo mismo: línea sin IVA, puede ser negativa).
    items_a_cargar: list[tuple[str, float]] = []
    for campo, search_prod in (
        ("gravado_iva_27", SEARCH_PRODUCTO_IVA_27),
        ("gravado_iva_21", SEARCH_PRODUCTO_IVA_21),
        ("gravado_iva_0", SEARCH_PRODUCTO_IVA_0),
        ("otros_impuestos_cargos", SEARCH_PRODUCTO_OTROS),
        ("subtotal_no_gravado", SEARCH_PRODUCTO_AJUSTE),
    ):
        val = float(datos.get(campo) or 0)
        # Para los gravados/impuestos exigimos > 0; para no_gravado aceptamos
        # cualquier valor != 0 (puede ser negativo, ej. -3.86 de redondeo).
        cond = (val != 0) if campo == "subtotal_no_gravado" else (val > 0)
        if cond:
            items_a_cargar.append((search_prod, val))
        else:
            _log(f"{campo} = {val} → se omite el item '{search_prod}'")

    if not items_a_cargar:
        return {
            "exito": False,
            "mensaje": (
                "No hay ningún item con importe > 0 (gravado_iva_27/21/0 y "
                "otros_impuestos_cargos están todos en 0). Revisar la extracción "
                "del PDF."
            ),
            "nro_interno": None,
        }

    async def _work(s: FinnegansSession) -> dict:
        await s.select_empresa(empresa_finnegans)
        await s.goto_facturas()
        await s.open_nueva_factura(WORKFLOW_DEFAULT)

        # ====================== HEADER ======================
        await s.set_selector("wdg_Organizacion", SEARCH_EDET)

        if await s.wait_field_enabled("wdg_NumeroDocumento"):
            _validar_nro_comprobante(nro_comprobante)
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

        # Descripción = "{Domicilio de Cobro} {Periodo}"
        # (ej. "9 De Julio 320 04/2026"). Si falta alguno, se omite ese
        # componente. Periodo cae al mes/año derivado de fecha_emision como
        # último recurso.
        periodo = datos.get("periodo") or ""
        if not periodo:
            try:
                d = date.fromisoformat(str(datos["fecha_emision"])[:10])
                periodo = f"{d.month:02d}/{d.year}"
            except Exception:
                periodo = ""
        domicilio = (datos.get("domicilio_cobro") or "").strip()
        descripcion = f"{domicilio} {periodo}".strip()
        if descripcion:
            await s.set_text("wdg_Descripcion", descripcion)
        _log(f"wdg_Descripcion = {descripcion!r} (domicilio_cobro={domicilio!r}, periodo={periodo!r})")
        await s.screenshot("energia_header_completo")

        # ====================== ITEMS ======================
        await s.click_tab("Items")
        for search_prod, precio in items_a_cargar:
            _log(f"Cargando item: {search_prod!r} con precio {precio}")
            await _agregar_item_con_dimension(
                s,
                producto_search=search_prod,
                cantidad=1,
                precio=precio,
                centro_costos_search=centro_costos_search,
            )

        # ====================== INFORMACIÓN FISCAL ======================
        await s.click_tab("Información Fiscal")
        tipo_imp_search = _tipo_impositivo_search(tipo_comprobante) if tipo_comprobante else None
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
        # Ver explicación en soportes.py: la fecha de retención se clampa a
        # fecha_registro como mínimo para evitar "Fecha no permitida" cuando
        # vencimiento < día 30 y la factura es del mes pasado.
        fecha_registro = _compute_fecha_registro(datos["fecha_emision"])
        fecha_venc = None
        if datos.get("fecha_vencimiento"):
            fecha_venc_pdf = date.fromisoformat(str(datos["fecha_vencimiento"])[:10])
            fecha_venc = max(fecha_venc_pdf, fecha_registro)
            if fecha_venc != fecha_venc_pdf:
                _log(
                    f"AVISO: fecha_vencimiento {fecha_venc_pdf.isoformat()} es anterior a "
                    f"fecha_registro {fecha_registro.isoformat()} → se usa "
                    f"{fecha_venc.isoformat()} para las retenciones."
                )

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
            _log("percepcion_rg3337 = 0 / None → se omite la Percepción de IVA (RG 3337)")

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
                        f"Factura {numero_factura} (energía): descuadre de importe de "
                        f"control en Finnegans (Total {total_calc:.2f} vs control "
                        f"{float(monto_total):.2f}, dif {diff:+.2f})."
                    ),
                    "nro_interno": None,
                }

        await s.screenshot("energia_antes_de_guardar")

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
                        f"Factura {numero_factura} (energía): "
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
                        f"Factura {numero_factura} (energía): descuadre de importe "
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
                    await s.screenshot("energia_post_adjuntar")
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
                    "mensaje": f"Factura {numero_factura} (energía): {estado_guardado}.",
                    "nro_interno": None,
                }
        else:
            _log("pdf_path no provisto → no se guarda ni se adjunta")

        return {
            "exito": True,
            "mensaje": f"Factura {numero_factura} (energía): {estado_guardado}.",
            "nro_interno": nro_interno,
        }

    # ----------------------------------------------------------------------
    # Dispatcher
    # ----------------------------------------------------------------------
    try:
        if session is not None:
            return await _work(session)
        async with FinnegansSession(empresa=empresa_finnegans, keep_open=True) as s:
            return await _work(s)
    except Exception as exc:
        return {
            "exito": False,
            "mensaje": f"Error al cargar factura de energía: {exc}",
            "nro_interno": None,
        }
