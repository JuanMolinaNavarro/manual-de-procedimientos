"""Extrae campos de una factura usando OpenAI con visión (GPT-4o).

Las imágenes de las páginas del PDF se renderizan con PyMuPDF (puro Python) y se
mandan al modelo vía `image_url` (data URL base64). De esta forma el modelo "ve"
la factura tal cual, sin depender de que un extractor de texto reconstruya bien
la maquetación (que es justo lo que falla con pdfplumber en algunos formatos).
"""
from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Iterable, Sequence, Union

import pymupdf
from openai import OpenAI

from .config import OPENAI_API_KEY, OPENAI_MODEL
from .schemas import FacturaEnergiaElectrica, FacturaRecaudacion, FacturaSoportes, FacturaSEPSA, FacturaUnion

PdfSource = Union[str, Path, Sequence[str]]

# Resolución a la que se renderizan las páginas del PDF antes de mandarlas al modelo.
# 150 dpi es buen balance entre detalle (CAE, CUITs, números de comprobante) y costo.
DEFAULT_DPI = 150

_BASE_SYSTEM_PROMPT = """\
Eres un experto en facturas de servicios públicos argentinos.

NOTA IMPORTANTE: para las facturas de EDET (energía eléctrica y arrendamiento
de soportes) **solo se procesa la primera página** del PDF. Toda la información
relevante (Nro Comprobante, fechas, totales, impuestos, NUM Servicio, CAE)
está siempre en esa primera página. Si te falta algún dato, es porque
realmente no está visible — NO inventes valores asumiendo que están en otra
página.

Vas a recibir dos fuentes complementarias del mismo documento:

  1) **El texto extraído** del PDF (puede tener saltos raros, columnas
     desordenadas o caracteres mal decodificados, pero los DÍGITOS suelen ser
     fieles al original).
  2) **Una o más IMÁGENES** de las páginas (en orden), que muestran el layout
     y los datos tal cual el ojo humano los ve.

**Usá las DOS como cross-check, especialmente para los NÚMEROS.** Cuando un
importe figura tanto en el texto como en la imagen, ambos deberían coincidir.
Si difieren, normalmente el TEXTO tiene mejor fidelidad numérica (es la
fuente directa del PDF) y la imagen sirve para entender el contexto / a qué
campo corresponde cada dato. Solo si el texto está cortado o ilegible, confiá
en lo que ves en la imagen.

Identificá el tipo de factura y extraé TODOS los campos disponibles usando la
herramienta correspondiente.

Reglas de clasificación:
- Si la factura es emitida por GIRE S.A. (CUIT 30-64399063-2):
  → usa registrar_factura_recaudacion
- Si la factura es emitida por SERVICIO ELECTRONICO DE PAGO S.A. / PagoFacil
  (CUIT 30-65986378-9):
  → usa registrar_factura_sepsa
- Si la factura es por "arrendamiento de soportes", "alquiler de soportes",
  "soportes para video cable", o muestra líneas "BT" / "MT" de arrendamiento:
  → usa registrar_factura_soportes
- Si la factura es de energía eléctrica (muestra consumo en kWh, cargo uso de red,
  cargo energía, CESP o similar):
  → usa registrar_factura_energia

Reglas de extracción:
- Mirá BIEN las cabeceras de la factura: el EMISOR suele estar arriba con su CUIT,
  domicilio y leyenda "IVA Responsable Inscripto". El CLIENTE suele estar en una
  sección "Datos Cliente" / "Sr./a:" con su propio CUIT, condición de IVA y
  domicilio.
- Si solo encontrás UN CUIT visible:
    * Si es el CUIT del proveedor de servicios (figura en el encabezado de la
      factura, junto a la razón social del emisor): usalo como `cuit_emisor`.
    * Si claramente corresponde al cliente (figura en "Sr./a", "Datos cliente",
      etc.): usalo como `cuit_cliente`.
    * Si dudás, completá el que SÍ podés identificar y dejá el otro en null.
- `numero_factura` debe incluir punto de venta y número (formato "PV-NUMERO",
  ej. "0031-00025245"), si ambos son visibles.
- `tipo_comprobante` es la letra: "A", "B", "C", etc.
- Fechas en formato YYYY-MM-DD (convertir desde DD/MM/YYYY o DD.MM.YYYY).
- Montos como número flotante sin signo $, sin puntos de miles, decimal con
  punto (ej. 46360.0). Aceptá "46.360,00" → 46360.00.
- Si una percepción o retención no figura, ponela en 0.0 (no null).
- Si un campo de texto no figura, dejalo en null.

CAMPOS CRÍTICOS — siempre tenés que extraerlos cuando son visibles:

- **`monto_total`**: el importe FINAL a pagar de la factura. Buscá etiquetas como
  "Total a Pagar", "Total Pagar", "Total Factura", "Total Final", o el importe
  más destacado al pie del documento. Toda factura tiene este valor — si no lo
  ves, mirá de nuevo. NO lo dejes en null si la factura es legible.

- **`fecha_vencimiento`**: la fecha de vencimiento de la FACTURA (no la del CAE).
  Aparece cerca del encabezado/total con etiquetas como "Vencimiento",
  "Fecha de Vencimiento", "Vto.", "Pago hasta", "Próximo Vencimiento", etc.
  Si la factura solo muestra una fecha de vencimiento (típicamente la del CAE),
  usá ESA misma fecha también acá — es muy común que coincidan.

- **`numero_servicio`**: el número de Servicio impreso en la factura (ej. "359411",
  "514832"). Suele estar arriba con etiquetas "SERVICIO", "Nro Servicio",
  "Servicio Nro", junto al período/fecha de emisión. **Es crítico para mapear
  el Centro de Costos** — siempre extraerlo cuando esté visible (aplica tanto
  a facturas de energía como de arrendamiento de soportes).

- **`subtotal_gravado`**: el subtotal neto (sin IVA, sin percepciones) sobre el
  cual se calculan los impuestos. Etiquetas: "Subtotal Gravado", "Neto Gravado",
  "Importe Gravado", o la suma de las líneas antes del IVA.
  ⚠️ Es **crítico** leer este número con MÁXIMA precisión dígito por dígito
  (es un campo donde los OCRs suelen equivocarse y arrastran error a todo el
  total). Verificá si tu lectura es coherente con la suma de las líneas de
  detalle (BT + MT, items, etc.) y con `subtotal_gravado * 1.27 ≈ subtotal + IVA`
  cuando el IVA es 27%. Si hay incongruencia, releelo del PDF.

- **`percepcion_rg3337`** y **`percepcion_ib_3_5_pct`**: percepciones de IVA y
  de Ingresos Brutos. Etiquetas: "Percepción RG 3337", "Percepción RG3337",
  "Percep. RG 3337" / "Percep. Ing. Brutos 3,5%", "Percepción IIBB 3.5%", etc.
  ⚠️ MISMO cuidado dígito por dígito que con `subtotal_gravado` — son números
  de 5-7 dígitos donde los OCRs suelen confundir dígitos contiguos (`077` vs `007`,
  `904` vs `049`, etc.). Releé cada cifra. Si la factura las muestra como
  porcentajes calculados, verificá que cuadren aproximadamente
  (`percepcion_rg3337 ≈ subtotal_gravado * 0.03`, `percepcion_ib_3_5_pct ≈
  subtotal_gravado * 0.035`). Si no coincide, releé los dígitos.

REGLA ESPECÍFICA — `domicilio_cobro` (solo facturas de energía eléctrica):

Extraé la línea bajo el rótulo "**Domicilio de Cobro**" de la sección DATOS
CLIENTE de la factura EDET. Es la calle + número/lote donde se cobra la factura
(ej. "9 De Julio 320", "Mza.D Lt.15 Bo.Apunt"). NO confundir con "Domicilio de
Suministro" (el lugar donde se entrega el servicio — esa data NO la queremos).
Si falta, dejar en null. Conservá la capitalización exacta del PDF.

REGLAS ESPECÍFICAS PARA FACTURAS DE ENERGÍA ELÉCTRICA (EDET y compatibles):

Estas facturas suelen tener una grilla de "Detalle de IVA" o líneas con las
bases gravadas por alícuota. Hay que extraer 4 importes específicos para que
el flow pueda cargar los items correctos:

- **`gravado_iva_27`**: base imponible (neto, sin IVA) sujeta a IVA 27%.
  Etiquetas típicas: "Neto Gravado 27%", "Base Imponible 27%", o la suma de
  las líneas que llevan IVA 27% ("Abastecimiento" + "Valor Agregado de
  Distribución" en EDET típica). Si la factura solo tiene IVA 27%, este
  valor ≈ `subtotal_gravado`. Poné 0 si no hay líneas a 27%.

- **`gravado_iva_21`**: base imponible sujeta a IVA 21%. Poné 0 si no aplica.

- **`gravado_iva_0`**: base imponible exenta de IVA (alícuota 0%). Poné 0 si
  no aplica.

- **`otros_impuestos_cargos`**: SUMA **estrictamente** de los conceptos
  "Ord. Mun." (Ordenanza Municipal — puede haber MÁS de una línea, p. ej.
  "Ord.Mun.926/98" + "Ord.Mun.2141/18") **+ "TIC Art" / "TIC-Art."** (Tasa de
  Inspección y Control). Nada más.
  ⛔ NO incluyas: "Imp. Nac. Ley 25.413" (ya viene dentro de `gravado_iva_27`),
  "Neto de Redondeo" (va en `subtotal_no_gravado`), "Aporte TIS", "Rec. Bajo
  Factor de Potencia", "Inv.Oblig.Dist/Tpte" (todos esos también van dentro del
  gravado). Sumá SOLO Ord.Mun.* + TIC-Art.*. Poné 0 si no aplica.
  ⚠️ Verificá tu suma dígito por dígito antes de devolverla.

- **`subtotal_no_gravado`**: el "Neto de Redondeo" o el SUBTOTAL NO GRAVADO de
  la factura (suele ser un valor pequeño, frecuentemente NEGATIVO, p. ej.
  -3,86). Aparece en la sección "Otros Conceptos" o como una línea separada
  rotulada "SUBTOTAL NO GRAVADO" / "Neto de Redondeo". Poné 0 si no figura.
  Conservá el signo (-).

Verificación de coherencia FINAL para energía:
`gravado_iva_27 + iva_27_pct + gravado_iva_21 + iva_21_pct (si hubiera) +
gravado_iva_0 + otros_impuestos_cargos + subtotal_no_gravado +
percepcion_rg3337 + percepcion_ib_3_5_pct ≈ monto_total` (tolerancia ~0.05).
Si no cuadra exacto, **releé las cifras de "Impuestos y Tasas" y "Otros
Conceptos"** — el error suele estar en `otros_impuestos_cargos` (suma mal
hecha) o en haber olvidado `subtotal_no_gravado`.

REGLAS ESPECIFICAS — Facturas GIRE (registrar_factura_recaudacion):

- `subtotal_gravado`: campo "SUBTOTAL" del comprobante GIRE.
- `percepcion_ib_3_5_pct`: SUMA de todas las percepciones IIBB.
  En GIRE aparecen en bloques "Operaciones realizadas en [Jurisdiccion]  [base]  [percepcion]".
  Suma el 2do importe de CADA bloque.
- `percepcion_rg3337`: percepcion de IVA (RG 3337) si figura, sino 0.0.
- `concepto`: descripcion del servicio.
- Coherencia: subtotal_gravado + IVA_21% + percepcion_rg3337 + percepcion_ib_3_5_pct ≈ monto_total

REGLAS ESPECIFICAS — Facturas SEPSA / PagoFacil (registrar_factura_sepsa):

CAMPOS DESTINATARIO (CRITICOS — no dejar en null si son visibles):
- `cliente`: razón social de la empresa DESTINATARIA que recibe la factura.
  En los PDFs SEPSA figura en una sección "Datos del Cliente", "Señor(es):",
  "Razón Social" o similar — es la empresa propia del grupo (ej. "PROVIDERS S.A.",
  "COMPANIA DE CIRCUITOS CERRADOS S A", "TAFI CABLE COLOR S.A.",
  "TARTAGAL COMUNICACIONES S.A.", "VALLE MEDIOS S.A.S", etc.).
  ⚠️ NO confundir con el EMISOR (SERVICIO ELECTRONICO DE PAGO S.A.).
  ⚠️ El destinatario NO es "PagoFácil" ni "SEPSA" — esos son el emisor.
- `cuit_cliente`: CUIT de esa empresa destinataria (no el de SEPSA).
  Formato XX-XXXXXXXX-X. Aparece junto al nombre del cliente.

Estructura de totales del PDF SEPSA:
  SUBTOTAL       → subtotal_gravado  (neto gravado, base del IVA 21%)
  I.V.A. 21 %   → iva_21            (= subtotal_gravado × 0.21)
  Otros Tributos → tabla con 0..N filas de percepciones IIBB
  Total Tributos → total_tributos   (suma de la tabla; NO es una fila de percepcion)
  Total          → monto_total      (= SUBTOTAL + I.V.A. 21% + Total Tributos)

CAMPO CRITICO — percepciones_iibb (lista):
  Lee CADA FILA de la tabla "Otros Tributos" individualmente.
  Cada fila tiene el formato: "IIBB Percepcion [Provincia] [alicuota]%  [importe]"
  Ejemplo con 2 filas:
    "IIBB Percepcion Santa Fe 2.5%     431,03"  → {provincia:"Santa Fe", alicuota_pct:2.5, importe:431.03}
    "IIBB Percepcion Tucuman 1.638%    282,40"  → {provincia:"Tucuman",  alicuota_pct:1.638, importe:282.40}
  Si la tabla esta vacia (como en TARTAGAL): percepciones_iibb = [] y total_tributos = 0.0.

  ⚠️ "Total Tributos" es el PIE de la tabla (suma de los importes) — NO crear
     una fila de percepcion para el. Solo va en el campo total_tributos.
  ⚠️ Las lineas "Operaciones en [Lugar]..." del cuerpo de la factura son
     DESCRIPTIVAS (breakdown de operaciones) — NO son percepciones IIBB.

Verificacion de coherencia SEPSA:
  sum(p.importe for p in percepciones_iibb) == total_tributos
  subtotal_gravado + iva_21 + total_tributos == monto_total
  Si no cuadra, releer la tabla "Otros Tributos" fila por fila.

REGLA FINAL DE COHERENCIA: una vez que extrajiste todos los importes, verificá
mentalmente que `monto_total ≈ subtotal_gravado + iva_27_pct + percepcion_rg3337
+ percepcion_ib_3_5_pct` (puede haber otros conceptos chicos como redondeo o
impuestos provinciales, así que admitir hasta ~$5 de diferencia). Si la suma
da MUY diferente al `monto_total`, hay algún número mal leído — volvé a mirar
las imágenes con más detalle.

Es crítico que NO inventes datos. Si algo realmente no es legible o no aparece,
null. Pero los campos críticos de arriba siempre deberían poder extraerse de
una factura completa.
"""

