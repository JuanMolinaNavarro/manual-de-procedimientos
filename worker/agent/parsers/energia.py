"""Parser DETERMINISTA (sin IA) de facturas de energía eléctrica EDET.

Proveedor: EDET (EMPRESA DE DISTRIBUCION ELECTRICA DE TUCUMAN S.A.),
CUIT emisor 30-65865024-2. Devuelve un `FacturaEnergiaElectrica` con
`tipo_flujo="energia_electrica"`.

Estrategia (idéntica a los otros parsers): NO se parsea sobre el texto plano
(PyMuPDF lo devuelve desordenado respecto del layout visual). Se reconstruyen las
líneas visuales con `reconstruir_lineas(words)` y se buscan los valores por ancla
(etiqueta → monto en la misma línea reconstruida).

Reconciliación esperada (flow energia):
    gravado_iva_27*1.27 + gravado_iva_21*1.21 + gravado_iva_0
    + otros_impuestos_cargos + subtotal_no_gravado
    + percepcion_ib_3_5_pct + percepcion_rg3337 == monto_total
"""
from __future__ import annotations

import re

from agent.schemas import FacturaEnergiaElectrica
from agent.parsers.base import (
    reconstruir_lineas,
    montos_en,
    importe_percepcion,
    fecha_iso,
    find_linea,
    find_lineas,
    monto_en_linea,
)

# Datos fijos del emisor EDET (mismo CUIT que en base.clasificar / soportes).
EMISOR_EDET = "EMPRESA DE DISTRIBUCION ELECTRICA DE TUCUMAN S.A."
CUIT_EDET = "30-65865024-2"

# Número de comprobante completo tipo "0097-72899692" (PV de 4 dígitos + número de
# 8). Aparece impreso bajo "Factura Nro" y también en el talón inferior.
_RE_NRO_FACTURA = re.compile(r"\b(\d{4}-\d{8})\b")

# Número de servicio: 6 dígitos aislados (ej. "377687"). Se localiza en el bloque
# DATOS SERVICIO y se confirma con el Cod.Pago(Banelco/Link) quitando el "060".
_RE_SERVICIO_6 = re.compile(r"\b(\d{6})\b")

# Cod.Pago Banelco/Link: "060377687" (con prefijo 060, tal cual).
_RE_COD_PAGO = re.compile(r"Cod\.?Pago.*?(\d{6,})", re.IGNORECASE)

# CUIT del cliente impreso sin guiones (11 dígitos corridos, ej. "30612790813").
_RE_CUIT_CLIENTE = re.compile(r"\b(\d{11})\b")

# C.E.S.P. Nº: identificador largo (14 dígitos) del comprobante de servicios.
_RE_CESP = re.compile(r"C\.?E\.?S\.?P\.?\s*N[°º]?\s*(\d+)", re.IGNORECASE)


