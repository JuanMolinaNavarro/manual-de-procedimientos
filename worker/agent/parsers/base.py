"""Utilidades compartidas por los parsers deterministas.

El corazón es `reconstruir_lineas`: PyMuPDF devuelve las palabras en un orden que
NO siempre respeta la maquetación visual (en SEPSA, p.ej., el valor del IVA queda
pegado a la etiqueta equivocada en el texto plano). Reagrupando las palabras por
su coordenada Y (banda horizontal) y ordenándolas por X, recuperamos las líneas
tal como las ve el ojo humano, y con eso el par etiqueta→valor es fiable.
"""
from __future__ import annotations

import re
from pathlib import Path

import pymupdf


# ---------------------------------------------------------------------------
# Lectura del PDF
# ---------------------------------------------------------------------------

def open_page1(pdf_path: str | Path):
    """Abre el PDF y devuelve (words, text) de la PRIMERA página.

    Igual que el worker, sólo se procesa la página 1: en EDET/SEPSA toda la
    info relevante está ahí. `words` es la lista de tuplas de PyMuPDF
    (x0, y0, x1, y1, palabra, block, line, word_no); `text` es el texto plano.
    """
    doc = pymupdf.open(str(pdf_path))
    try:
        page = doc[0]
        words = page.get_text("words")
        text = page.get_text() or ""
    finally:
        doc.close()
    return words, text


# ---------------------------------------------------------------------------
# Reconstrucción posicional de líneas
# ---------------------------------------------------------------------------

class Linea:
    """Una línea visual reconstruida: sus tokens ordenados por X + el texto unido."""

    __slots__ = ("y", "tokens", "text")

    def __init__(self, y: float, tokens: list[tuple[float, str]]):
        self.y = y
        self.tokens = tokens  # [(x0, palabra), ...] ordenados por x0
        self.text = " ".join(t for _, t in tokens)

    def __repr__(self) -> str:  # pragma: no cover
        return f"Linea(y={self.y:.1f}, text={self.text!r})"


def reconstruir_lineas(words, y_tol: float = 3.0) -> list[Linea]:
    """Agrupa `words` en líneas visuales por banda Y (tolerancia `y_tol` px),
    cada una con sus tokens ordenados por X. Devuelve las líneas ordenadas por Y.
    """
    buckets: dict[int, list[tuple[float, float, str]]] = {}
    for w in words:
        x0, y0, txt = w[0], w[1], w[4]
        if not str(txt).strip():
            continue
        key = round(y0 / y_tol)
        buckets.setdefault(key, []).append((x0, y0, txt))
    lineas: list[Linea] = []
    for key in sorted(buckets):
        row = sorted(buckets[key], key=lambda t: t[0])
        y = min(t[1] for t in row)
        tokens = [(x0, t) for x0, _, t in row]
        lineas.append(Linea(y, tokens))
    return lineas


# ---------------------------------------------------------------------------
# Parseo de montos y fechas (formato argentino)
# ---------------------------------------------------------------------------

# Un monto AR: separador decimal COMA, miles con PUNTO opcional. Signo opcional.
# Ej: "116.658,86" | "61394,78" | "-13.144,12" | "0,00" | "3.508.273,10"
_MONTO_RE = re.compile(r"-?\d[\d.]*,\d{1,2}")


def parse_monto_ar(s: str | None) -> float | None:
    """'$ 3.508.273,10' | '61394,78' | '$ -3,33' | '-13.144,12' → float. None si no hay.

    OJO: sólo matchea números con decimales de coma (montos). Ignora tasas con
    punto decimal como '162.3000 $/kWh' y códigos como '0031-00025440'.
    """
    if s is None:
        return None
    # OJO: NO quitar espacios internos — eso fusionaría números de columnas
    # adyacentes ("25  21.449,70" → "2521.449,70"). Sólo se quita el "$".
    t = str(s).replace("$", "")
    m = _MONTO_RE.search(t)
    if not m:
        return None
    return float(m.group().replace(".", "").replace(",", "."))


def montos_en(s: str | None) -> list[float]:
    """Todos los montos AR presentes en un string, en orden de aparición."""
    if s is None:
        return []
    # Sin quitar espacios internos (ver nota en parse_monto_ar).
    t = str(s).replace("$", "")
    return [float(m.replace(".", "").replace(",", ".")) for m in _MONTO_RE.findall(t)]


# Alícuota en porcentaje: un número seguido de '%' ("3,5%", "1,75 %", "27%", "2.5%").
_ALICUOTA_PCT_RE = re.compile(r"\d[\d.,]*\s*%")