_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "registrar_factura_sepsa",
            "description": (
                "Registra una factura de recaudacion emitida por "
                "SERVICIO ELECTRONICO DE PAGO S.A. / PagoFacil "
                "(CUIT 30-65986378-9). Usa percepciones_iibb (lista) "
                "para las filas individuales de la tabla 'Otros Tributos'."
            ),
            "parameters": FacturaSEPSA.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "registrar_factura_recaudacion",
            "description": (
                "Registra una factura de recaudacion emitida por GIRE S.A. "
                "(CUIT 30-64399063-2)."
            ),
            "parameters": FacturaRecaudacion.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "registrar_factura_soportes",
            "description": "Registra una factura de arrendamiento o alquiler de soportes (BT/MT).",
            "parameters": FacturaSoportes.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "registrar_factura_energia",
            "description": "Registra una factura de energía eléctrica con detalle de consumo kWh.",
            "parameters": FacturaEnergiaElectrica.model_json_schema(),
        },
    },
]

_SCHEMA_MAP = {
    "registrar_factura_sepsa": FacturaSEPSA,
    "registrar_factura_recaudacion": FacturaRecaudacion,
    "registrar_factura_soportes": FacturaSoportes,
    "registrar_factura_energia": FacturaEnergiaElectrica,
}

_TIPO_FLUJO_MAP = {
    "registrar_factura_sepsa": "recaudacion_sepsa",
    "registrar_factura_recaudacion": "recaudacion",
    "registrar_factura_soportes": "arrendamiento_soportes",
    "registrar_factura_energia": "energia_electrica",
}