def parse_energia(words, text: str) -> FacturaEnergiaElectrica:
    """Extrae una factura de energía eléctrica EDET desde `words`/`text`.

    `words` son las tuplas de PyMuPDF (x0,y0,x1,y1,palabra,...); `text` es el texto
    plano (sólo se usa como respaldo puntual). Todos los accesos son None-safe: si
    un campo opcional no figura, queda None (o 0.0 en las percepciones/bases).
    """
    lineas = reconstruir_lineas(words)

    # -- Número de factura -------------------------------------------------
    # "0097-72899692" aparece bajo "Factura Nro" (arriba) y en el talón. Regex
    # sobre las líneas reconstruidas; el primer match sirve.
    numero_factura = _buscar_regex(lineas, _RE_NRO_FACTURA)

    # -- Cod.Pago Banelco y número de servicio -----------------------------
    # El Cod.Pago es "060377687": el número de servicio es ese código SIN el
    # prefijo "060" (los últimos 6 dígitos). Es la fuente más confiable.
    cod_pago_banelco = _cod_pago(lineas)
    numero_servicio = None
    if cod_pago_banelco and cod_pago_banelco.startswith("060") and len(cod_pago_banelco) >= 9:
        numero_servicio = cod_pago_banelco[3:]  # quita el "060"

    # Respaldo: 6 dígitos aislados del bloque DATOS SERVICIO (la línea que además
    # trae las fechas de Vencimiento / Corte de Suministro, ej.
    # "377687 18/06/2026 09/07/2026"). NUNCA el "060..." ni el nro de factura.
    ln_datos_serv = _linea_datos_servicio(lineas)
    if numero_servicio is None and ln_datos_serv is not None:
        m = _RE_SERVICIO_6.search(ln_datos_serv.tokens[0][1]) if ln_datos_serv.tokens else None
        if m:
            numero_servicio = m.group(1)

    # -- CUIT emisor -------------------------------------------------------
    # Está impreso ("CUIT N° 30-65865024-2") pero es fijo para EDET.
    cuit_emisor = CUIT_EDET

    # -- Cliente y CUIT cliente --------------------------------------------
    # Línea "CCC SA 30612790813": el CUIT es el token de 11 dígitos y la razón
    # social es todo lo alfabético previo. Se busca bajo "Apellido y Nombre".
    cliente, cuit_cliente = _cliente_y_cuit(lineas)

    # -- Domicilio de cobro ------------------------------------------------
    # POSICIONAL: valor bajo el encabezado "Domicilio de Cobro" (sección DATOS
    # CLIENTE). ⚠️ En estos samples esa celda viene VACÍA (la fila siguiente es
    # "E-Mail ..."), así que queda None. NO se usa el "Domicilio de Suministro".
    domicilio_cobro = _domicilio_cobro(lineas)

    # -- Fechas y período --------------------------------------------------
    # Línea "04/06/2026 05/2026 20/07/2026" (Fecha de Emisión / Período / Próximo
    # Vencimiento). La fecha de emisión es la primera; el período el "MM/AAAA".
    fecha_emision, periodo = _emision_y_periodo(lineas)

    # Vencimiento: el del bloque DATOS SERVICIO ("377687 18/06/2026 09/07/2026"),
    # NO "Próximo Vencimiento" ni "Corte de Suministro". Es la 1ª fecha de esa línea.
    fecha_vencimiento = None
    if ln_datos_serv is not None:
        m = re.search(r"\d{2}/\d{2}/\d{4}", ln_datos_serv.text)
        if m:
            fecha_vencimiento = fecha_iso(m.group())

    # -- Bases gravadas por alícuota de IVA --------------------------------
    # "SUBTOTAL GRAVADO $ 151.925,44" → base al 27% (en estas EDET todo es 27%).
    gravado_iva_27 = monto_en_linea(lineas, r"SUBTOTAL\s+GRAVADO")
    # En estos samples no hay bases al 21% ni al 0%; default 0.0.
    gravado_iva_21 = 0.0
    gravado_iva_0 = 0.0

    # -- Otros impuestos y cargos ------------------------------------------
    # SUMA ESTRICTA de "Ord.Mun.*" + "TIC-Art.*" de la tabla "Impuestos y Tasas".
    # ⛔ NO incluye Imp. Nac. Ley 25.413, Rec. Bajo Factor de Potencia,
    # Inv.Oblig.*, Aporte TIS ni Neto de Redondeo (ya dentro del gravado o aparte).
    otros_impuestos_cargos = _otros_impuestos(lineas)

    # -- Subtotal no gravado (Neto de Redondeo) ----------------------------
    # "SUBTOTAL NO GRAVADO $ -3,33" → puede ser NEGATIVO; se conserva el signo.
    subtotal_no_gravado = monto_en_linea(lineas, r"SUBTOTAL\s+NO\s+GRAVADO")

    # -- Percepciones ------------------------------------------------------
    # "Percep. Ing. Brutos 3,5% 5.317,39" → hay dos montos (la alícuota 3,5 y el
    # importe); aislamos el importe descartando la alícuota (número seguido de "%").
    percepcion_ib_3_5_pct = _percepcion_iibb(lineas)
    # "Percepción RG 3337 4.557,76" → último monto de la línea.
    percepcion_rg3337 = monto_en_linea(lineas, r"Percepci[oó]n\s+RG\s*3337")

    # -- IVA 27% (cross-check, no se usa para items) -----------------------
    iva_27_pct = monto_en_linea(lineas, r"IVA\s+Resp.*Inscr.*27\s*%")

    # -- Monto total -------------------------------------------------------
    # "Total Factura 226.510,00" (banda propia) o "$ 226.510,00" del encabezado.
    monto_total = _monto_total(lineas)

    # -- C.E.S.P. ----------------------------------------------------------
    cesp = _buscar_regex(lineas, _RE_CESP)

    return FacturaEnergiaElectrica(
        tipo_flujo="energia_electrica",
        emisor=EMISOR_EDET,
        cuit_emisor=cuit_emisor,
        numero_factura=numero_factura or "",
        numero_servicio=numero_servicio,
        cliente=cliente,
        cuit_cliente=cuit_cliente,
        domicilio_cobro=domicilio_cobro,
        periodo=periodo,
        fecha_emision=fecha_emision or "",
        fecha_vencimiento=fecha_vencimiento,
        # Bases por alícuota → 0.0 si no figuran (coherente con el schema).
        gravado_iva_27=gravado_iva_27 if gravado_iva_27 is not None else 0.0,
        gravado_iva_21=gravado_iva_21,
        gravado_iva_0=gravado_iva_0,
        otros_impuestos_cargos=otros_impuestos_cargos,
        subtotal_no_gravado=(
            subtotal_no_gravado if subtotal_no_gravado is not None else 0.0
        ),
        percepcion_ib_3_5_pct=(
            percepcion_ib_3_5_pct if percepcion_ib_3_5_pct is not None else 0.0
        ),
        percepcion_rg3337=(
            percepcion_rg3337 if percepcion_rg3337 is not None else 0.0
        ),
        iva_27_pct=iva_27_pct,
        monto_total=monto_total,
        cod_pago_banelco=cod_pago_banelco,
        cesp=cesp,
    )


