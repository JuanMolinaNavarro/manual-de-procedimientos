"""Reconciliación determinística de importes extraídos de una factura.

Objetivo: detectar, apenas se extrae una factura, si la suma de los importes NO
cuadra con el `monto_total` declarado, para poder REINTENTAR la extracción con un
hint dirigido (y así corregir errores típicos de un dígito que comete el LLM).

IMPORTANTE: esto NO bloquea ni decide nada por su cuenta. Finnegans auto-calcula
el IVA por producto, así que una recomputación en Python puede no coincidir
exactamente con el cálculo interno de Finnegans (redondeo/ajuste de IVA). Por eso
el resultado de este módulo solo se usa para DISPARAR un reintento de extracción y
para loguear. El control de total de Finnegans sigue siendo el único árbitro real
del descuadre.

El `esperado` se calcula replicando las mismas líneas que carga cada flow:
  - energia_electrica: bases gravadas * (1 + alícuota) + otros + no_gravado + percepciones
  - arrendamiento_soportes: subtotal_gravado * 1.27 + percepciones
  - recaudacion_sepsa: subtotal_gravado + iva_21 + total_tributos (IVA/tributos extraídos)
  - recaudacion (GIRE) / desconocido: no se reconcilia (monto_total heurístico).
"""
from __future__ import annotations

from typing import Optional

# Tolerancia (en $) para considerar que la suma "cuadra". Coincide con el umbral
# de auto-ajuste del flow (AJUSTE_THRESHOLD): diferencias <= $1 las resuelve el
# flow o son redondeo; mayores valen la pena reintentar.
TOLERANCIA = 1.0


def _f(x) -> float:
    """Float tolerante: None / '' / no numérico -> 0.0."""
    if x is None or x == "":
        return 0.0
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def _desglose(datos: dict, tipo_flujo: str) -> Optional[list[tuple[str, float]]]:
    """Lista de (etiqueta, aporte_al_total) replicando las líneas que carga el
    flow. El total esperado es la suma de los aportes. None si el flujo no aplica.

    Cada aporte ya incluye el IVA cuando corresponde (p.ej. la base gravada al
    27% aporta base*1.27), para que la suma sea comparable contra monto_total.
    """
    if tipo_flujo == "energia_electrica":
        return [
            ("gravado_iva_27 +IVA27%", round(_f(datos.get("gravado_iva_27")) * 1.27, 2)),
            ("gravado_iva_21 +IVA21%", round(_f(datos.get("gravado_iva_21")) * 1.21, 2)),
            ("gravado_iva_0", _f(datos.get("gravado_iva_0"))),
            ("otros_impuestos_cargos", _f(datos.get("otros_impuestos_cargos"))),
            ("subtotal_no_gravado", _f(datos.get("subtotal_no_gravado"))),
            ("percepcion_ib_3_5_pct", _f(datos.get("percepcion_ib_3_5_pct"))),
            ("percepcion_rg3337", _f(datos.get("percepcion_rg3337"))),
        ]
    if tipo_flujo == "arrendamiento_soportes":
        return [
            ("subtotal_gravado +IVA27%", round(_f(datos.get("subtotal_gravado")) * 1.27, 2)),
            ("percepcion_ib_3_5_pct", _f(datos.get("percepcion_ib_3_5_pct"))),
            ("percepcion_rg3337", _f(datos.get("percepcion_rg3337"))),
        ]
    if tipo_flujo == "recaudacion_sepsa":
        # POR PARTES (no usa total_tributos) para detectar si falta una
        # percepción cuando su split IIBB/RG3337 está mal (ver backstop 3%).
        iibb_rows = datos.get("percepciones_iibb") or []
        iibb_sum = sum(
            _f((p if isinstance(p, dict) else p.model_dump()).get("importe"))
            for p in iibb_rows
        )
        return [
            ("subtotal_gravado", _f(datos.get("subtotal_gravado"))),
            ("iva_21", _f(datos.get("iva_21"))),
            ("IIBB (jurisdicciones)", round(iibb_sum, 2)),
            ("percepcion_rg3337", _f(datos.get("percepcion_rg3337"))),
        ]
    if tipo_flujo == "recaudacion":
        # GIRE: item Recaudación con IVA 21% + percepción IVA (RG3337) + IIBB por
        # jurisdicción. Se usa la suma del desglose si vino; sino el total IIBB.
        iibb_rows = datos.get("percepciones_iibb") or []
        iibb_sum = sum(
            _f((p if isinstance(p, dict) else p.model_dump()).get("importe"))
            for p in iibb_rows
        )
        return [
            ("subtotal_gravado +IVA21%", round(_f(datos.get("subtotal_gravado")) * 1.21, 2)),
            ("percepcion_rg3337", _f(datos.get("percepcion_rg3337"))),
            ("IIBB (jurisdicciones)", round(iibb_sum, 2)),
        ]
    # Desconocido: no reconciliar.
    return None