# ---------------------------------------------------------------------------
# Render de PDF a imágenes
# ---------------------------------------------------------------------------

def pdf_to_b64_pngs(
    pdf_path: Path | str,
    dpi: int = DEFAULT_DPI,
    max_pages: int | None = 1,
) -> list[str]:
    """Renderiza cada página del PDF como PNG y devuelve la lista de strings base64.

    Las páginas vacías (sin contenido visible) se descartan para no gastar tokens.

    `max_pages` limita cuántas páginas se renderizan. Default = 1 porque para
    facturas EDET (energía y arrendamiento de soportes — los únicos proveedores
    soportados hoy) la información relevante está SIEMPRE en la primera página.
    El resto suelen ser cupones de pago o términos y condiciones que no aportan
    nada y sí gastan tokens / pueden confundir al LLM con datos repetidos.
    Pasar None para extraer todas las páginas.
    """
    images: list[str] = []
    doc = pymupdf.open(str(pdf_path))
    try:
        mat = pymupdf.Matrix(dpi / 72, dpi / 72)
        for i, page in enumerate(doc):
            if max_pages is not None and i >= max_pages:
                break
            pix = page.get_pixmap(matrix=mat, alpha=False)
            # descartar páginas en blanco (samples uniformes)
            if pix.width < 20 or pix.height < 20:
                continue
            png_bytes = pix.tobytes("png")
            images.append(base64.b64encode(png_bytes).decode("ascii"))
    finally:
        doc.close()
    return images


