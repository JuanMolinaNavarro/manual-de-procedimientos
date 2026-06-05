from __future__ import annotations

from typing import Literal, Union

from pydantic import BaseModel, Field

# Filosofía: hacer Optional todos los campos que pueden faltar legítimamente en
# distintos tipos de facturas (Factura B/C sin CUIT cliente, proveedores que no
# son EDET y por lo tanto no tienen "importe_bt"/"importe_mt", facturas contado
# sin "fecha_vencimiento", etc.). Los flows de Playwright ya manejan campos
# vacíos/None con .get() y guardas. Mantener required solo lo que el flow
# necesita SIEMPRE para poder hacer la carga.


class FacturaSoportes(BaseModel):
    """Factura de arrendamiento o alquiler de soportes (EDET y compatibles).

    Campos consumidos hoy por `agent/flows/soportes.py`:
      numero_factura, tipo_comprobante, cliente, fecha_emision, concepto,
      subtotal_gravado, percepcion_rg3337, percepcion_ib_3_5_pct,
      cae, fecha_vencimiento_cae.

    `importe_bt` / `importe_mt` / `iva_27_pct` / `monto_total` siguen siendo
    extraídos por compatibilidad pero el flow ya NO los usa (IVA lo auto-calcula
    FinnegansGO). Por eso se permiten ausentes.
    """

    tipo_flujo: Literal["arrendamiento_soportes"]

    # Identificación del proveedor — `emisor` casi siempre está; `cuit_emisor`
    # se usa para hacer lookup, lookup_provider acepta None.
    emisor: str | None = None
    cuit_emisor: str | None = None

    # Número y tipo de comprobante — necesarios para el flow.
    numero_factura: str
    tipo_comprobante: str

    # Número de Servicio (impreso en la factura, ej. "359411"). Se usa para
    # mapear el Centro de Costos via agent/knowledge/centros_costo.json.
    numero_servicio: str | None = None

    # Cliente — `cliente` se usa para Destinatario (si falta, se omite).
    # `cuit_cliente` se usa solo para lookup_company y puede no figurar en
    # Factura B/C → Optional.
    cliente: str | None = None
    cuit_cliente: str | None = None

    # Periodo / fechas — fecha_emision es la única realmente crítica.
    periodo: str | None = None
    fecha_emision: str  # YYYY-MM-DD — necesaria
    fecha_vencimiento: str | None = None  # YYYY-MM-DD

    # Concepto / descripción — el flow lo usa para wdg_Descripcion (si falta, vacío).
    concepto: str | None = None

    # Importes — solo subtotal_gravado es realmente crítico (va al item).
    # Los desgloses BT/MT son específicos de EDET; otros proveedores no los tienen.
    importe_bt: float | None = None
    importe_mt: float | None = None
    subtotal_gravado: float
    iva_27_pct: float | None = None
    percepcion_rg3337: float | None = 0.0
    percepcion_ib_3_5_pct: float | None = 0.0
    monto_total: float | None = None

    # Datos AFIP — solo en Factura A.
    cae: str | None = None
    fecha_vencimiento_cae: str | None = None  # YYYY-MM-DD


