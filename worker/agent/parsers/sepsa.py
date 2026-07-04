"""Parser determinista (sin IA) para facturas de SEPSA / PagoFácil.

Emisor: SERVICIO ELECTRONICO DE PAGO S.A. (CUIT 30-65986378-9), marca PagoFácil.
Estas son facturas "A" de recaudación / cobranza con débito automático.

CLAVE (ver nota en base.py): el texto plano de PyMuPDF viene DESORDENADO respecto
del layout visual. Por eso NO parseamos sobre `text`: reconstruimos las líneas
visuales con `reconstruir_lineas(words)` y anclamos cada valor a su etiqueta
(SUBTOTAL:, I.V.A. 21 %, Total:, etc.), tomando el monto posicionalmente en la
MISMA línea que la etiqueta.

Estructura del bloque de totales (una etiqueta + su valor por línea):
    SUBTOTAL:         -> subtotal_gravado      (base gravada al 21%)
    I.V.A. 21 %       -> iva_21                 (== subtotal_gravado * 0.21)
    Total Tributos:   -> total_tributos         (suma de la tabla "Otros Tributos")
    Total:            -> monto_total            (== subtotal + iva_21 + total_tributos)

La tabla "Otros Tributos" (encabezados "Tributo | Importe | Tributo | Importe")
puede estar vacía. Cuando trae filas: cada IIBB por jurisdicción va a
percepciones_iibb; la fila "Percepción IVA RG 3337" (3%) va a percepcion_rg3337.
"""
from __future__ import annotations

import re

from agent.parsers.base import (
    fecha_iso,
    find_linea,
    importe_percepcion,
    monto_en_linea,
    montos_en,
    parse_monto_ar,
    reconstruir_lineas,
)
from agent.schemas import FacturaSEPSA, PercepcionIIBBSEPSA

# Datos fijos del emisor SEPSA / PagoFácil.
EMISOR_SEPSA = "SERVICIO ELECTRONICO DE PAGO S.A."
CUIT_EMISOR_SEPSA = "30-65986378-9"

# CUIT del cliente: se escribe como "CUIT: 33-71007459-9". OJO: el CUIT del
# emisor aparece como "CUIT N° 30-65986378-9" (con "N°"), así que exigimos que
# después de "CUIT" venga ":" y NO "N°" — así no lo confundimos con el emisor.
_CUIT_CLIENTE_RE = re.compile(r"CUIT\s*:\s*(\d{2}-\d{8}-\d)")

# Número de factura: "Nº: 0008-07289295" -> "0008-07289295".
_NUMERO_RE = re.compile(r"N[º°o]\s*:?\s*(\d{4}-\d{7,8})")

# CAE: 14 dígitos. En estos PDFs la etiqueta "C.A.E. Nº" y el número quedan en
# líneas visuales distintas, por eso lo buscamos como un run de 14 dígitos.
_CAE_RE = re.compile(r"\b(\d{14})\b")


def _texto_tras_etiqueta(linea, etiqueta_regex: str) -> str | None:
    """Devuelve el texto que sigue a `etiqueta_regex` dentro de `linea.text`.

    Sirve para extraer valores string (razón social, domicilio) que están en la
    misma línea que su etiqueta. None si la etiqueta no matchea o no hay resto.
    """
    if linea is None:
        return None
    m = re.search(etiqueta_regex, linea.text, re.IGNORECASE)
    if not m:
        return None
    resto = linea.text[m.end():].strip()
    return resto or None


def _cliente(lineas) -> str | None:
    """Razón social del cliente desde la línea 'SRES.: <razón social>'."""
    ln = find_linea(lineas, r"SRES\.?\s*:")
    return _texto_tras_etiqueta(ln, r"SRES\.?\s*:")


def _cuit_cliente(lineas) -> str | None:
    """CUIT del cliente ('CUIT: XX-XXXXXXXX-X'), nunca el del emisor ('CUIT N°')."""
    for ln in lineas:
        m = _CUIT_CLIENTE_RE.search(ln.text)
        if m:
            return m.group(1)
    return None


def _numero_factura(lineas) -> str | None:
    """Número de comprobante 'PV-NUMERO' desde la línea 'Nº: 0008-07289295'."""
    # Anclamos a la línea que empieza con "Nº:" para no capturar otros números
    # con guion (CAE, teléfonos). El encabezado "FACTURA / Nº: ..." es único.
    ln = find_linea(lineas, r"N[º°o]\s*:\s*\d{4}-\d{7,8}")
    if ln is None:
        return None
    m = _NUMERO_RE.search(ln.text)
    return m.group(1) if m else None


def _fecha_emision(lineas) -> str | None:
    """Fecha de emisión desde 'Fecha: DD/MM/YYYY' (evita 'Fecha Vto. CAE')."""
    for ln in lineas:
        t = ln.text
        # Excluimos explícitamente la línea del vencimiento de CAE, que también
        # contiene "Fecha" pero es "Fecha Vto. CAE:".
        if re.search(r"Fecha\s*:", t, re.IGNORECASE) and "VTO" not in t.upper():
            f = fecha_iso(t)
            if f:
                return f
    return None


