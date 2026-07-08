"""Parser DETERMINISTA (sin IA) de facturas de recaudación GIRE S.A.

Emisor: GIRE S.A. (CUIT 30-64399063-2), marca Rapipago. Facturas "A" de
recaudación/cobranza. Devuelve un `FacturaRecaudacion` con `tipo_flujo="recaudacion"`.

Tres particularidades de GIRE respecto de los otros proveedores:

1. **Formato numérico US**: miles con COMA, decimal con PUNTO ("4,509.62" = 4509.62,
   "$5994.85"). Por eso se usan `montos_us`/`parse_monto_us` de base, NO `montos_en`.
2. **Percepción IIBB por jurisdicción = el MENOR de los dos números** de la fila
   "Operaciones realizadas en <juris> <percepción> <base>". Como percepción = base ×
   alícuota (alícuota < 1), la percepción es siempre ≤ base → tomar min() es robusto y
   no depende del orden de columnas ni del desorden del texto plano.
3. **Bloque de totales con etiqueta y valor en líneas visuales distintas** (el layout
   los separa unos pocos px) → se busca el monto por ventana de Y alrededor de la etiqueta.

Reconciliación esperada (flow recaudacion):
    subtotal_gravado*1.21 + percepcion_rg3337 + sum(percepciones_iibb) == monto_total
"""
from __future__ import annotations

import re

from agent.schemas import FacturaRecaudacion, PercepcionIIBBSEPSA
from agent.parsers.base import (
    reconstruir_lineas,
    montos_us,
    sin_montos_us,
    fecha_iso,
    find_linea,
    find_lineas,
)

EMISOR_GIRE = "GIRE S.A."
CUIT_GIRE = "30-64399063-2"

# Códigos AFIP de comprobante → letra (GIRE imprime "Código Nº 01").
_CODIGO_LETRA = {
    "01": "A", "02": "A", "03": "A",
    "06": "B", "07": "B", "08": "B",
    "11": "C", "12": "C", "13": "C",
    "19": "E", "20": "E", "21": "E",  # comprobantes de exportación
    "51": "M", "52": "M", "53": "M",
}

_RE_RUN14 = re.compile(r"\b(\d{14})\b")


def parse_gire(words, text: str) -> FacturaRecaudacion:
    """Extrae una factura de recaudación GIRE desde `words`/`text` de la página 1."""
    lineas = reconstruir_lineas(words)

    # -- Jurisdicciones IIBB (fuente de subtotal y percepciones) -----------
    filas = _jurisdicciones(lineas)  # [(provincia, percepcion, base), ...]
    percepciones_iibb = [
        PercepcionIIBBSEPSA(provincia=prov, alicuota_pct=None, importe=perc)
        for prov, perc, _base in filas
    ]
    suma_bases = round(sum(base for _p, _perc, base in filas), 2)

    # -- Bloque de totales (etiqueta y valor en líneas separadas → ventana Y) --
    # Subtotal impreso; si no se leyera, la suma de las bases por jurisdicción.
    subtotal = _monto_cerca(lineas, r"^\s*Subtotal\b")
    if subtotal is None:
        subtotal = suma_bases
    # Percepción de IVA RG 3337: fila "IVA percep 3 % <importe>" (puede ser 0.00).
    percepcion_rg3337 = _monto_cerca(lineas, r"IVA\s*percep")
    if percepcion_rg3337 is None:
        percepcion_rg3337 = 0.0
    # Total a pagar (importe de control, se lee del impreso — NO se computa).
    monto_total = _monto_cerca(lineas, r"^\s*Total\b")

    return FacturaRecaudacion(
        tipo_flujo="recaudacion",
        emisor=EMISOR_GIRE,
        cuit_emisor=CUIT_GIRE,
        numero_factura=_numero_factura(lineas) or "",
        tipo_comprobante=_tipo_comprobante(lineas),
        cliente=_cliente(lineas),
        cuit_cliente=_cuit_cliente(lineas),
        fecha_emision=_fecha_emision(lineas) or "",
        # GIRE NO tiene fecha de vencimiento de comprobante: sólo existe el
        # vencimiento del CAE (va en fecha_vencimiento_cae). Antes se copiaba acá el
        # vto del CAE, lo que hacía que la percepción se registrara en el mes del CAE
        # (julio) en vez del período contable (junio). La fecha de la retención ahora
        # la maneja el flow con la fecha de registro; este campo queda en None.
        fecha_vencimiento=None,
        concepto=_concepto(lineas),
        subtotal_gravado=subtotal if subtotal is not None else 0.0,
        percepcion_rg3337=percepcion_rg3337,
        percepciones_iibb=percepciones_iibb,
        monto_total=monto_total,
        cae=_cae(lineas),
        fecha_vencimiento_cae=_fecha_vto_cae(lineas),
    )