class FacturaEnergiaElectrica(BaseModel):
    """Factura de energía eléctrica EDET (y compatibles).

    El flow de carga (`agent/flows/energia.py`) usa, para los items:
      - `gravado_iva_27` → item "ENERGIA IVA 27%" (producto EDETENE)
      - `gravado_iva_21` → item "ENERGIA IVA 21%" (producto EDESA21)
      - `gravado_iva_0`  → item "ENERGIA IVA 0%"  (producto EDESAEXE)
      - `otros_impuestos_cargos` → item "Otros Impuestos y cargos"
        (suma de "Ord. Mun." + "TIC Art")
    Cada item se carga sólo si el campo correspondiente es > 0.

    `subtotal_abastecimiento` / `subtotal_valor_agregado` / `iva_27_pct` se
    siguen extrayendo por compatibilidad / cross-check, pero el flow no los usa
    para llenar items.
    """

    tipo_flujo: Literal["energia_electrica"]

    emisor: str | None = None
    cuit_emisor: str | None = None
    numero_factura: str
    tipo_comprobante: str | None = None
    numero_servicio: str | None = None
    cliente: str | None = None
    cuit_cliente: str | None = None
    # `domicilio_cobro` es la dirección donde se cobra la factura (NO el de
    # suministro). En facturas EDET aparece bajo "Domicilio de Cobro".
    # Se usa para armar la Descripción que carga en Finnegans:
    #   wdg_Descripcion = f"{domicilio_cobro} {periodo}"
    domicilio_cobro: str | None = None
    periodo: str | None = None
    fecha_emision: str  # YYYY-MM-DD
    fecha_vencimiento: str | None = None  # YYYY-MM-DD
    tarifa: str | None = None
    consumo_activo_kwh: float | None = None
    importe_cargo_uso_red: float | None = None
    importe_cargo_energia: float | None = None
    subtotal_abastecimiento: float | None = None
    subtotal_valor_agregado: float | None = None
    iva_27_pct: float | None = None

    # Bases gravadas por alícuota de IVA — usadas como precio de cada item.
    # El "Imp. Nac." de la factura ya viene incluido dentro de estos gravados
    # (no se carga como item separado).
    gravado_iva_27: float | None = 0.0
    gravado_iva_21: float | None = 0.0
    gravado_iva_0: float | None = 0.0

    # Suma de "Ord. Mun." + "TIC Art" → item "Otros Impuestos y cargos".
    # NO incluye "Neto de Redondeo" ni "Imp. Nac." (ese ya viene en el gravado).
    otros_impuestos_cargos: float | None = 0.0

    # "Neto de Redondeo" / SUBTOTAL NO GRAVADO de la factura. Puede ser negativo.
    # Se carga como item con el producto "Servicio Energia Fuente/ Oficina No
    # Gravado" cuando es != 0.
    subtotal_no_gravado: float | None = 0.0

    percepcion_rg3337: float | None = 0.0
    percepcion_ib_3_5_pct: float | None = 0.0
    monto_total: float | None = None
    cae: str | None = None
    fecha_vencimiento_cae: str | None = None
    cod_pago_banelco: str | None = None
    cesp: str | None = None


class PercepcionIIBBSEPSA(BaseModel):
    """Una fila de percepción IIBB por jurisdicción (usada por SEPSA y GIRE)."""

    provincia: str       # Nombre tal como figura en el PDF (ej. "Tucuman", "Santa Fe")
    # Alicuota en %, ej. 5.0, 2.5, 1.638. Opcional: en GIRE a veces no figura
    # impresa. El flow de carga no la usa (solo provincia + importe).
    alicuota_pct: float | None = None
    importe: float       # Importe en ARS


class FacturaRecaudacion(BaseModel):
    """Factura de recaudación GIRE / SEPSA (PagoFácil).

    Emitidas por GIRE S.A. (CUIT 30-64399063-2) o por SERVICIO ELECTRONICO
    DE PAGO S.A. / PagoFácil (CUIT 30-65986378-9). Son facturas de débito
    automático donde el servicio facturado es recaudación/cobranza.

    Campos consumidos por `agent/flows/recaudacion.py`:
      numero_factura, tipo_comprobante, cliente, cuit_cliente,
      fecha_emision, fecha_vencimiento, concepto, subtotal_gravado,
      percepcion_rg3337, percepcion_ib_3_5_pct, monto_total,
      cae, fecha_vencimiento_cae.
    """

    tipo_flujo: Literal["recaudacion"]

    # Identificación del emisor.
    emisor: str | None = None
    cuit_emisor: str | None = None

    # Número y tipo de comprobante (necesarios para el flow).
    numero_factura: str
    tipo_comprobante: str

    # Cliente (empresa propia que recibe la factura).
    cliente: str | None = Field(
        None,
        description=(
            "Razón social de la empresa DESTINATARIA, es decir la empresa propia "
            "que recibe esta factura de recaudación (ej. 'PROVIDERS S.A.', "
            "'COMPANIA DE CIRCUITOS CERRADOS S A', 'TAFI CABLE COLOR S.A.'). "
            "Aparece en la sección 'Datos del Cliente', 'Señor(es)', 'Razón Social' "
            "del destinatario en el PDF. Es DISTINTA al emisor (GIRE)."
        ),
    )
    cuit_cliente: str | None = Field(
        None,
        description=(
            "CUIT de la empresa destinataria (el cliente, no el emisor). "
            "Formato XX-XXXXXXXX-X. Aparece junto al nombre del cliente en el PDF."
        ),
    )

    # Fechas.
    fecha_emision: str  # YYYY-MM-DD
    fecha_vencimiento: str | None = None  # YYYY-MM-DD

    # Descripción del servicio (ej. "Recaudación enero 2026").
    concepto: str | None = None

    # Subtotal neto (base imponible antes de IVA y percepciones).
    # GIRE: campo "SUBTOTAL" del resumen.
    # SEPSA: campo "SUBTOTAL" de la tabla de totales (neto IVA 21%).
    subtotal_gravado: float

    # Percepción RG 3337 (IVA) ≈ subtotal_gravado × 3%.
    percepcion_rg3337: float | None = 0.0

    # Desglose de percepciones IIBB por jurisdicción. REGLA CRÍTICA: una fila por
    # cada bloque "Operaciones realizadas en [Jurisdicción]" del PDF GIRE (ej.
    # CABA + Tucumán). El importe de cada fila es la PERCEPCIÓN de esa
    # jurisdicción (no la base). Si la factura es de una sola jurisdicción, traé
    # esa única fila. Si no se puede desglosar, dejar [] (el flow usa el total).
    percepciones_iibb: list[PercepcionIIBBSEPSA] = []

    # Importe final a pagar.
    monto_total: float | None = None

    # Datos AFIP.
    cae: str | None = None
    fecha_vencimiento_cae: str | None = None  # YYYY-MM-DD


