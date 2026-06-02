"""
CLI principal del agente de facturas.

Uso:
  python -m agent.main --pdf facturas/246910.pdf
  python -m agent.main --dir facturas/
  python -m agent.main --pdf facturas/246910.pdf --cargar --empresa Prueba
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from .extractor import extract, pdf_to_b64_pngs, pdf_to_text
from .knowledge_base import (
    build_context_for_prompt,
    lookup_company,
    lookup_provider,
    record_example,
    register_new_company,
    register_new_provider,
)


def process_pdf(pdf_path: Path) -> dict:
    print(f"\nâ†’ Procesando: {pdf_path.name}", file=sys.stderr)

    # Renderizamos imÃ¡genes Y extraemos texto una sola vez (extract se llama hasta 2 veces).
    # Mandar ambas fuentes al modelo permite cross-checking de nÃºmeros (CUITs, importes,
    # CAE) y mitiga errores de OCR de la imagen y de parsing del texto.
    images = pdf_to_b64_pngs(pdf_path)
    if not images:
        raise ValueError(f"No se pudieron renderizar pÃ¡ginas del PDF: {pdf_path}")
    text = pdf_to_text(pdf_path)
    print(
        f"   PDF: {len(images)} pÃ¡gina(s) renderizada(s) + {len(text)} chars de texto",
        file=sys.stderr,
    )

    # 1. Primera extracciÃ³n sin contexto (necesaria para obtener cuit_emisor)
    factura = extract(images, text=text)
    result = factura.model_dump()

    # 2. Lookup del PROVEEDOR usando cuit_emisor
    provider = lookup_provider(
        cuit=result.get("cuit_emisor"),
        nombre=result.get("emisor"),
    )

    # 3. Lookup de la EMPRESA PROPIA usando cuit_cliente (validaciÃ³n)
    company = lookup_company(
        cuit=result.get("cuit_cliente"),
        nombre=result.get("cliente"),
    )

    # 4. Log de lo que encontramos
    if provider:
        print(f"   Proveedor:      {provider['razon_social']} (CUIT {provider['cuit']})", file=sys.stderr)
    else:
        print(f"   Proveedor:      '{result.get('emisor')}' CUIT {result.get('cuit_emisor')} â€” NO encontrado", file=sys.stderr)

    if company:
        print(f"   Empresa propia: {company['razon_social']} (CUIT {company['cuit']})", file=sys.stderr)
    else:
        print(f"   Empresa propia: '{result.get('cliente')}' CUIT {result.get('cuit_cliente')} â€” NO encontrada", file=sys.stderr)

    # 5. Si el proveedor ya es conocido: re-extraer con contexto enriquecido
    if provider:
        context = build_context_for_prompt(provider)
        factura = extract(images, text=text, provider_context=context)
        result = factura.model_dump()

        result["_provider_id"] = provider["id"]
        result["_nombre_finnegans"] = provider["nombre_finnegans"]
        result["_estado"] = "listo"
        record_example(provider["id"], pdf_path.name, factura.tipo_flujo)

    else:
        # Proveedor desconocido: registrar como borrador
        emisor = (result.get("emisor") or "DESCONOCIDO").strip()
        cuit_emisor = (result.get("cuit_emisor") or "SIN_CUIT").strip()

        nuevo_id = register_new_provider(
            razon_social=emisor,
            cuit=cuit_emisor,
            tipos_factura=[factura.tipo_flujo],
            notas=f"Creado automÃ¡ticamente al procesar {pdf_path.name}. Requiere verificaciÃ³n.",
        )

        result["_provider_id"] = nuevo_id
        result["_nombre_finnegans"] = "PENDIENTE_VERIFICAR"
        result["_estado"] = "revision_requerida"

        print(
            f"\n   âš ï¸  PROVEEDOR NUEVO: '{emisor}' registrado como borrador (id: {nuevo_id}).\n"
            f"   Completar 'nombre_finnegans' en:\n"
            f"   agent/knowledge/providers/{nuevo_id}.json",
            file=sys.stderr,
        )

    # 6. Si la empresa propia no es conocida: registrarla como nueva
    if not company and result.get("cliente") and result.get("cuit_cliente"):
        nuevo_company_id = register_new_company(
            razon_social=result["cliente"],
            cuit=result["cuit_cliente"],
            notas=f"Detectada automÃ¡ticamente en {pdf_path.name}. Verificar si es empresa propia.",
        )
        print(
            f"\n   â„¹ï¸  EMPRESA NUEVA: '{result['cliente']}' registrada para revisiÃ³n.\n"
            f"   agent/knowledge/companies/{nuevo_company_id}.json",
            file=sys.stderr,
        )

    return result


async def _cargar(result: dict, empresa: str, pdf_path: Path | None = None) -> dict:
    """Despacha al flow de Playwright correcto segÃºn tipo_flujo (modo single-shot)."""
    provider_id = (result.get("_provider_id") or "").strip().lower()
    tipo = result.get("tipo_flujo")
    if tipo == "recaudacion_sepsa" or provider_id == "servicio_electronico_de_pago_s_a":
        from .flows.sepsa import cargar_sepsa
        return await cargar_sepsa(result, pdf_path=pdf_path, empresa=empresa)
    if provider_id == "gire" or tipo == "recaudacion":
        from .flows.gire import cargar_gire
        return await cargar_gire(result, pdf_path=pdf_path, empresa=empresa)

    if tipo == "arrendamiento_soportes":
        from .flows.soportes import cargar_arrendamiento_soportes
        return await cargar_arrendamiento_soportes(result, pdf_path=pdf_path, empresa=empresa)
    elif tipo == "energia_electrica":
        from .flows.energia import cargar_energia_electrica
        return await cargar_energia_electrica(result, pdf_path=pdf_path, empresa=empresa)
    else:
        return {"exito": False, "mensaje": f"Tipo de flujo desconocido: {tipo}", "nro_interno": None}


async def _cargar_batch(items: list[tuple[Path, dict]], empresa: str | None) -> list[tuple[Path, dict]]:
    """Modo batch: abre el browser y hace login UNA SOLA VEZ. Cada factura
    selecciona su empresa destino (auto-detectada o `empresa` si es explÃ­cita)
    al principio de su carga; si la empresa actual ya coincide, select_empresa
    hace skip y ahorra ~15s.

    Args:
        items: lista de (pdf_path, datos_extraidos).
        empresa: None â†’ cada factura auto-detecta su empresa por NUM_SERVICIO.
                 str â†’ todas las facturas van a esa empresa (override).
    Returns:
        lista de (pdf_path, resultado_de_carga).
    """
    from .flows.base import FinnegansSession
    from .flows.energia import cargar_energia_electrica
    from .flows.gire import cargar_gire
    from .flows.sepsa import cargar_sepsa
    from .flows.soportes import cargar_arrendamiento_soportes

    out: list[tuple[Path, dict]] = []
    print(f"\n=== MODO BATCH: {len(items)} facturas â€” un solo navegador ===", file=sys.stderr)
    if empresa:
        print(f"    Empresa override: {empresa!r} (todas las facturas van a esta)", file=sys.stderr)
    else:
        print("    Empresa auto-detectada por factura (segÃºn NUM_SERVICIO)", file=sys.stderr)

    # `empresa or "Prueba"` solo se usa para el constructor de FinnegansSession
    # (que setea el default de select_empresa, que igualmente vamos a overridear
    # adentro de cada flow).
    async with FinnegansSession(empresa=empresa or "Prueba", keep_open=False) as s:
        for i, (pdf_path, datos) in enumerate(items, 1):
            tipo = datos.get("tipo_flujo")
            provider_id = (datos.get("_provider_id") or "").strip().lower()
            print(f"\n--- [{i}/{len(items)}] {pdf_path.name} ({tipo}) ---", file=sys.stderr)
            try:
                if tipo == "recaudacion_sepsa" or provider_id == "servicio_electronico_de_pago_s_a":
                    carga = await cargar_sepsa(datos, pdf_path=pdf_path, empresa=empresa, session=s)
                elif provider_id == "gire" or tipo == "recaudacion":
                    carga = await cargar_gire(
                        datos, pdf_path=pdf_path, empresa=empresa, session=s
                    )
                elif tipo == "arrendamiento_soportes":
                    carga = await cargar_arrendamiento_soportes(
                        datos, pdf_path=pdf_path, empresa=empresa, session=s
                    )
                elif tipo == "energia_electrica":
                    carga = await cargar_energia_electrica(
                        datos, pdf_path=pdf_path, empresa=empresa, session=s
                    )
                else:
                    carga = {
                        "exito": False,
                        "mensaje": f"Tipo de flujo no soportado en batch: {tipo}",
                        "nro_interno": None,
                    }
            except Exception as e:
                carga = {"exito": False, "mensaje": f"Error inesperado: {e}", "nro_interno": None}
            _print_carga_result(pdf_path.name, carga)
            out.append((pdf_path, carga))
    return out


def main():
    parser = argparse.ArgumentParser(description="Agente de parsing de facturas")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--pdf", type=Path, help="Ruta a un PDF individual")
    group.add_argument("--dir", type=Path, help="Directorio con PDFs a procesar")
    parser.add_argument(
        "--cargar",
        action="store_true",
        help="Cargar en FinnegansGO despuÃ©s de extraer (solo documentos con _estado=listo)",
    )
    parser.add_argument(
        "--empresa",
        default=None,
        help=(
            "Empresa destino en FinnegansGO. Si se omite, se auto-detecta para "
            "CADA factura a partir de su NUM_SERVICIO (recomendado). "
            "Pasar un nombre explÃ­cito (ej. 'Prueba') para forzar todas a la misma "
            "â€” Ãºtil para testing en la empresa sandbox."
        ),
    )
    args = parser.parse_args()

    results = []

    if args.pdf:
        result = process_pdf(args.pdf)
        entry = {"archivo": args.pdf.name, "datos": result}
        if args.cargar and result.get("_estado") == "listo":
            carga = asyncio.run(_cargar(result, args.empresa, pdf_path=args.pdf))
            entry["carga_finnegans"] = carga
            _print_carga_result(args.pdf.name, carga)
        results.append(entry)
    else:
        pdfs = sorted(args.dir.glob("*.pdf"))
        if not pdfs:
            print(f"No se encontraron PDFs en {args.dir}", file=sys.stderr)
            sys.exit(1)

        # FASE 1: extracciÃ³n con LLM de TODOS los PDFs (rÃ¡pido en serie, no abre navegador).
        print(f"\n=== FASE 1: extracciÃ³n de {len(pdfs)} PDFs ===", file=sys.stderr)
        entries_by_path: dict[Path, dict] = {}
        for pdf_path in pdfs:
            try:
                result = process_pdf(pdf_path)
                entries_by_path[pdf_path] = {"archivo": pdf_path.name, "datos": result}
            except Exception as e:
                entries_by_path[pdf_path] = {"archivo": pdf_path.name, "error": str(e)}

        # FASE 2: si --cargar, abrir UN solo navegador y procesar los que estÃ©n listos.
        if args.cargar:
            ready_items = [
                (p, e["datos"])
                for p, e in entries_by_path.items()
                if "datos" in e and e["datos"].get("_estado") == "listo"
            ]
            if ready_items:
                cargas = asyncio.run(_cargar_batch(ready_items, args.empresa))
                for p, carga in cargas:
                    entries_by_path[p]["carga_finnegans"] = carga
            else:
                print("\nNada para cargar en FinnegansGO (ningÃºn PDF quedÃ³ _estado=listo).",
                      file=sys.stderr)

        results = list(entries_by_path.values())

    output = results if len(results) > 1 else results[0]
    print(json.dumps(output, indent=2, ensure_ascii=False))


def _print_carga_result(archivo: str, carga: dict):
    icono = "âœ…" if carga["exito"] else "âŒ"
    print(f"   {icono} FinnegansGO: {carga['mensaje']}", file=sys.stderr)
    if carga.get("nro_interno"):
        print(f"      Nro. interno: {carga['nro_interno']}", file=sys.stderr)


if __name__ == "__main__":
    main()