def importe_percepcion(text: str | None) -> float | None:
    """Importe de una línea de percepción tipo 'etiqueta <alícuota>% <importe>'.

    `montos_en` sobre esas líneas devuelve TANTO la alícuota (p.ej. 3,5) como el
    importe. Tomar max() o [-1] falla cuando el importe es 0,00 (frecuente en IIBB)
    o menor que la alícuota: se cargaría la alícuota como importe → percepción
    fantasma, descuadre de control-total y draft huérfano. Este helper quita primero
    las alícuotas (números seguidos de '%') y devuelve el monto restante — robusto a
    importe=0 y al orden de columnas. None si no queda ningún monto (percepción sin
    importe impreso ⇒ el caller la trata como 0.0).
    """
    if not text:
        return None
    limpio = _ALICUOTA_PCT_RE.sub(" ", str(text))
    nums = montos_en(limpio)
    return nums[-1] if nums else None


# Monto en formato "US" (miles con COMA, decimal con PUNTO de 2 dígitos):
# "892.86", "4,509.62", "5994.85", "1,234,567.89". GIRE usa este formato (a
# diferencia de SEPSA/EDET que usan el formato AR con coma decimal).
_MONTO_US_RE = re.compile(r"-?\d[\d,]*\.\d{2}")


def parse_monto_us(s: str | None) -> float | None:
    """'$ 4,509.62' | '892.86' | '$5994.85' → float (formato US). None si no hay."""
    if s is None:
        return None
    m = _MONTO_US_RE.search(str(s).replace("$", ""))
    return float(m.group().replace(",", "")) if m else None


def montos_us(s: str | None) -> list[float]:
    """Todos los montos en formato US de un string, en orden de aparición."""
    if s is None:
        return []
    t = str(s).replace("$", "")
    return [float(m.replace(",", "")) for m in _MONTO_US_RE.findall(t)]


def sin_montos_us(s: str | None) -> str:
    """El string sin sus montos US (para aislar texto: jurisdicción, concepto)."""
    return _MONTO_US_RE.sub("", str(s or ""))


_FECHA_RE = re.compile(r"(\d{2})[/.](\d{2})[/.](\d{4})")


def fecha_iso(s: str | None) -> str | None:
    """'12/05/2026' o '12.05.2026' → '2026-05-12'. None si no matchea."""
    if s is None:
        return None
    m = _FECHA_RE.search(str(s))
    if not m:
        return None
    d, mth, y = m.groups()
    return f"{y}-{mth}-{d}"


# ---------------------------------------------------------------------------
# Anclas (buscar valores relativos a etiquetas)
# ---------------------------------------------------------------------------

def find_linea(lineas: list[Linea], patron: str, flags=re.IGNORECASE) -> Linea | None:
    """Primera línea cuyo texto matchea `patron` (regex). None si ninguna."""
    rx = re.compile(patron, flags)
    for ln in lineas:
        if rx.search(ln.text):
            return ln
    return None


def find_lineas(lineas: list[Linea], patron: str, flags=re.IGNORECASE) -> list[Linea]:
    """Todas las líneas cuyo texto matchea `patron`."""
    rx = re.compile(patron, flags)
    return [ln for ln in lineas if rx.search(ln.text)]


def monto_en_linea(lineas: list[Linea], patron_etiqueta: str) -> float | None:
    """Monto que está en la MISMA línea visual que la etiqueta (el último de la
    línea, típicamente el valor a la derecha de la etiqueta). None si no hay.
    """
    ln = find_linea(lineas, patron_etiqueta)
    if ln is None:
        return None
    nums = montos_en(ln.text)
    return nums[-1] if nums else None


# ---------------------------------------------------------------------------
# Clasificación por proveedor (determinista, sin IA)
# ---------------------------------------------------------------------------

CUIT_SEPSA = "30-65986378-9"   # SERVICIO ELECTRONICO DE PAGO S.A. / PagoFácil
CUIT_GIRE = "30-64399063-2"    # GIRE S.A.
CUIT_EDET = "30-65865024-2"    # EMPRESA DE DISTRIBUCION ELECTRICA DE TUCUMAN S.A.


def clasificar(text: str) -> str | None:
    """Devuelve el tipo_flujo a partir del texto de la página 1, sin IA.

    Prioriza el CUIT del emisor (identificación 100% confiable) y, dentro de
    EDET, distingue energía vs. arrendamiento de soportes por las señales de
    contenido. Devuelve None si no reconoce el formato.
    """
    up = text.upper()
    if CUIT_SEPSA in text or "SERVICIO ELECTRONICO DE PAGO" in up:
        return "recaudacion_sepsa"
    if CUIT_GIRE in text or "GIRE S.A" in up:
        return "recaudacion"
    # EDET: puede ser energía o arrendamiento de soportes.
    es_edet = CUIT_EDET in text or "DISTRIBUCION ELECTRICA DE TUCUMAN" in up
    if "ARREND" in up or ("ALQUILER" in up and "BT Y MT" in up):
        return "arrendamiento_soportes"
    if es_edet or "KWH" in up or "CARGO ENERG" in up:
        return "energia_electrica"
    return None