# ---------------------------------------------------------------------------
# Helpers específicos de energía EDET
# ---------------------------------------------------------------------------

def _buscar_regex(lineas, rx) -> str | None:
    """Primer grupo 1 que matchea `rx` recorriendo las líneas reconstruidas."""
    for ln in lineas:
        m = rx.search(ln.text)
        if m:
            return m.group(1)
    return None


def _cod_pago(lineas) -> str | None:
    """Código de pago Banelco/Link tal cual ("060377687", con prefijo 060).

    La etiqueta y el valor pueden quedar en la misma línea reconstruida
    ("**Cod.Pago(Banelco/Link): 060377687") o partidos; probamos ambos.
    """
    ln = find_linea(lineas, r"Cod\.?Pago")
    if ln is None:
        return None
    m = _RE_COD_PAGO.search(ln.text)
    if m:
        return m.group(1)
    # Respaldo: el último token de dígitos de la línea de la etiqueta.
    for _, tok in reversed(ln.tokens):
        if re.fullmatch(r"\d{6,}", tok):
            return tok
    return None


def _linea_datos_servicio(lineas):
    """Línea del bloque DATOS SERVICIO con la forma "<serv 6d> <Venc> <Corte>".

    Es la que arranca con un entero de 6 dígitos seguido de DOS fechas (la
    primera es el Vencimiento buscado; la segunda, el Corte de Suministro).
    """
    for ln in lineas:
        if not ln.tokens:
            continue
        primer = ln.tokens[0][1]
        fechas = re.findall(r"\d{2}/\d{2}/\d{4}", ln.text)
        if re.fullmatch(r"\d{6}", primer) and len(fechas) >= 2:
            return ln
    return None


def _cliente_y_cuit(lineas) -> tuple[str | None, str | None]:
    """Razón social y CUIT del cliente ("CCC SA 30612790813").

    Se localiza la línea con un CUIT de 11 dígitos corridos cuyo texto previo es
    alfabético (excluye talones/códigos numéricos). El CUIT es el token de 11
    dígitos; el cliente es todo lo alfabético anterior.
    """
    for ln in lineas:
        m = _RE_CUIT_CLIENTE.search(ln.text)
        if not m:
            continue
        previos = [t for _, t in ln.tokens if t != m.group(1)]
        if previos and any(c.isalpha() for c in " ".join(previos)):
            return " ".join(previos).strip(), m.group(1)
    return None, None


def _domicilio_cobro(lineas) -> str | None:
    """Valor POSICIONAL bajo el encabezado "Domicilio de Cobro".

    Busca la fila inmediatamente inferior al encabezado y toma los tokens cuyo X
    cae bajo la columna del encabezado. ⚠️ En estos samples la celda está vacía
    (la fila siguiente es "E-Mail ..."), por lo que devuelve None. Nunca se cae al
    "Domicilio de Suministro".
    """
    ln_hdr = find_linea(lineas, r"Domicilio\s+de\s+Cobro")
    if ln_hdr is None:
        return None
    # X de arranque del encabezado "Domicilio" (col. izquierda de esa celda).
    x_ini = ln_hdr.tokens[0][0]
    # X donde empieza la siguiente columna ("Localidad") → límite derecho.
    x_fin = None
    for x0, tok in ln_hdr.tokens:
        if tok.lower().startswith("localidad"):
            x_fin = x0
            break
    # Buscamos la primera línea por debajo del encabezado (mayor Y).
    candidatas = [ln for ln in lineas if ln.y > ln_hdr.y]
    candidatas.sort(key=lambda l: l.y)
    for ln in candidatas:
        # Nos detenemos si llegamos al siguiente encabezado de sección.
        if re.search(r"Domicilio\s+de\s+Suministro", ln.text, re.IGNORECASE):
            break
        # Tokens que caen dentro de la columna de "Domicilio de Cobro".
        valor = [
            tok
            for x0, tok in ln.tokens
            if x0 >= x_ini - 2 and (x_fin is None or x0 < x_fin - 2)
        ]
        # Descartamos si lo único que hay es la etiqueta "E-Mail" u otra etiqueta
        # que no es una dirección real. Si no hay tokens alfabéticos, seguimos.
        texto = " ".join(valor).strip()
        if texto and not texto.lower().startswith("e-mail"):
            return texto
        # Sólo miramos la primera fila candidata; si está vacía, cortamos.
        break
    return None


