"""Parser DETERMINISTA (sin IA) de facturas de arrendamiento de soportes EDET.

Proveedor: EDET (EMPRESA DE DISTRIBUCION ELECTRICA DE TUCUMAN S.A.), factura de
alquiler/arrendamiento de postación en BT y MT de fibra óptica. Devuelve un
`FacturaSoportes` con `tipo_flujo="arrendamiento_soportes"`.

Estrategia: NO se parsea sobre el texto plano (PyMuPDF lo devuelve desordenado
respecto del layout visual). Se reconstruyen las líneas visuales con
`reconstruir_lineas(words)` y se buscan los valores por ancla (etiqueta → monto en
la misma línea).

Reconciliación esperada (flow soportes):
    subtotal_gravado * 1.27 + percepcion_rg3337 + percepcion_ib_3_5_pct == monto_total
"""
from __future__ import annotations

import re

from agent.schemas import FacturaSoportes
from agent.parsers.base import (
    reconstruir_lineas,
    parse_monto_ar,
    montos_en,
    importe_percepcion,
    fecha_iso,
    find_linea,
    monto_en_linea,
)

# Datos fijos del emisor EDET (mismo CUIT que en base.clasificar).
EMISOR_EDET = "EMPRESA DE DISTRIBUCION ELECTRICA DE TUCUMAN S.A."
CUIT_EDET = "30-65865024-2"

# Número de comprobante completo tipo "0031-00025440" (PV de 4 dígitos + número de
# 8). Aparece impreso en el talón inferior de la factura.
_RE_NRO_FACTURA = re.compile(r"\b(\d{4}-\d{8})\b")

# CAE: 14 dígitos corridos junto a la etiqueta "C.A.E.".
_RE_CAE = re.compile(r"\b(\d{14})\b")

# CUIT del cliente: 11 dígitos corridos (formato sin guiones, como aparece impreso).
_RE_CUIT_CLIENTE = re.compile(r"\b(\d{11})\b")


