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
from agent.extractor import pdf_to_text
from agent.flows.soportes import (
    AJUSTE_THRESHOLD,
    _agregar_item_con_dimension,
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

SEARCH_PRODUCTO_RECAUDACION = "RECAUD"
# Producto para absorber descuadres de redondeo de centavos (acepta + y -).
# Finnegans recalcula el IVA y puede diferir del total del PDF por 1 centavo;
# este item ajusta el total para que coincida con el control SIN cambiar el
# monto declarado.
SEARCH_AJUSTE_DECIMAL = "AJUSTE DECIMAL"
SEARCH_CONDICION_PAGO = "Debito"
EXPECTED_CONDICION_PAGO = "Débito Automático"
EXPECTED_PRODUCTO_RECAUDACION = "Recaudación"
SEARCH_TIPO_PERCEP_IIBB = "Percepción de II.BB."
SEARCH_TIPO_PERCEP_IVA = "Percepción de IVA"
SEARCH_RET_IVA = "Percepción 3%"
SEARCH_CENTRO_COSTOS_RECAUDACION = "0065"
_PROVINCIA_BY_EMPRESA_FINNEGANS = {
    "COMPANIA DE CIRCUITOS CERRADO": "Tucuman",  # CCC
    "PROVIDERS": "Tucuman",
    "SALTA CABLE COLOR": "Salta",
    "TAFI CABLE COLOR": "Tucuman",
    "TARTAGAL COMUNICACIONES": "Salta",
    "VALLE MEDIOS": "Tucuman",
    "INTER": "Tucuman",
}


def _provider_search(datos: dict) -> str:
    pid = (datos.get("_provider_id") or "").strip().lower()
    emisor = (datos.get("emisor") or "").strip()
    if pid == "gire":
        return "GIRE S.A."
    if pid == "servicio_electronico_de_pago_s_a":
        return "SERVICIO ELECTRONICO"
    if "GIRE" in emisor.upper():
        return "GIRE S.A."
    if "SERVICIO ELECTRONICO" in emisor.upper() or "SEPSA" in emisor.upper():
        return "SERVICIO ELECTRONICO"
    return emisor or "GIRE"


def _normalize_empresa_key(value: str) -> str:
    v = (value or "").upper()
    v = re.sub(r"[.\-]", " ", v)
    v = re.sub(r"\s+", " ", v).strip()
    v = re.sub(r"\b(S A S|SAS|S A|SA)\b", "", v)
    v = re.sub(r"\s+", " ", v).strip()
    return v


def _provincia_search(datos: dict, empresa_finnegans: Optional[str] = None) -> str:
    empresa_norm = _normalize_empresa_key(empresa_finnegans or "")
    if empresa_norm:
        for empresa_key, provincia in _PROVINCIA_BY_EMPRESA_FINNEGANS.items():
            if empresa_key in empresa_norm:
                return provincia

    cliente = (datos.get("cliente") or "").upper()
    if "SALTA" in cliente or "TARTAGAL" in cliente:
        return "Salta"
    return "Tucuman"


def _ret_iibb_search(datos: dict) -> str:
    cliente = (datos.get("cliente") or "").upper()
    if "SALTA" in cliente or "TARTAGAL" in cliente:
        return "Salta"
    return "Tucuman"


def _ret_iibb_expected(datos: dict) -> str:
    cliente = (datos.get("cliente") or "").upper()
    if "SALTA" in cliente or "TARTAGAL" in cliente:
        return "Percepción IIBB salta"
    return "Percepción de II.BB. Tucuman"


def _tipo_iibb_expected(search_ret: str, expected_ret: Optional[str]) -> str:
    """Devuelve el texto exacto para wdg_TipoRetencion dado una percepción IIBB.

    Lista COMPLETA de opciones en Finnegans (verificada 2026-05-28 via Playwright):
      Percepción de II.BB. CABA (Padrón), Catamarca, Chaco, Cordoba,
      Corrientes, Formosa, Jujuy, La Pampa, Mendoza, Misiones, Neuquen,
      Rio Negro, Salta, San Luis, Santa Fe, Santiago del Estero, Tucuman.

    IMPORTANTE: "Entre Ríos", "San Juan", "La Rioja", "Santa Cruz", "Chubut"
    y "Tierra del Fuego" NO existen en Finnegans — si aparecen en el PDF se
    carga el tipo genérico y puede fallar la selección.

    NOTA sobre Salta: el TipoRetencion es "Percepción de II.BB. Salta" pero
    el campo Retencion (wdg_Retencion) usa "Percepción IIBB salta".
    """
    value = f"{search_ret or ''} {expected_ret or ''}".upper()
    if "BUENOS AIRES" in value or "CABA" in value or "CAPITAL FED" in value:
        return "Percepción de II.BB. CABA (Padrón)"
    if "TUCUM" in value:
        return "Percepción de II.BB. Tucuman"
    if "SALTA" in value:
        return "Percepción de II.BB. Salta"
    if "SANTA FE" in value:
        return "Percepción de II.BB. Santa Fe"
    if "CORDOBA" in value or "CÓRDOBA" in value:
        return "Percepción de II.BB. Cordoba"
    if "CORRIENTES" in value:
        return "Percepción de II.BB. Corrientes"
    if "MENDOZA" in value:
        return "Percepción de II.BB. Mendoza"
    if "MISIONES" in value:
        return "Percepción de II.BB. Misiones"
    if "JUJUY" in value:
        return "Percepción de II.BB. Jujuy"
    if "CATAMARCA" in value:
        return "Percepción de II.BB. Catamarca"
    if "CHACO" in value:
        return "Percepción de II.BB. Chaco"
    if "FORMOSA" in value:
        return "Percepción de II.BB. Formosa"
    if "LA PAMPA" in value:
        return "Percepción de II.BB. La Pampa"
    if "NEUQUEN" in value or "NEUQUÉN" in value:
        return "Percepción de II.BB. Neuquen"
    if "RIO NEGRO" in value or "RÍO NEGRO" in value:
        return "Percepción de II.BB. Rio Negro"
    if "SAN LUIS" in value:
        return "Percepción de II.BB. San Luis"
    if "SANTIAGO" in value:
        return "Percepción de II.BB. Santiago del Estero"
    return SEARCH_TIPO_PERCEP_IIBB  # fallback genérico


_IIBB_PROV_MAP: list[tuple[str, str, str]] = [
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


def _map_provincia_iibb(provincia_raw: str) -> tuple[str, str]:
    """Mapea una provincia (texto libre del LLM) a (search_ret, expected_ret) para
    el campo wdg_Retencion. El wdg_TipoRetencion se calcula aparte con
    _tipo_iibb_expected(). Si no se reconoce, usa el nombre tal cual."""
    prov = (provincia_raw or "").lower().strip()
    for key, search_ret, expected_ret in _IIBB_PROV_MAP:
        if key in prov:
            return search_ret, expected_ret
    prov_title = (provincia_raw or "").strip().title()
    _log(f"AVISO: provincia IIBB no mapeada: {prov_title!r} — se usa tal cual.")
    return prov_title, f"Percepción de II.BB. {prov_title}"


def _importe_item(datos: dict) -> float:
    subtotal = float(datos.get("subtotal_gravado") or 0)
    if subtotal > 0:
        return subtotal
    # Fallback para casos clasificados como energia (SEPSA) donde no vino subtotal_gravado.
    base = (
        float(datos.get("gravado_iva_27") or 0)
        + float(datos.get("gravado_iva_21") or 0)
        + float(datos.get("gravado_iva_0") or 0)
        + float(datos.get("otros_impuestos_cargos") or 0)
        + float(datos.get("subtotal_no_gravado") or 0)
    )
    if base > 0:
        return base
    return float(datos.get("monto_total") or 0)


async def _agregar_item_recaudacion(s: FinnegansSession, importe: float):
    await s.grid_add_row()
    await s.set_selector(
        "wdg_Producto",
        SEARCH_PRODUCTO_RECAUDACION,
        expected=EXPECTED_PRODUCTO_RECAUDACION,
    )
    # set_text (JS setter) no commitea en campos numéricos del modal — usar teclado.
    # Confirmado MCP 2026-05-29: pressSequentially + Tab sí registra el valor.
    await s.set_text_keyboard("wdg_CantidadWorkflow", "1")
    await s.set_text_keyboard("wdg_Precio", _fmt_importe(importe))
    # Espera explícita antes de abrir Dimensiones.
    # Después de seleccionar el producto, Finnegans carga asincrónicamente la
    # configuración de dimensiones desde el servidor. Si se hace click en el
    # subtab 'Dimensiones' antes de que termine esa carga, el tab aparece vacío;
    # cada reintento que re-clickea el tab puede interrumpir la carga anterior.
    # 3 s es suficiente para que el servidor responda en condiciones normales.
    await s.frame.wait_for_timeout(3000)
    # Centro de Costos: la dimension DISTRIBUCION puede no estar presente para el
    # producto 'Recaudacion' en algunas empresas (ej. sandbox 'Prueba').
    # Se intenta pero no es fatal: si falla, se continua y se llama modal_aceptar
    # de todas formas para no dejar el modal abierto (lo que romperia _modal_open
    # y causaria "no-scope" en todos los campos de la factura siguiente).
    try:
        await s.click_modal_subtab("Dimensiones")
        await s.set_dimension_centro_costos(row=0, search=SEARCH_CENTRO_COSTOS_RECAUDACION)
    except Exception as exc:
        _log(f"AVISO: no se pudo setear Centro de Costos en item Recaudacion ({exc}) — se continua")
    await s.modal_aceptar()


async def _aplicar_ajuste_decimal(
    s: FinnegansSession,
    monto_total: float,
    centro_costos_search: str = SEARCH_CENTRO_COSTOS_RECAUDACION,
) -> None:
    """Cuadra el total contra el control agregando un item 'AJUSTE DECIMAL'.

    Finnegans NO recibe el IVA: lo recalcula a partir de la base, y ese redondeo
    puede diferir del total del PDF por centavos (ej. IVA del PDF 1940.37 vs el
    que calcula Finnegans 1940.36 -> total 11642.18 vs control 11642.19). Eso hace
    que Finnegans rechace el guardado por "importe de control".

    Solución: leer el total que calcula Finnegans y, si difiere del control por un
    redondeo chico (<= AJUSTE_THRESHOLD), agregar un item 'AJUSTE DECIMAL' por la
    diferencia (acepta valores + y -). Así el total cuadra exacto SIN cambiar el
    monto declarado. Diferencias mayores NO se ajustan (probable error real de
    extracción): se dejan pasar para que Finnegans las rechace -> revisión.
    """
    mt = float(monto_total)
    await s.frame.wait_for_timeout(1000)
    total_calc = await s.get_total_calculado()
    if total_calc <= 0:
        _log("ajuste_decimal: no se pudo leer el Total calculado; se omite ajuste.")
        return
    diff = round(mt - total_calc, 2)
    if abs(diff) < 0.005:
        _log(f"ajuste_decimal: Total {total_calc:.2f} == control {mt:.2f}; sin ajuste.")
        return
    if abs(diff) <= AJUSTE_THRESHOLD:
        _log(
            f"ajuste_decimal: dif {diff:+.2f} (Total {total_calc:.2f} vs control "
            f"{mt:.2f}) -> agregando item 'AJUSTE DECIMAL' por {diff:+.2f}"
        )
        await s.click_tab("Items")
        await _agregar_item_con_dimension(
            s,
            producto_search=SEARCH_AJUSTE_DECIMAL,
            cantidad=1,
            precio=diff,
            centro_costos_search=centro_costos_search,
        )
        await s.frame.wait_for_timeout(1000)
        total_calc2 = await s.get_total_calculado()
        _log(
            f"ajuste_decimal: post-ajuste Total {total_calc2:.2f} "
            f"(dif vs control {mt - total_calc2:+.2f})"
        )
    else:
        _log("=" * 70)
        _log(
            f"ajuste_decimal: dif {diff:+.2f} (Total {total_calc:.2f} vs control "
            f"{mt:.2f}) supera ${AJUSTE_THRESHOLD} -> NO se ajusta (probable error "
            f"de extracción)."
        )
        _log(
            "ajuste_decimal: se ABORTA antes de guardar para no dejar un borrador "
            "huérfano en Finnegans (un guardado rechazado por control deja la "
            "cabecera con el nº de comprobante y luego bloquea reintentos como "
            "'duplicada')."
        )
        _log("=" * 70)
        raise ControlTotalMismatchError(
            f"Descuadre pre-guardado: Total calculado {total_calc:.2f} vs "
            f"control {mt:.2f} (dif {diff:+.2f}, supera umbral ${AJUSTE_THRESHOLD})."
        )


def _contains_debito_automatico(value: str) -> bool:
    import unicodedata
    norm = unicodedata.normalize("NFD", (value or "").strip().lower())
    norm = "".join(c for c in norm if unicodedata.category(c) != "Mn")
    return "debito" in norm and "automatico" in norm


def _has_value(value: str) -> bool:
    return bool((value or "").strip())


def _parse_amount(value: str) -> float:
    s = (value or "").strip()
    if "," in s and "." in s:
        # Formato miles '.' y decimales ','.
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        # Solo coma: tomar como separador decimal.
        s = s.replace(",", ".")
    # Si solo hay punto, se asume decimal con '.'
    try:
        return float(s)
    except Exception:
        return 0.0


def _extract_iibb_jurisdicciones_from_pdf(pdf_path: Optional[Path]) -> list[tuple[str, str, float]]:
    if not pdf_path:
        return []
    try:
        text = pdf_to_text(Path(pdf_path))
    except Exception as exc:
        _log(f"AVISO: no se pudo leer PDF para desglose IIBB ({exc})")
        return []

    entries: list[tuple[str, str, float]] = []

    # ── GIRE ──────────────────────────────────────────────────────────────────
    # Formato: "Operaciones realizadas en <Jurisdicción>  <base>  <percepción>"
    # El segundo importe es la percepción IIBB de esa jurisdicción.

    pat_caba = re.compile(
        r"Operaciones realizadas en (?:Ciudad de Buenos Aires|Ciudad Aut[oó]noma de Buenos Aires)\s*"
        r"([0-9][0-9\.,]*)\s*([0-9][0-9\.,]*)",
        re.IGNORECASE,
    )
    pat_tuc = re.compile(
        r"Operaciones realizadas en Tucum[aá]n\s*"
        r"([0-9][0-9\.,]*)\s*([0-9][0-9\.,]*)",
        re.IGNORECASE,
    )
    pat_salta = re.compile(
        r"Operaciones realizadas en (?:Provincia de )?Salta\s*"
        r"([0-9][0-9\.,]*)\s*([0-9][0-9\.,]*)",
        re.IGNORECASE,
    )

    m_caba = pat_caba.search(text)
    if m_caba:
        imp = _parse_amount(m_caba.group(2))
        if imp > 0:
            entries.append(
                (
                    "Ciudad Autonoma de Buenos Aires",
                    "Percepción de II.BB. Ciudad Autónoma de Buenos Aires",
                    imp,
                )
            )
    m_tuc = pat_tuc.search(text)
    if m_tuc:
        imp = _parse_amount(m_tuc.group(2))
        if imp > 0:
            entries.append(("Tucuman", "Percepción de II.BB. Tucuman", imp))
    m_salta = pat_salta.search(text)
    if m_salta:
        imp = _parse_amount(m_salta.group(2))
        if imp > 0:
            entries.append(("Salta", "Percepción IIBB salta", imp))

    # Si ya encontramos entradas GIRE, no intentar el formato SEPSA.
    if entries:
        return entries

    # ── SEPSA (PagoFácil) ─────────────────────────────────────────────────────
    # Formato en tabla "Otros Tributos":
    #   "IIBB Percepción Tucumán 3,5%     282,40"
    #   "IIBB Percepción Santa Fe 2,5%    431,03"
    # El nombre de provincia puede ser multi-palabra (Santa Fe, Buenos Aires...).
    # Capturamos: grupo 1 = nombre provincia, grupo 2 = importe.
    pat_sepsa = re.compile(
        r"IIBB\s+Percepci[oó]n\s+"
        r"([\w][^\d%\n]+?)"          # nombre provincia (hasta el rate)
        r"\s+\d+[,\.]\d+\s*%"        # alícuota, ej. "3,5%" o "2.5%"
        r"\s+([0-9][0-9\.,]*)",       # importe
        re.IGNORECASE,
    )

    # Mapa: clave (substring lowercase) → (search_ret, expected_ret_wdg_Retencion)
    # search_ret  → texto que se tipea en wdg_Retencion para filtrar.
    # expected_ret → nombre EXACTO que debe quedar seleccionado en wdg_Retencion.
    # IMPORTANTE: expected_ret ≠ wdg_TipoRetencion (ese lo calcula _tipo_iibb_expected).
    # Verificados en Finnegans 2026-05-28 via Playwright.
    # "Entre Ríos" NO existe en Finnegans — se usará el fallback sin expected.
    _SEPSA_PROV_MAP: list[tuple[str, str, str]] = [
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

    for m in pat_sepsa.finditer(text):
        prov_raw = m.group(1).strip().lower()
        imp = _parse_amount(m.group(2))
        if imp <= 0:
            continue
        matched = False
        for key, search_ret, expected_ret in _SEPSA_PROV_MAP:
            if key in prov_raw:
                entries.append((search_ret, expected_ret, imp))
                matched = True
                break
        if not matched:
            # Provincia desconocida: logear y añadir con el nombre del PDF tal cual.
            prov_title = m.group(1).strip().title()
            _log(f"AVISO: IIBB SEPSA — provincia no mapeada: {prov_title!r} (importe {imp:.2f}). Añadida sin expected.")
            entries.append((prov_title, f"Percepción de II.BB. {prov_title}", imp))

    return entries


def _extract_monto_total_from_pdf(pdf_path: Optional[Path]) -> float | None:
    if not pdf_path:
        return None
    try:
        text = pdf_to_text(Path(pdf_path))
    except Exception:
        return None
    vals: list[float] = []
    for m in re.finditer(r"\$\s*([0-9][0-9\.,]*)", text):
        v = _parse_amount(m.group(1))
        if v > 0:
            vals.append(v)
    if not vals:
        return None
    # En estas facturas el total es el importe monetario mÃ¡s alto del resumen.
    return max(vals)


async def _cargar_percepcion_iibb(
    s: FinnegansSession,
    search_ret: str,
    expected_ret: Optional[str],
    importe: float,
    fecha_venc: Optional[date],
    use_first_ret_option: bool = False,
):
    expected_tipo = _tipo_iibb_expected(search_ret, expected_ret)
    await s.grid_add_row()
    await s.set_selector(
        "wdg_TipoRetencion",
        SEARCH_TIPO_PERCEP_IIBB,
        expected=expected_tipo,
    )
    if use_first_ret_option:
        # CABA: en este flujo el selector trae una sola opciÃ³n al abrir.
        await s.set_selector("wdg_Retencion", "a")
    else:
        await s.set_selector(
            "wdg_Retencion",
            search_ret,
            expected=expected_ret,
        )
    await s.set_text_keyboard("wdg_ImporteRetencion", _fmt_importe(importe))
    if fecha_venc:
        await s.set_fecha("wdg_FechaRetencion", fecha_venc)
    await s.modal_aceptar()


async def cargar_gire(
    datos: dict,
    pdf_path: Optional[Path] = None,
    empresa: Optional[str] = None,
    session: Optional[FinnegansSession] = None,
) -> dict:
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

    if empresa:
        empresa_finnegans = empresa
        _log(f"Empresa: override del caller â†’ {empresa_finnegans!r}")
    else:
        empresa_finnegans = resolve_empresa_finnegans(datos, log=_log)
        if not empresa_finnegans:
            return {
                "exito": False,
                "mensaje": (
                    f"No se pudo resolver la empresa destino. cliente={datos.get('cliente')!r}, "
                    f"cuit_cliente={datos.get('cuit_cliente')!r}. Pasar --empresa para forzar."
                ),
                "nro_interno": None,
            }

    provider_search = _provider_search(datos)
    provincia = _provincia_search(datos, empresa_finnegans=empresa_finnegans)
    ret_iibb_search = _ret_iibb_search(datos)
    ret_iibb_expected = _ret_iibb_expected(datos)
    importe_item = _importe_item(datos)
    if importe_item <= 0:
        return {
            "exito": False,
            "mensaje": "No se pudo determinar importe de item de RecaudaciÃ³n (<=0).",
            "nro_interno": None,
        }

    _log("--- Datos clave recaudaciÃ³n ---")
    for k in (
        "_provider_id", "emisor", "numero_factura", "tipo_comprobante",
        "cliente", "fecha_emision", "fecha_vencimiento", "subtotal_gravado",
        "percepcion_rg3337", "monto_total",
    ):
        _log(f"  {k} = {datos.get(k)!r}")
    _iibb_dump = [
        (p if isinstance(p, dict) else p.model_dump()) for p in (datos.get("percepciones_iibb") or [])
    ]
    _log(
        "  percepciones_iibb = "
        + (", ".join(f"{p.get('provincia')}={p.get('importe')}" for p in _iibb_dump) or "[]")
    )
    _log(f"  provider_search = {provider_search!r}")
    _log(f"  provincia = {provincia!r}")
    _log(f"  item_recaudacion_importe = {importe_item:.2f}")

    async def _work(s: FinnegansSession) -> dict:
        await s.select_empresa(empresa_finnegans)
        await s.goto_facturas()
        await s.open_nueva_factura(WORKFLOW_DEFAULT)

        # Header
        await s.set_selector("wdg_Organizacion", provider_search)
        if await s.wait_field_enabled("wdg_NumeroDocumento"):
            _validar_nro_comprobante(nro_comprobante)
            await s.set_text("wdg_NumeroDocumento", nro_comprobante, verify=True)
        await s.set_fecha("wdg_Fecha", _compute_fecha_registro(datos["fecha_emision"]))
        await s.set_fecha("wdg_FechaComprobante", date.fromisoformat(str(datos["fecha_emision"])[:10]))
        provider_id = (datos.get("_provider_id") or "").strip().lower()
        if provider_id in {"gire", "servicio_electronico_de_pago_s_a"}:
            _log(
                "wdg_CondicionPago: proveedor GIRE/SEPSA, no se toca por regla de negocio."
            )
        else:
            condicion_actual = await s.get_field_value("wdg_CondicionPago")
            if _contains_debito_automatico(condicion_actual):
                _log(
                    "wdg_CondicionPago ya autocompletado por proveedor "
                    f"({condicion_actual!r}). No se sobreescribe."
                )
            else:
                await s.set_selector(
                    "wdg_CondicionPago",
                    SEARCH_CONDICION_PAGO,
                    expected=EXPECTED_CONDICION_PAGO,
                )
        if provider_id == "servicio_electronico_de_pago_s_a":
            _log("wdg_ProvinciaOrigen: proveedor SEPSA, no se toca por regla de negocio.")
        else:
            provincia_origen_actual = await s.get_field_value("wdg_ProvinciaOrigen")
            if _has_value(provincia_origen_actual):
                _log(
                    "wdg_ProvinciaOrigen ya tiene valor "
                    f"({provincia_origen_actual!r}). No se sobreescribe."
                )
            else:
                await s.set_selector("wdg_ProvinciaOrigen", provincia)

        provincia_destino_actual = await s.get_field_value("wdg_ProvinciaDestino")
        if _has_value(provincia_destino_actual):
            _log(
                "wdg_ProvinciaDestino ya tiene valor "
                f"({provincia_destino_actual!r}). No se sobreescribe."
            )
        else:
            await s.set_selector("wdg_ProvinciaDestino", provincia)
        cliente_raw = datos.get("cliente", "")
        cliente_search = _search_cliente(cliente_raw)
        cliente_expected = _expected_cliente(cliente_raw)
        if cliente_search:
            await s.set_selector("wdg_OrganizacionOrigen", cliente_search, expected=cliente_expected)
        await s.set_text("wdg_Descripcion", datos.get("concepto") or "Recaudación")
        await s.screenshot("recaudacion_header_completo")

        # Item RecaudaciÃ³n
        await s.click_tab("Items")
        await _agregar_item_recaudacion(s, importe_item)

        # Información fiscal
        await s.click_tab("Información Fiscal")
        tipo_imp_search = _tipo_impositivo_search(tipo_comprobante)
        if tipo_imp_search:
            await s.set_selector("wdg_comprobanteTipoImpositivo", tipo_imp_search)
        if datos.get("cae"):
            await s.set_text("wdg_cai", datos["cae"])
        if datos.get("fecha_vencimiento_cae"):
            await s.set_fecha("wdg_caiFechaVto", date.fromisoformat(str(datos["fecha_vencimiento_cae"])[:10]))

        # Retenciones / Percepciones
        fecha_registro = _compute_fecha_registro(datos["fecha_emision"])
        fecha_venc = None
        if datos.get("fecha_vencimiento"):
            fv = date.fromisoformat(str(datos["fecha_vencimiento"])[:10])
            fecha_venc = max(fv, fecha_registro)
        await s.click_tab("Retenciones / Percepciones")

        # Percepciones IIBB por jurisdiccion. Fuente de verdad UNICA: la lista
        # estructurada percepciones_iibb que extrajo el LLM (una linea por
        # jurisdiccion, ej. CABA + Tucuman). Si no vino, ultimo recurso: parseo
        # por regex del PDF. Ya no se usa un "total unico" escalar: si la lista
        # quedara incompleta, lo detecta la reconciliacion + reintento.
        percepciones_raw = datos.get("percepciones_iibb") or []
        percepciones = [
            p if isinstance(p, dict) else p.model_dump() for p in percepciones_raw
        ]
        iibb_a_cargar: list[tuple[str, str, float]] = []
        if percepciones:
            for p in percepciones:
                importe = float(p.get("importe") or 0)
                if importe <= 0:
                    continue
                search_ret, expected_ret = _map_provincia_iibb(p.get("provincia") or "")
                iibb_a_cargar.append((search_ret, expected_ret, importe))
            _log(
                "IIBB por jurisdiccion (LLM): "
                + ", ".join(f"{e[1]}={e[2]:.2f}" for e in iibb_a_cargar)
            )
        else:
            iibb_jurisdicciones = _extract_iibb_jurisdicciones_from_pdf(pdf_path)
            if iibb_jurisdicciones:
                iibb_a_cargar = iibb_jurisdicciones
                _log(
                    "IIBB por jurisdiccion (regex PDF): "
                    + ", ".join(f"{e[1]}={e[2]:.2f}" for e in iibb_jurisdicciones)
                )

        for ret_search, ret_expected, importe in iibb_a_cargar:
            is_caba = "BUENOS AIRES" in (ret_expected or "").upper()
            await _cargar_percepcion_iibb(
                s=s,
                search_ret=ret_search,
                expected_ret=ret_expected,
                importe=importe,
                fecha_venc=fecha_venc,
                use_first_ret_option=is_caba,
            )

        perc_iva = float(datos.get("percepcion_rg3337") or 0)
        if iibb_a_cargar and perc_iva > 0:
            subtotal = float(datos.get("subtotal_gravado") or 0)
            if subtotal > 0:
                iva_esperado = round(subtotal * 0.03, 2)
                if abs(perc_iva - iva_esperado) > 0.2:
                    _log(
                        f"AVISO: percepcion_rg3337={perc_iva:.2f} parece inconsistente; "
                        f"se usa 3% del subtotal ({iva_esperado:.2f})."
                    )
                    perc_iva = iva_esperado
        if perc_iva > 0:
            await s.grid_add_row()
            await s.set_selector("wdg_TipoRetencion", SEARCH_TIPO_PERCEP_IVA)
            await s.set_selector("wdg_Retencion", SEARCH_RET_IVA)
            await s.set_text_keyboard("wdg_ImporteRetencion", _fmt_importe(perc_iva))
            if fecha_venc:
                await s.set_fecha("wdg_FechaRetencion", fecha_venc)
            await s.modal_aceptar()

        monto_total = datos.get("monto_total")
        if monto_total is None:
            monto_total = _extract_monto_total_from_pdf(pdf_path)
            if monto_total is not None:
                _log(f"monto_total no vino en extracciÃ³n; fallback desde PDF = {monto_total:.2f}")
        if monto_total is not None:
            await s.set_text("wdg_ImporteControl", _fmt_importe(monto_total))
            total_control_set = await s.get_field_value("wdg_ImporteControl")
            if not _has_value(total_control_set):
                _log("wdg_ImporteControl quedÃ³ vacÃ­o; se reintenta set.")
                await s.set_text("wdg_ImporteControl", _fmt_importe(monto_total))
            # Cuadrar el redondeo de IVA con un item 'AJUSTE DECIMAL'. Si el
            # descuadre supera el umbral, _aplicar_ajuste_decimal lanza
            # ControlTotalMismatchError y abortamos ANTES de guardar, para no
            # dejar un borrador huérfano en Finnegans.
            try:
                await _aplicar_ajuste_decimal(s, float(monto_total))
            except ControlTotalMismatchError as exc:
                await s.screenshot("control_mismatch_preflight")
                _log(f"Descuadre detectado antes de guardar: {exc}. Marcando para revisión.")
                return {
                    "exito": False,
                    "estado": "revision",
                    "mensaje": (
                        f"Factura {numero_factura} (recaudación): descuadre de importe "
                        f"de control en Finnegans ({exc})."
                    ),
                    "nro_interno": None,
                }

        await s.screenshot("recaudacion_antes_de_guardar")

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
                        f"Factura {numero_factura} (recaudación): "
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
                        f"Factura {numero_factura} (recaudación): descuadre de importe "
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
                    await s.screenshot("recaudacion_post_adjuntar")
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
                    "mensaje": f"Factura {numero_factura} (recaudación): {estado_guardado}.",
                    "nro_interno": None,
                }

        return {
            "exito": True,
            "mensaje": f"Factura {numero_factura} (recaudaciÃ³n): {estado_guardado}.",
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
                f"Recaudación: no se pudo seleccionar la empresa destino "
                f"{empresa_finnegans!r} en Finnegans ({exc}). Se aborta para no "
                "cargarla en la empresa equivocada."
            ),
            "nro_interno": None,
        }
    except Exception as exc:
        return {
            "exito": False,
            "mensaje": f"Error al cargar factura de recaudaciÃ³n: {exc}",
            "nro_interno": None,
        }

