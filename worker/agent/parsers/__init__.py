"""Extracción DETERMINISTA de facturas (sin IA).

Parsers por proveedor que operan sobre la capa de texto nativa del PDF (PyMuPDF)
usando reconstrucción posicional de líneas — NO dependen de OpenAI.

Cada parser devuelve el MISMO schema Pydantic que usa `agent/extractor.py`
(`FacturaSEPSA`, `FacturaSoportes`, `FacturaEnergiaElectrica`, `FacturaRecaudacion`),
así que son drop-in: los flows de Playwright los consumen igual.

Punto de entrada: `extract_deterministico(pdf_path)` → schema Pydantic o None si el
formato no se reconoce (en cuyo caso el caller puede caer al extractor con IA).
"""
from __future__ import annotations

from pathlib import Path

from .base import clasificar, open_page1


def extract_deterministico(pdf_path: str | Path):
    """Intenta extraer la factura sin IA. Devuelve el schema Pydantic o None.

    None significa "formato no reconocido / parser no disponible" → el caller
    debería caer al extractor con visión (OpenAI). Una excepción del parser NO se
    traga acá: se deja propagar para que el caller la loguee y decida.
    """
    words, text = open_page1(pdf_path)
    tipo = clasificar(text)
    if tipo == "recaudacion_sepsa":
        from .sepsa import parse_sepsa
        return parse_sepsa(words, text)
    if tipo == "arrendamiento_soportes":
        from .soportes import parse_soportes
        return parse_soportes(words, text)
    if tipo == "energia_electrica":
        from .energia import parse_energia
        return parse_energia(words, text)
    if tipo == "recaudacion":
        from .gire import parse_gire
        return parse_gire(words, text)
    return None
