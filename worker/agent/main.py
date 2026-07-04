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

from .parsers import extract_deterministico
from .reconciliation import reconciliar_importes
from .knowledge_base import (
    lookup_company,
    provider_for_flow,
    record_example,
    register_new_company,
    resolve_empresa_finnegans,
)


def process_pdf(pdf_path: Path) -> dict:
    print(f"\nâ†’ Procesando: {pdf_path.name}", file=sys.stderr)

    # EXTRACCION DETERMINISTA (sin IA). El LLM fue REMOVIDO del pipeline: si ningun
    # parser reconoce el formato, la factura se marca para REVISION manual — nunca se
    # deriva a OpenAI. La reconciliacion y el control-total de Finnegans siguen siendo
    # la red de seguridad contra un descuadre.
    try:
        factura = extract_deterministico(pdf_path)
    except Exception as e:  # noqa: BLE001
        print(f"   Parser determinista fallo: {e}", file=sys.stderr)
        return {
            "archivo": pdf_path.name,
            "tipo_flujo": None,
            "_estado": "revision",
            "_error_extraccion": f"Parser determinista fallo: {e}",
        }
    if factura is None:
        print("   Formato no reconocido por el extractor determinista (sin IA).", file=sys.stderr)
        return {
            "archivo": pdf_path.name,
            "tipo_flujo": None,
            "_estado": "revision",
            "_error_extraccion": "Formato no reconocido por el extractor determinista.",
        }
    print(f"   Extraccion DETERMINISTA (sin IA): {factura.tipo_flujo}", file=sys.stderr)
    result = factura.model_dump()

    # 2. PROVEEDOR a partir del FLUJO elegido (no al reves).
    #    Cada flujo lo emite un proveedor fijo (SEPSA/GIRE/EDET), asi que el
    #    flujo clasificado por el extractor ES la fuente de verdad del proveedor.
    #    Esto evita depender de que el LLM haya leido bien el CUIT del emisor.
    tipo_flujo = factura.tipo_flujo
    provider = provider_for_flow(tipo_flujo)

    # 3. Lookup de la EMPRESA PROPIA usando cuit_cliente (validaciÃ³n)
    company = lookup_company(
        cuit=result.get("cuit_cliente"),
        nombre=result.get("cliente"),
    )

    # 4. Log de lo que encontramos
    if provider:
        print(
            f"   Proveedor (por flujo '{tipo_flujo}'): {provider['razon_social']} "
            f"(CUIT {provider['cuit']})",
            file=sys.stderr,
        )
    else:
        print(f"   Proveedor:      flujo '{tipo_flujo}' sin proveedor mapeado", file=sys.stderr)

    if company:
        print(f"   Empresa propia: {company['razon_social']} (CUIT {company['cuit']})", file=sys.stderr)
    else:
        print(f"   Empresa propia: '{result.get('cliente')}' CUIT {result.get('cuit_cliente')} â€” NO encontrada", file=sys.stderr)

    # 6. Marcar el proveedor A PARTIR DEL FLUJO. Si por algun motivo el flujo no
    #    mapeo (no deberia con los flujos soportados), se cae al nombre crudo del
    #    LLM pero igual se marca 'listo' para no bloquear la carga.
    result["_provider_id"] = provider["id"] if provider else None
    result["_nombre_finnegans"] = provider.get("nombre_finnegans") if provider else None
    result["_proveedor_nombre"] = (
        provider.get("razon_social") if provider else result.get("emisor")
    )
    result["_estado"] = "listo"
    if provider:
        record_example(provider["id"], pdf_path.name, factura.tipo_flujo)

    # 7. Reconciliacion deterministica de importes (solo REPORTE/log). Ya no dispara
    #    reintentos con IA: el extractor determinista es la unica fuente. El
    #    control-total de Finnegans sigue siendo el arbitro final del descuadre.
    recon = reconciliar_importes(result, tipo_flujo)
    if recon and recon["necesita_retry"]:
        print(
            f"   AVISO: descuadre suma={recon['esperado']:.2f} vs "
            f"total={recon['monto_total']:.2f} (dif {recon['diff']:+.2f}). "
            f"Se intentara cargar; Finnegans validara el control de total.",
            file=sys.stderr,
        )
    result["_reconciliacion"] = recon

    # Empresa propia DESTINO (la que el flow resolverá por NUM_SERVICIO / cliente
    # / CUIT). Es distinta del proveedor; se reporta para mostrarla en el panel.
    try:
        result["_empresa_destino"] = resolve_empresa_finnegans(result)
    except Exception:
        result["_empresa_destino"] = None

    # 7. Si la empresa propia no es conocida: registrarla como nueva
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


async def cargar_una(datos: dict, empresa: str | None, pdf_path: Path | None, session) -> dict:
    """Despacha UNA factura ya extraída al flow correcto, reusando `session`.

    Pensado para procesamiento en cola: el caller abre/loguea la session una vez
    y llama a esta función por cada factura (extraer → cargar → reportar), en vez
    de cargar todo el lote junto. Devuelve el dict resultado del flow.
    """
    from .flows.energia import cargar_energia_electrica
    from .flows.gire import cargar_gire
    from .flows.sepsa import cargar_sepsa
    from .flows.soportes import cargar_arrendamiento_soportes

    tipo = datos.get("tipo_flujo")
    provider_id = (datos.get("_provider_id") or "").strip().lower()
    if tipo == "recaudacion_sepsa" or provider_id == "servicio_electronico_de_pago_s_a":
        return await cargar_sepsa(datos, pdf_path=pdf_path, empresa=empresa, session=session)
    if provider_id == "gire" or tipo == "recaudacion":
        return await cargar_gire(datos, pdf_path=pdf_path, empresa=empresa, session=session)
    if tipo == "arrendamiento_soportes":
        return await cargar_arrendamiento_soportes(
            datos, pdf_path=pdf_path, empresa=empresa, session=session
        )
    if tipo == "energia_electrica":
        return await cargar_energia_electrica(
            datos, pdf_path=pdf_path, empresa=empresa, session=session
        )
    return {
        "exito": False,
        "mensaje": f"Tipo de flujo no soportado: {tipo}",
        "nro_interno": None,
    }


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
            print(f"\n--- [{i}/{len(items)}] {pdf_path.name} ({tipo}) ---", file=sys.stderr)
            try:
                carga = await cargar_una(datos, empresa, pdf_path, s)
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