class FacturaSEPSA(BaseModel):
    """Factura de recaudacion emitida por SERVICIO ELECTRONICO DE PAGO S.A. (PagoFacil).

    Estructura de totales en el PDF SEPSA:
      SUBTOTAL        = neto gravado (base del IVA 21%)
      I.V.A. 21 %     = subtotal_gravado * 0.21  (FinnegansGO lo calcula automatico)
      Otros Tributos  = tabla con 0, 1 o N filas de percepciones IIBB por provincia
      Total Tributos  = suma de filas de Otros Tributos (NO es una percepcion)
      Total           = SUBTOTAL + I.V.A. 21% + Total Tributos

    Las lineas "Operaciones en ..." del cuerpo de la factura son descriptivas;
    su suma ya esta incluida en SUBTOTAL — no confundirlas con percepciones.

    El flow sepsa.py carga:
      - 1 item "Recaudacion" con precio = subtotal_gravado
      - 1 retencion IIBB por cada fila de percepciones_iibb (puede ser 0)
      - Total de control = monto_total
    """

    tipo_flujo: Literal["recaudacion_sepsa"]

    emisor: str | None = None
    cuit_emisor: str | None = None
    numero_factura: str
    tipo_comprobante: str = "A"
    cliente: str | None = Field(
        None,
        description=(
            "Razón social de la empresa DESTINATARIA, es decir la empresa propia "
            "que recibe esta factura de SEPSA/PagoFácil (ej. 'PROVIDERS S.A.', "
            "'COMPANIA DE CIRCUITOS CERRADOS S A', 'TAFI CABLE COLOR S.A.', "
            "'TARTAGAL COMUNICACIONES S.A.', 'VALLE MEDIOS S.A.S'). "
            "Aparece en la sección 'Datos del Cliente', 'Señor(es)', 'Razón Social' "
            "del destinatario en el PDF. Es DISTINTA al emisor (SEPSA/PagoFácil)."
        ),
    )
    cuit_cliente: str | None = Field(
        None,
        description=(
            "CUIT de la empresa destinataria (el cliente, no SEPSA). "
            "Formato XX-XXXXXXXX-X. Aparece junto al nombre del cliente en el PDF."
        ),
    )
    fecha_emision: str            # YYYY-MM-DD
    fecha_vencimiento: str | None = None

    concepto: str | None = None

    # Campo SUBTOTAL del PDF.
    subtotal_gravado: float

    # Campo I.V.A. 21% del PDF. Se extrae para validacion cruzada.
    iva_21: float

    # Filas de IIBB de la tabla "Otros Tributos" (una por jurisdicción).
    # REGLA CRITICA: leer CADA FILA IIBB por separado.
    #   La fila de Percepción de IVA RG3337 (3%) NO va acá -> va en percepcion_rg3337.
    #   "Total Tributos" es el pie de la tabla (suma) — NO incluirlo como fila.
    #   Si no hay filas IIBB -> lista vacia [].
    percepciones_iibb: list[PercepcionIIBBSEPSA] = []

    # Percepción de IVA RG3337 (alícuota 3% ≈ subtotal_gravado * 0.03), si figura
    # como fila en "Otros Tributos". Se carga como línea propia (Percepción de IVA),
    # igual que en EDET/GIRE. 0.0 si no figura.
    percepcion_rg3337: float | None = 0.0

    # Campo "Total Tributos" del PDF = SUMA de TODAS las filas de "Otros Tributos"
    # (IIBB de todas las jurisdicciones + Percepción de IVA RG3337).
    total_tributos: float = 0.0

    # Campo "Total" del PDF (= SUBTOTAL + I.V.A. 21% + Total Tributos).
    monto_total: float

    cae: str | None = None
    fecha_vencimiento_cae: str | None = None


FacturaUnion = Union[FacturaSoportes, FacturaEnergiaElectrica, FacturaRecaudacion, FacturaSEPSA]