def _fecha_vencimiento(lineas) -> str | None:
    """Vencimiento del comprobante desde 'VENCIMIENTO: DD/MM/YYYY'."""
    ln = find_linea(lineas, r"VENCIMIENTO\s*:")
    return fecha_iso(ln.text) if ln is not None else None


def _cae(lineas) -> str | None:
    """CAE de 14 dígitos. Preferimos la línea vecina a la etiqueta 'C.A.E. Nº'."""
    # 1) Si la etiqueta y el número comparten línea, tomarlo de ahí.
    ln_lbl = find_linea(lineas, r"C\.?A\.?E\.?")
    if ln_lbl is not None:
        m = _CAE_RE.search(ln_lbl.text)
        if m:
            return m.group(1)
        # 2) Si no, el número suele estar en la línea inmediatamente siguiente.
        try:
            idx = lineas.index(ln_lbl)
        except ValueError:
            idx = -1
        if idx != -1:
            for sig in lineas[idx + 1: idx + 3]:
                m = _CAE_RE.search(sig.text)
                if m:
                    return m.group(1)
    # 3) Último recurso: cualquier run aislado de 14 dígitos en la página.
    for ln in lineas:
        m = _CAE_RE.search(ln.text)
        if m:
            return m.group(1)
    return None


def _fecha_vto_cae(lineas) -> str | None:
    """Vencimiento del CAE desde 'Fecha Vto. CAE: DD/MM/YYYY'."""
    ln = find_linea(lineas, r"Vto\.?\s*CAE")
    return fecha_iso(ln.text) if ln is not None else None


def _parsear_otros_tributos(lineas) -> tuple[list[PercepcionIIBBSEPSA], float]:
    """Parsea la tabla 'Otros Tributos' -> (percepciones_iibb, percepcion_rg3337).

    La tabla tiene encabezados "Tributo | Importe | Tributo | Importe" y va entre
    la fila de encabezados y "Total Tributos:". Cada fila de datos: un nombre de
    tributo + su importe. Las filas IIBB por jurisdicción van a percepciones_iibb;
    la fila "Percepción IVA RG 3337" (3%) va a percepcion_rg3337.

    En los 3 samples esta tabla está VACÍA (Total Tributos: 0,00), así que esto
    devuelve ([], 0.0). Se implementa igual para el caso general con filas.
    """
    percepciones: list[PercepcionIIBBSEPSA] = []
    rg3337 = 0.0

    ln_encabezado = find_linea(lineas, r"Tributo\s+Importe")
    ln_total = find_linea(lineas, r"Total\s+Tributos\s*:")
    if ln_encabezado is None or ln_total is None:
        return percepciones, rg3337

    try:
        i_ini = lineas.index(ln_encabezado) + 1
        i_fin = lineas.index(ln_total)
    except ValueError:
        return percepciones, rg3337

    for ln in lineas[i_ini:i_fin]:
        texto = ln.text.strip()
        if not texto:
            continue
        importes = montos_en(texto)
        if not importes:
            continue  # línea sin monto -> no es una fila de tributo

        # OJO: en el layout de SEPSA, las líneas del bloque de totales (SUBTOTAL,
        # I.V.A. 21 %, Total, Otros Tributos) quedan visualmente INTERCALADAS con
        # la tabla "Otros Tributos". Hay que descartarlas: NO son percepciones.
        if _ES_LINEA_TOTALES.search(texto):
            continue

        # El importe es el monto que NO es la alícuota (aislado descartando el
        # número seguido de "%"). Robusto a importe=0,00 y a que en SEPSA el orden
        # de columnas (importe/alícuota) no esté verificado por ningún sample.
        importe = importe_percepcion(texto)
        if importe is None:
            continue

        # Distinguir Percepción IVA RG 3337 (3%) del resto (IIBB por jurisdicción).
        if re.search(r"RG\s*3337|Percepci[oó]n\s+(de\s+)?IVA", texto, re.IGNORECASE):
            rg3337 = importe
            continue

        # Fila IIBB: el nombre de la jurisdicción es el texto sin montos ni el
        # prefijo de etiqueta ("Percepcion II.BB." / "IIBB Percepcion").
        provincia = _limpiar_provincia(texto)
        # Intentar leer una alícuota en % si figura (ej. "Tucuman 5,00 % 1.234,56").
        alicuota = _alicuota_pct(texto)
        percepciones.append(
            PercepcionIIBBSEPSA(
                provincia=provincia or "Sin identificar",
                alicuota_pct=alicuota,
                importe=importe,
            )
        )

    return percepciones, rg3337