def pdf_to_text(
    pdf_path: Path | str,
    max_chars: int = 20_000,
    max_pages: int | None = 1,
) -> str:
    """Extrae el texto del PDF (puro, sin layout) con PyMuPDF.

    `max_pages`: ver `pdf_to_b64_pngs`. Default = 1 (solo página 1) porque para
    facturas EDET el resto es irrelevante. Pasar None para todas las páginas.
    """
    parts: list[str] = []
    doc = pymupdf.open(str(pdf_path))
    try:
        for i, page in enumerate(doc):
            if max_pages is not None and i >= max_pages:
                break
            txt = (page.get_text() or "").strip()
            if not txt:
                parts.append(f"--- Página {i+1} (sin texto extraíble) ---")
            else:
                parts.append(f"--- Página {i+1} ---\n{txt}")
    finally:
        doc.close()
    full = "\n\n".join(parts)
    return full[:max_chars]


# ---------------------------------------------------------------------------
# Llamada al modelo
# ---------------------------------------------------------------------------

def _build_user_content(
    images: Iterable[str],
    text: str | None = None,
    hint: str | None = None,
) -> list[dict]:
    content: list[dict] = []
    intro = (
        "Analizá la factura adjunta (texto + imágenes) y extraé los campos "
        "correspondientes invocando la herramienta correcta. Usá las dos "
        "fuentes para cross-check, sobre todo en los números (CUITs, importes, "
        "fechas, número de comprobante, CAE)."
    )
    if hint:
        intro += f"\n\nPista: {hint}"
    content.append({"type": "text", "text": intro})

    if text and text.strip():
        content.append({
            "type": "text",
            "text": (
                "=== TEXTO EXTRAÍDO DEL PDF (fuente A — fidelidad numérica alta) ===\n"
                + text +
                "\n=== FIN DEL TEXTO EXTRAÍDO ==="
            ),
        })

    for img_b64 in images:
        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/png;base64,{img_b64}",
                "detail": "high",
            },
        })
    return content