def parse_soportes(words, text: str) -> FacturaSoportes:
    """Extrae una factura de arrendamiento de soportes EDET desde `words`/`text`.

    `words` son las tuplas de PyMuPDF (x0,y0,x1,y1,palabra,...); `text` es el texto
    plano (solo se usa como respaldo). Todos los accesos son None-safe: si un campo
    opcional no figura, queda None (o 0.0 en las percepciones).
    """
    lineas = reconstruir_lineas(words)

    # -- Número y tipo de comprobante -------------------------------------
    # "0031-00025440" aparece literal en el talón inferior; se busca por regex
    # sobre las líneas reconstruidas.
    numero_factura = None
    for ln in lineas:
        m = _RE_NRO_FACTURA.search(ln.text)
        if m:
            numero_factura = m.group(1)
            break

    # "FACTURA A" → tipo_comprobante = "A". Se toma la letra que sigue a "FACTURA".
    tipo_comprobante = None
    ln_fact = find_linea(lineas, r"FACTURA\s+[A-Z]")
    if ln_fact is not None:
        m = re.search(r"FACTURA\s+([A-Z])", ln_fact.text, re.IGNORECASE)
        if m:
            tipo_comprobante = m.group(1).upper()

    # -- Número de servicio -----------------------------------------------
    # Figura en la línea de fechas superior ("532951 26/05/2026 05/06/2026") y en
    # el talón. Es el primer token numérico de la línea que contiene la fecha de
    # emisión. Como respaldo, primer entero de 5-7 dígitos aislado.
    numero_servicio = None

    # -- Fechas de emisión y vencimiento ----------------------------------
    # La línea superior tiene: <numero_servicio> <fecha_emision> <fecha_vencimiento>.
    # La identificamos como la línea con DOS fechas que además arranca con un
    # entero (el número de servicio).
    fecha_emision = None
    fecha_vencimiento = None
    for ln in lineas:
        fechas = re.findall(r"\d{2}/\d{2}/\d{4}", ln.text)
        toks = ln.tokens
        if len(fechas) >= 2 and toks and re.fullmatch(r"\d{5,7}", toks[0][1]):
            numero_servicio = toks[0][1]
            fecha_emision = fecha_iso(fechas[0])
            fecha_vencimiento = fecha_iso(fechas[1])
            break

    # Respaldo del número de servicio: entero de 5-7 dígitos suelto en su línea.
    if numero_servicio is None:
        for ln in lineas:
            if len(ln.tokens) == 1 and re.fullmatch(r"\d{5,7}", ln.tokens[0][1]):
                numero_servicio = ln.tokens[0][1]
                break

    # -- Cliente y CUIT ----------------------------------------------------
    # Línea "PROVIDERS S A 30714140252": el CUIT es el último token de 11 dígitos y
    # la razón social es todo lo previo. La localizamos por ser la línea con un CUIT
    # de 11 dígitos y texto alfabético (excluye el talón numérico).
    cliente = None
    cuit_cliente = None
    for ln in lineas:
        m = _RE_CUIT_CLIENTE.search(ln.text)
        if not m:
            continue
        # Razón social: tokens anteriores al CUIT (alfabéticos).
        previos = [t for _, t in ln.tokens if t != m.group(1)]
        if previos and any(c.isalpha() for c in " ".join(previos)):
            cuit_cliente = m.group(1)
            cliente = " ".join(previos).strip()
            break

    # -- Concepto ----------------------------------------------------------
    # Línea descriptiva del alquiler ("Alquiler de postacion en BT y MT ...").
    concepto = None
    ln_concepto = find_linea(lineas, r"Alquiler\s+de\s+posta")
    if ln_concepto is not None:
        concepto = ln_concepto.text.strip()

    # -- Importes de los ítems (BT / MT) -----------------------------------
    # "Arrend.Providers BRS-BT <importe>" y "...BRS-MT <importe>". El monto es el
    # último de la línea.
    importe_bt = monto_en_linea(lineas, r"Arrend.*BRS-?BT")
    importe_mt = monto_en_linea(lineas, r"Arrend.*BRS-?MT")

    # -- Subtotal gravado --------------------------------------------------
    # Preferimos la suma BT+MT (lo que carga el flow como base). Si alguno falta,
    # caemos al valor impreso "$ 3.508.273,10" que aparece en la línea de totales
    # junto a "$ 0,00" (no gravado) y el total final.
    if importe_bt is not None and importe_mt is not None:
        subtotal_gravado = round(importe_bt + importe_mt, 2)
    else:
        subtotal_gravado = _subtotal_impreso(lineas)

    # -- IVA 27% -----------------------------------------------------------
    iva_27_pct = monto_en_linea(lineas, r"IVA\s+Resp.*27\s*%")

    # -- Percepciones ------------------------------------------------------
    # RG 3337: "Percepción RG 3337 <importe>" (último monto de la línea).
    percepcion_rg3337 = monto_en_linea(lineas, r"Percepci[oó]n\s+RG\s*3337")

    # Ing. Brutos: "Percep. Ing. Brutos 1,75 %  61394,78" → hay DOS montos en la
    # línea (la alícuota "1,75" y el importe). Aislamos el importe descartando la
    # alícuota (el número seguido de "%"). El campo se llama _3_5_pct por historia,
    # pero guarda el importe.
    percepcion_ib_3_5_pct = _percepcion_iibb(lineas)

    # -- Monto total -------------------------------------------------------
    monto_total = _monto_total_impreso(lineas)

    # -- CAE y su vencimiento ----------------------------------------------
    # Línea "C.A.E. Nº <14 dígitos> Fecha de Vencimiento <dd/mm/aaaa>".
    cae = None
    fecha_vencimiento_cae = None
    ln_cae = find_linea(lineas, r"C\.?A\.?E\.?")
    if ln_cae is not None:
        m = _RE_CAE.search(ln_cae.text)
        if m:
            cae = m.group(1)
        f_cae = re.search(r"\d{2}/\d{2}/\d{4}", ln_cae.text)
        if f_cae:
            fecha_vencimiento_cae = fecha_iso(f_cae.group())

    return FacturaSoportes(
        tipo_flujo="arrendamiento_soportes",
        emisor=EMISOR_EDET,
        cuit_emisor=CUIT_EDET,
        numero_factura=numero_factura or "",
        tipo_comprobante=tipo_comprobante or "",
        numero_servicio=numero_servicio,
        cliente=cliente,
        cuit_cliente=cuit_cliente,
        fecha_emision=fecha_emision or "",
        fecha_vencimiento=fecha_vencimiento,
        concepto=concepto,
        importe_bt=importe_bt,
        importe_mt=importe_mt,
        subtotal_gravado=subtotal_gravado if subtotal_gravado is not None else 0.0,
        iva_27_pct=iva_27_pct,
        # Percepciones ausentes → 0.0 (coherente con el default del schema).
        percepcion_rg3337=percepcion_rg3337 if percepcion_rg3337 is not None else 0.0,
        percepcion_ib_3_5_pct=(
            percepcion_ib_3_5_pct if percepcion_ib_3_5_pct is not None else 0.0
        ),
        monto_total=monto_total,
        cae=cae,
        fecha_vencimiento_cae=fecha_vencimiento_cae,
    )


# ---------------------------------------------------------------------------
# Helpers específicos de soportes
# ---------------------------------------------------------------------------

def _percepcion_iibb(lineas) -> float | None:
    """Importe de la percepción de Ingresos Brutos.

    La línea es del tipo "Percep. Ing. Brutos 1,75 %  61394,78": contiene DOS
    montos AR (la alícuota "1,75" y el importe). `importe_percepcion` descarta la
    alícuota (número seguido de "%") y devuelve el importe — correcto incluso si el
    importe es 0,00 (donde max()/último fallarían). None si no figura la percepción.
    """
    ln = find_linea(lineas, r"Percep.*Ing.*Brutos")
    if ln is None:
        return None
    return importe_percepcion(ln.text)


def _subtotal_impreso(lineas) -> float | None:
    """Subtotal gravado impreso ("$ 3.508.273,10").

    Aparece en la línea de totales junto al no gravado ("$ 0,00") y el total final
    ("$ 4.622.149,81"). En esa línea de 3 montos, el subtotal gravado es el del
    medio (el segundo). Se prefiere la línea que precede al talón (misma estructura
    aparece dos veces en la factura). None si no se encuentra.
    """
    for ln in lineas:
        nums = montos_en(ln.text)
        if len(nums) == 3 and "$" in ln.text:
            # [no_gravado, gravado, total] → el gravado es el segundo.
            return nums[1]
    return None


def _monto_total_impreso(lineas) -> float | None:
    """Monto total a pagar ("$ 4.622.149,81").

    Es el mayor de los tres montos de la línea de totales ("$ 0,00  $ 3.508.273,10
    $ 4.622.149,81"), y también el último. None si no se encuentra la línea.
    """
    for ln in lineas:
        nums = montos_en(ln.text)
        if len(nums) == 3 and "$" in ln.text:
            return nums[-1]
    return None