def _esperado(datos: dict, tipo_flujo: str) -> Optional[float]:
    """Total esperado replicando las líneas que carga el flow, o None si no aplica."""
    desglose = _desglose(datos, tipo_flujo)
    if desglose is None:
        return None
    return round(sum(aporte for _, aporte in desglose), 2)


def reconciliar_importes(datos: dict, tipo_flujo: Optional[str]) -> Optional[dict]:
    """Compara la suma de importes esperada contra `monto_total`.

    Devuelve None si no se puede chequear (sin monto_total o flujo no soportado).
    Sino, un dict {necesita_retry, esperado, monto_total, diff, tipo_flujo}.
    """
    if not tipo_flujo:
        return None
    mt_raw = datos.get("monto_total")
    if mt_raw is None or mt_raw == "" or _f(mt_raw) == 0.0:
        return None  # sin target confiable -> no se puede reconciliar
    desglose = _desglose(datos, tipo_flujo)
    if desglose is None:
        return None
    esperado = round(sum(aporte for _, aporte in desglose), 2)
    monto_total = round(_f(mt_raw), 2)
    diff = round(monto_total - esperado, 2)
    return {
        "necesita_retry": abs(diff) > TOLERANCIA,
        "esperado": esperado,
        "monto_total": monto_total,
        "diff": diff,
        "tipo_flujo": tipo_flujo,
        "desglose": desglose,
    }


# Campos sospechosos por flujo para guiar el reintento del LLM.
_CAMPOS_SOSPECHOSOS = {
    "energia_electrica": (
        "otros_impuestos_cargos (suma de Ord.Mun. + TIC Art), subtotal_no_gravado "
        "(Neto de Redondeo) y gravado_iva_27"
    ),
    "arrendamiento_soportes": "subtotal_gravado",
    "recaudacion_sepsa": (
        "subtotal_gravado, iva_21 y las filas de la tabla 'Otros Tributos' "
        "(total_tributos)"
    ),
    "recaudacion": (
        "percepcion_rg3337 (Percepción de IVA RG3337, suele ser ~3% del "
        "subtotal_gravado y a veces se omite), y las percepciones_iibb por "
        "jurisdicción (Operaciones realizadas en ...)"
    ),
}


def hint_reconciliacion(recon: dict) -> str:
    """Arma un hint dirigido para el reintento de extracción."""
    campos = _CAMPOS_SOSPECHOSOS.get(recon.get("tipo_flujo", ""), "los importes")
    return (
        f"VERIFICACIÓN DE IMPORTES: con los valores que extrajiste, la suma da "
        f"{recon['esperado']:.2f} pero el Total de la factura es "
        f"{recon['monto_total']:.2f} (diferencia {recon['diff']:+.2f}). Algún "
        f"importe está mal leído. Revisá DÍGITO POR DÍGITO, especialmente: "
        f"{campos}. Corregí el/los valor(es) y devolvé los datos consistentes con "
        f"el Total."
    )


def _tiene_caba(percepciones_iibb: list) -> bool:
    for p in percepciones_iibb:
        prov = (p if isinstance(p, dict) else p.model_dump()).get("provincia") or ""
        prov = prov.lower()
        if "caba" in prov or "buenos aires" in prov or "capital fed" in prov:
            return True
    return False


def completar_percepcion_iva_3pct(datos: dict, recon: Optional[dict]) -> bool:
    """Backstop determinístico para la confusión CABA-IIBB == RG3337 (ambas 3%).

    En recaudación (GIRE/SEPSA) la Percepción de II.BB. CABA (Padrón) y la
    Percepción de IVA RG3337 tienen alícuota 3%, así que sobre la misma base dan
    el mismo importe y el LLM a veces las fusiona, dejando una afuera. Como
    RG3337 = round(subtotal*0.03, 2) es regla fija, si falta exactamente ~3% del
    subtotal se completa el lado ausente. Muta `datos` y devuelve True si corrigió.
    """
    if not recon or not recon.get("necesita_retry"):
        return False
    if recon.get("tipo_flujo") not in ("recaudacion", "recaudacion_sepsa"):
        return False
    subtotal = _f(datos.get("subtotal_gravado"))
    if subtotal <= 0:
        return False
    tres_pct = round(subtotal * 0.03, 2)
    # El faltante (monto - esperado) debe ser ~3% del subtotal para activar.
    if abs(_f(recon.get("diff")) - tres_pct) > TOLERANCIA:
        return False
    rg = _f(datos.get("percepcion_rg3337"))
    iibb = datos.get("percepciones_iibb") or []
    if rg <= 0:
        # El RG3337 fue el que se "comió" por ser igual a la CABA IIBB.
        datos["percepcion_rg3337"] = tres_pct
        return True
    if not _tiene_caba(iibb):
        # El RG3337 está, pero faltó la fila CABA IIBB (Padrón).
        datos.setdefault("percepciones_iibb", [])
        datos["percepciones_iibb"].append(
            {
                "provincia": "Ciudad Autonoma de Buenos Aires",
                "alicuota_pct": 3.0,
                "importe": tres_pct,
            }
        )
        return True
    return False