# ---------------------------------------------------------------------------
# Helpers específicos de GIRE
# ---------------------------------------------------------------------------

def _monto_cerca(lineas, label_regex: str, y_window: float = 7.0) -> float | None:
    """Monto asociado a una etiqueta que puede tener su valor en la MISMA línea o en
    una contigua (dentro de `y_window` px). Devuelve el último monto de la línea de
    la etiqueta si lo tiene; si no, el de la línea más cercana con monto.
    """
    lbl = find_linea(lineas, label_regex)
    if lbl is None:
        return None
    nums = montos_us(lbl.text)
    if nums:
        return nums[-1]
    candidatas = sorted(
        (ln for ln in lineas if 0 < abs(ln.y - lbl.y) <= y_window),
        key=lambda l: abs(l.y - lbl.y),
    )
    for ln in candidatas:
        nums = montos_us(ln.text)
        if nums:
            return nums[-1]
    return None


def _jurisdicciones(lineas, y_window: float = 4.0) -> list[tuple[str, float, float]]:
    """Filas "Operaciones realizadas en <juris>" → (provincia, percepción, base).

    La grilla tiene DOS columnas: "PERCEPCIONES II.BB." (izquierda) e "IMPORTE"
    (base de operaciones, derecha). Posicionalmente la percepción es el PRIMER
    número (columna izquierda) y la base el segundo. ⚠️ NO usar min/max: la
    percepción puede ser MAYOR que la base de esa jurisdicción (p.ej. percepción de
    padrón CABA sobre base 0,00). La columna correcta se autodetecta validando la
    suma contra el total "Percep. II.BB." impreso (robusto ante un layout invertido).

    Si la fila quedó partida en dos líneas visuales (el nombre en una, los montos en
    la contigua), se completan desde la línea vecina dentro de `y_window`.
    """
    crudas: list[tuple[str, float, float]] = []  # (provincia, n_izq, n_der)
    for ln in find_lineas(lineas, r"Operaciones\s+realizadas\s+en"):
        nums = montos_us(ln.text)
        if len(nums) < 2:
            vecina = _linea_contigua_con_montos(lineas, ln, y_window)
            if vecina is not None:
                nums = montos_us(vecina.text)
        if len(nums) < 2:
            continue
        crudas.append((_provincia(ln.text), nums[0], nums[1]))
    if not crudas:
        return []

    # Determinar qué columna es la percepción: la que suma el total impreso
    # "Percep. II.BB.". Por defecto la izquierda (primer número).
    total_perc = _monto_cerca(lineas, r"Percep\.?\s*II\.?\s*BB")
    suma_izq = round(sum(c[1] for c in crudas), 2)
    suma_der = round(sum(c[2] for c in crudas), 2)
    idx_perc = 0
    if total_perc is not None:
        izq_ok = abs(suma_izq - total_perc) <= 0.05
        der_ok = abs(suma_der - total_perc) <= 0.05
        if der_ok and not izq_ok:
            idx_perc = 1

    filas: list[tuple[str, float, float]] = []
    for prov, n_izq, n_der in crudas:
        percepcion = round((n_izq, n_der)[idx_perc], 2)
        base = round((n_izq, n_der)[1 - idx_perc], 2)
        filas.append((prov, percepcion, base))
    return filas


def _linea_contigua_con_montos(lineas, linea, y_window: float):
    """Línea más cercana a `linea` (dentro de y_window) que tenga ≥2 montos US."""
    candidatas = sorted(
        (ln for ln in lineas if 0 < abs(ln.y - linea.y) <= y_window),
        key=lambda l: abs(l.y - linea.y),
    )
    for ln in candidatas:
        if len(montos_us(ln.text)) >= 2:
            return ln
    return None


