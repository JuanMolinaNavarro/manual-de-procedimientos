"""
Worker de carga en FinnegansGO para esquema-retencion.

Hace polling al backend Next.js por facturas con estado_carga='pendiente',
las extrae con el agente (GPT-4o visión) y las carga en FinnegansGO vía
Playwright reusando UN solo navegador por ciclo (patrón _cargar_batch).
Reporta el resultado al callback del backend.

Variables de entorno:
  NEXT_BASE          URL interna del backend Next (ej. http://app:3000)
  WORKER_SECRET      secreto compartido (header X-Worker-Key)
  WORKER_EMPRESA     opcional; fuerza todas las facturas a esa empresa (sandbox).
                     Si se omite, cada factura auto-detecta su empresa por NUM_SERVICIO.
  UPLOADS_DIR        directorio del volumen compartido con los PDFs
                     (default /app/uploads/facturas)
  POLL_INTERVAL      segundos entre polls (default 15)
  (+ OPENAI_API_KEY, FINNEGANS_USER/PASS/WORKSPACE, HEADLESS — usadas por el agente)
"""
from __future__ import annotations

import asyncio
import os
import sys
import time
from pathlib import Path

import requests

from agent.main import _cargar_batch, process_pdf

NEXT_BASE = os.getenv("NEXT_BASE", "http://app:3000").rstrip("/")
WORKER_SECRET = os.getenv("WORKER_SECRET", "")
WORKER_EMPRESA = os.getenv("WORKER_EMPRESA") or None
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", "/app/uploads/facturas"))
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "15"))

_HEADERS = {"X-Worker-Key": WORKER_SECRET}


def log(msg: str) -> None:
    print(f"[worker] {msg}", file=sys.stderr, flush=True)


def fetch_pendientes() -> list[dict]:
    r = requests.get(
        f"{NEXT_BASE}/api/worker/facturas-pendientes",
        headers=_HEADERS,
        timeout=30,
    )
    r.raise_for_status()
    return r.json().get("items", [])


def post_callback(payload: dict) -> None:
    try:
        r = requests.post(
            f"{NEXT_BASE}/api/worker/carga-callback",
            headers={**_HEADERS, "Content-Type": "application/json"},
            json=payload,
            timeout=30,
        )
        r.raise_for_status()
    except Exception as e:  # noqa: BLE001
        log(f"callback falló para factura {payload.get('factura_id')}: {e}")


def _estado_carga_from_result(carga: dict) -> str:
    """Mapea el resultado de un flow ({exito, mensaje, nro_interno}) a estado_carga."""
    if (carga.get("estado") or "").lower() == "revision":
        return "revision"
    mensaje = (carga.get("mensaje") or "").lower()
    if carga.get("exito"):
        return "duplicada" if "ya existe" in mensaje else "cargada"
    return "error"


def process_cycle() -> int:
    """Procesa un ciclo completo. Devuelve cuántas facturas se tomaron."""
    items = fetch_pendientes()
    if not items:
        return 0

    log(f"{len(items)} factura(s) pendiente(s) de carga")

    ready: list[tuple[Path, dict]] = []
    id_by_path: dict[Path, int] = {}

    for item in items:
        factura_id = item["factura_id"]
        nombre = item.get("nombre_archivo")
        pdf_path = UPLOADS_DIR / nombre if nombre else None

        post_callback({"factura_id": factura_id, "estado_carga": "cargando"})

        if not pdf_path or not pdf_path.exists():
            post_callback({
                "factura_id": factura_id,
                "estado_carga": "error",
                "carga_error": f"PDF no encontrado en {pdf_path}",
            })
            continue

        try:
            datos = process_pdf(pdf_path)
        except Exception as e:  # noqa: BLE001
            post_callback({
                "factura_id": factura_id,
                "estado_carga": "error",
                "carga_error": f"Error de extracción: {e}",
            })
            continue

        tipo_flujo = datos.get("tipo_flujo")
        if datos.get("_estado") != "listo":
            # Proveedor desconocido → requiere revisión manual en la knowledge base.
            post_callback({
                "factura_id": factura_id,
                "estado_carga": "revision",
                "tipo_flujo": tipo_flujo,
                "carga_error": "Proveedor no reconocido; requiere verificación manual.",
            })
            continue

        ready.append((pdf_path, datos))
        id_by_path[pdf_path] = factura_id

    if not ready:
        return len(items)

    log(f"cargando {len(ready)} factura(s) en FinnegansGO (un solo navegador)")
    resultados = asyncio.run(_cargar_batch(ready, WORKER_EMPRESA))

    for pdf_path, carga in resultados:
        factura_id = id_by_path[pdf_path]
        datos = next(d for p, d in ready if p == pdf_path)
        estado = _estado_carga_from_result(carga)
        monto = datos.get("monto_total")
        post_callback({
            "factura_id": factura_id,
            "estado_carga": estado,
            "tipo_flujo": datos.get("tipo_flujo"),
            "empresa_destino": WORKER_EMPRESA or datos.get("_nombre_finnegans"),
            "finnegans_numero_interno": (
                str(carga["nro_interno"]) if carga.get("nro_interno") else None
            ),
            "carga_error": None if carga.get("exito") else carga.get("mensaje"),
            # Preferir el proveedor RESUELTO por la knowledge base (por CUIT);
            # cae al texto libre del LLM solo si no hubo match (no debería pasar
            # cuando el flow corrió, porque eso exige _estado='listo').
            "proveedor": datos.get("_proveedor_nombre") or datos.get("emisor"),
            "numero_factura": datos.get("numero_factura"),
            "fecha_emision": datos.get("fecha_emision"),
            "monto_total": str(monto) if monto is not None else None,
        })

    return len(items)


def main() -> None:
    if not WORKER_SECRET:
        log("ERROR: falta WORKER_SECRET. Abortando.")
        sys.exit(1)

    log(f"iniciado. backend={NEXT_BASE} uploads={UPLOADS_DIR} poll={POLL_INTERVAL}s "
        f"empresa_override={WORKER_EMPRESA!r}")

    while True:
        try:
            process_cycle()
        except Exception as e:  # noqa: BLE001
            log(f"ciclo falló: {e}")
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