# Prefijo de etiqueta a quitar del nombre de la jurisdicción ("Percepcion II.BB.
# Tucuman" → "Tucuman"; "IIBB Percepcion Santa Fe" → "Santa Fe").
_PREFIJO_IIBB_RE = re.compile(
    r"^(IIBB\s+)?Percep\w*\.?\s*(de\s+)?(II\.?\s*BB\.?|Ing\.?\s*Brutos)\.?\s*",
    re.IGNORECASE,
)


def _limpiar_provincia(texto: str) -> str:
    """Nombre de la jurisdicción: quita montos, alícuotas y el prefijo de etiqueta."""
    sin_montos = _MONTO_TXT_RE.sub("", texto)
    sin_prefijo = _PREFIJO_IIBB_RE.sub("", sin_montos)
    return sin_prefijo.strip(" .-|%")


# Líneas del bloque de totales que se cuelan visualmente dentro del rango de la
# tabla "Otros Tributos" y NO son percepciones (deben descartarse).
_ES_LINEA_TOTALES = re.compile(
    r"SUBTOTAL|I\.?\s*V\.?\s*A\.?\s*\d|^\s*Total\b|Otros\s+Tributos|"
    r"Importe\s+expresado",
    re.IGNORECASE,
)

# Para limpiar los montos del texto de una fila y quedarnos con la jurisdicción.
_MONTO_TXT_RE = re.compile(r"-?\d[\d.]*,\d{1,2}\s*%?")

# Alícuota en porcentaje dentro de una fila (ej. "5,00 %" o "2,5%").
_ALICUOTA_RE = re.compile(r"(\d{1,2}(?:,\d{1,3})?)\s*%")


def _alicuota_pct(texto: str) -> float | None:
    """Extrae la alícuota en % de una fila IIBB, si figura. None si no."""
    m = _ALICUOTA_RE.search(texto)
    if not m:
        return None
    return parse_monto_ar(m.group(1)) if "," in m.group(1) else float(m.group(1))


def parse_sepsa(words, text: str) -> FacturaSEPSA:
    """Parsea una factura SEPSA/PagoFácil a partir de (words, text) de la página 1.

    `words` son las tuplas de PyMuPDF (x0,y0,x1,y1,palabra,...); `text` es el texto
    plano (sólo se usa como respaldo, nunca para pares etiqueta→valor).
    """
    lineas = reconstruir_lineas(words)

    # --- Bloque de totales (leído POSICIONALMENTE, monto en la línea de la etiqueta) ---
    # SUBTOTAL: base gravada al 21%.
    subtotal = monto_en_linea(lineas, r"SUBTOTAL\s*:")
    # I.V.A. 21 %: debe ser subtotal * 0.21.
    iva_21 = monto_en_linea(lineas, r"I\.?\s*V\.?\s*A\.?\s*21")
    # Total: importe final a pagar.
    monto_total = monto_en_linea(lineas, r"^\s*Total\s*:")
    if monto_total is None:
        # Respaldo: la línea "Total:" a veces trae texto antes (Importe expresado...).
        monto_total = monto_en_linea(lineas, r"(?<!Tributos)\bTotal\s*:")

    # Tabla "Otros Tributos" (percepciones IIBB + RG3337). Vacía en estos samples.
    percepciones_iibb, percepcion_rg3337 = _parsear_otros_tributos(lineas)

    # Total Tributos: pie de la tabla = suma de "Otros Tributos".
    total_tributos = monto_en_linea(lineas, r"Total\s+Tributos\s*:")

    # --- Guardas / defaults None-safe para campos required del schema ---
    if subtotal is None:
        subtotal = 0.0
    if iva_21 is None:
        # Coherencia: si no se leyó, derivarlo (el flow igual recalcula IVA).
        iva_21 = round(subtotal * 0.21, 2)
    if total_tributos is None:
        total_tributos = 0.0
    if monto_total is None:
        # Reconstruir desde las partes si faltara el "Total:" impreso.
        monto_total = round(subtotal + iva_21 + total_tributos, 2)

    return FacturaSEPSA(
        tipo_flujo="recaudacion_sepsa",
        emisor=EMISOR_SEPSA,
        cuit_emisor=CUIT_EMISOR_SEPSA,
        numero_factura=_numero_factura(lineas) or "",
        tipo_comprobante="A",
        cliente=_cliente(lineas),
        cuit_cliente=_cuit_cliente(lineas),
        fecha_emision=_fecha_emision(lineas) or "",
        fecha_vencimiento=_fecha_vencimiento(lineas),
        concepto=None,
        subtotal_gravado=subtotal,
        iva_21=iva_21,
        percepciones_iibb=percepciones_iibb,
        percepcion_rg3337=percepcion_rg3337,
        total_tributos=total_tributos,
        monto_total=monto_total,
        cae=_cae(lineas),
        fecha_vencimiento_cae=_fecha_vto_cae(lineas),
    )