def _emision_y_periodo(lineas) -> tuple[str | None, str | None]:
    """Fecha de Emisión y Período de la línea "04/06/2026 05/2026 20/07/2026".

    Es la fila directamente debajo del encabezado "Fecha de Emisión / Período /
    Próximo Vencimiento": una fecha DD/MM/YYYY (emisión) seguida de un período
    MM/YYYY suelto. El período se detecta con un lookbehind `(?<!/)` para NO
    confundirlo con el fragmento "06/2026" que vive dentro de una fecha completa
    (ej. la "Fecha de consulta 09/06/2026" del encabezado). Como respaldo, la
    primera línea que tenga ambos patrones.
    """
    # Período suelto: MM/YYYY que NO forma parte de una fecha DD/MM/YYYY (por eso
    # el token anterior no puede ser "/" ni un dígito).
    rx_periodo = re.compile(r"(?<![\d/])(\d{2}/\d{4})(?!/)")
    rx_emision = re.compile(r"\b(\d{2}/\d{2}/\d{4})\b")

    # 1) Preferimos la fila justo debajo del encabezado con "Fecha de Emisión".
    ln_hdr = find_linea(lineas, r"Fecha\s+de\s+Emisi[oó]n")
    if ln_hdr is not None:
        candidatas = sorted(
            (ln for ln in lineas if ln.y > ln_hdr.y), key=lambda l: l.y
        )
        for ln in candidatas:
            f_emision = rx_emision.search(ln.text)
            periodo = rx_periodo.search(ln.text)
            if f_emision and periodo:
                return fecha_iso(f_emision.group(1)), periodo.group(1)

    # 2) Respaldo: cualquier línea con ambos patrones.
    for ln in lineas:
        f_emision = rx_emision.search(ln.text)
        periodo = rx_periodo.search(ln.text)
        if f_emision and periodo:
            return fecha_iso(f_emision.group(1)), periodo.group(1)
    return None, None


def _otros_impuestos(lineas) -> float:
    """Suma ESTRICTA de "Ord.Mun.*" + "TIC-Art.*" de la tabla Impuestos y Tasas.

    Cada línea trae un único importe (el último monto). Sumamos sólo esas dos
    familias de conceptos; el resto de la tabla NO cuenta. 0.0 si no figuran.
    """
    total = 0.0
    for ln in find_lineas(lineas, r"Ord\.?\s*Mun\."):
        nums = montos_en(ln.text)
        if nums:
            total += nums[-1]
    for ln in find_lineas(lineas, r"TIC[-\s]*Art\."):
        nums = montos_en(ln.text)
        if nums:
            total += nums[-1]
    return round(total, 2)


def _percepcion_iibb(lineas) -> float | None:
    """Importe de la Percepción de Ingresos Brutos 3,5%.

    La línea es "Percep. Ing. Brutos 3,5% 5.317,39": contiene DOS montos (la
    alícuota "3,5" y el importe). `importe_percepcion` descarta la alícuota (número
    seguido de "%") y devuelve el importe — correcto incluso si el importe es 0,00
    (donde max()/último fallarían). None si no figura.
    """
    ln = find_linea(lineas, r"Percep.*Ing.*Brutos")
    if ln is None:
        return None
    return importe_percepcion(ln.text)


def _monto_total(lineas) -> float | None:
    """Monto total a pagar ("Total Factura 226.510,00" o "$ 226.510,00").

    Preferimos la banda "Total Factura <monto>" (y=657 en los samples), cuyo único
    monto es el total. Como respaldo, el encabezado "$ 226.510,00 $ 226.510,00"
    (dos montos iguales: Total Factura / Total a Pagar) — tomamos el último.
    """
    # 1) Línea "Total Factura <monto>" que efectivamente trae un monto en su banda.
    for ln in find_lineas(lineas, r"Total\s+Factura"):
        nums = montos_en(ln.text)
        if nums:
            return nums[-1]
    # 2) Respaldo: cualquier línea con "$" y montos (encabezado con el total).
    for ln in lineas:
        if "$" in ln.text:
            nums = montos_en(ln.text)
            if nums:
                return nums[-1]
    return None