def _provincia(texto: str) -> str:
    """Jurisdicción: texto tras 'Operaciones realizadas en', sin los montos."""
    m = re.search(r"Operaciones\s+realizadas\s+en\s+(.+)", texto, re.IGNORECASE)
    if not m:
        return "Sin identificar"
    prov = re.sub(r"\s+", " ", sin_montos_us(m.group(1))).strip(" .-")
    return prov or "Sin identificar"


def _numero_factura(lineas) -> str | None:
    """Número 'PV-NUMERO' desde 'Nº 0006 05229814' → '0006-05229814'."""
    ln = find_linea(lineas, r"N[º°o]\s+\d{4}\s+\d{6,8}")
    if ln is None:
        return None
    m = re.search(r"(\d{4})\s+(\d{6,8})", ln.text)
    return f"{m.group(1)}-{m.group(2)}" if m else None


def _tipo_comprobante(lineas) -> str:
    """Letra del comprobante: desde 'Código Nº 01' (AFIP) o la letra suelta arriba."""
    ln = find_linea(lineas, r"C[oó]digo\s+N[º°]\s*\d")
    if ln is not None:
        m = re.search(r"C[oó]digo\s+N[º°]\s*(\d{2})", ln.text)
        if m:
            return _CODIGO_LETRA.get(m.group(1), "A")
    for ln in lineas:
        if ln.y < 60 and re.fullmatch(r"[ABCM]", ln.text.strip()):
            return ln.text.strip()
    return "A"


def _cliente(lineas) -> str | None:
    """Razón social: primera línea alfabética debajo de 'Señor(es):'."""
    lbl = find_linea(lineas, r"Se[ñn]or\(es\)")
    if lbl is None:
        return None
    for ln in sorted((l for l in lineas if l.y > lbl.y), key=lambda l: l.y):
        t = ln.text.strip()
        if t and any(c.isalpha() for c in t):
            return t
    return None


def _cuit_cliente(lineas) -> str | None:
    """CUIT del cliente: 11 dígitos corridos tras 'CUIT:' (el del emisor lleva
    guiones: 'CUIT: 30-64399063-2', así que no matchea \\d{11})."""
    for ln in lineas:
        m = re.search(r"CUIT\s*:?\s*(\d{11})\b", ln.text)
        if m:
            return m.group(1)
    return None


def _fecha_emision(lineas) -> str | None:
    """Fecha de emisión desde 'FECHA : DD/MM/YYYY' (no 'Fecha Vto :')."""
    ln = find_linea(lineas, r"FECHA\s*:")
    return fecha_iso(ln.text) if ln is not None else None


def _fecha_vto_cae(lineas) -> str | None:
    """Vencimiento del CAE desde 'Fecha Vto : DD/MM/YYYY' (valor en línea contigua)."""
    lbl = find_linea(lineas, r"Fecha\s+Vto")
    if lbl is None:
        return None
    f = fecha_iso(lbl.text)
    if f:
        return f
    for ln in sorted((l for l in lineas if 0 < abs(l.y - lbl.y) <= 5.0),
                     key=lambda l: abs(l.y - lbl.y)):
        f = fecha_iso(ln.text)
        if f:
            return f
    return None


def _cae(lineas) -> str | None:
    """CAE de 14 dígitos, junto a 'C.A.E. Nº:' (valor puede estar en línea contigua)."""
    lbl = find_linea(lineas, r"C\.?A\.?E\.?\s*N")
    if lbl is None:
        return None
    m = _RE_RUN14.search(lbl.text)
    if m:
        return m.group(1)
    for ln in sorted((l for l in lineas if 0 < abs(l.y - lbl.y) <= 5.0),
                     key=lambda l: abs(l.y - lbl.y)):
        m = _RE_RUN14.search(ln.text)
        if m:
            return m.group(1)
    return None


def _concepto(lineas) -> str | None:
    """Concepto/servicio desde 'Rapipago - Periodo :2026-05' (sin los montos)."""
    ln = find_linea(lineas, r"Periodo\s*:")
    if ln is None:
        return None
    t = re.sub(r"\s+", " ", sin_montos_us(ln.text)).strip()
    return t or None