def extract(
    pdf_or_images: PdfSource,
    text: str | None = None,
    provider_context: str | None = None,
) -> FacturaUnion:
    """Llama a GPT-4o con visión + texto y retorna el schema Pydantic.

    Args:
        pdf_or_images: Path al PDF, o lista de páginas ya renderizadas en base64
            (para evitar re-renderizar cuando se invoca varias veces).
        text: texto del PDF (extraído con ``pdf_to_text``). Si es None y se pasa
            un Path, se extrae automáticamente. Si se pasan imágenes ya
            renderizadas y este parámetro queda en None, no se manda texto.
        provider_context: bloque opcional de contexto del proveedor (generado por
            ``knowledge_base.build_context_for_prompt``) para mejorar la
            clasificación/extracción cuando ya se identificó al proveedor.
    """
    if isinstance(pdf_or_images, (str, Path)):
        path = Path(pdf_or_images)
        images = pdf_to_b64_pngs(path)
        if text is None:
            text = pdf_to_text(path)
    else:
        images = list(pdf_or_images)

    if not images:
        raise ValueError("No se pudieron renderizar páginas del PDF")

    client = OpenAI(api_key=OPENAI_API_KEY)

    system_prompt = _BASE_SYSTEM_PROMPT
    if provider_context:
        system_prompt += f"\n\nCONTEXTO DEL PROVEEDOR (ya identificado):\n{provider_context}"

    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": _build_user_content(images, text=text)},
        ],
        tools=_TOOLS,
        tool_choice="required",
    )

    msg = response.choices[0].message
    if not msg.tool_calls:
        raise ValueError("OpenAI no invocó ninguna herramienta. Respuesta: " + str(msg))

    call = msg.tool_calls[0]
    schema_cls = _SCHEMA_MAP.get(call.function.name)
    if schema_cls is None:
        raise ValueError(f"Herramienta desconocida: {call.function.name}")

    args = json.loads(call.function.arguments)
    args["tipo_flujo"] = _TIPO_FLUJO_MAP[call.function.name]
    return schema_cls(**args)
