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
    """Procesa un ciclo completo. Devuelve cuántas facturas se tomaron.

    Procesamiento EN COLA: abre un único navegador + login para todo el ciclo,
    y por cada factura hace extracción → carga → callback de inmediato (en vez
    de extraer todo el lote y recién después cargarlo). Así el estado de cada
    factura se actualiza apenas termina, sin esperar a que termine el lote.
    """
    items = fetch_pendientes()
    if not items:
        return 0

    log(f"{len(items)} factura(s) pendiente(s) — procesando en cola (un solo navegador)")
    asyncio.run(_procesar_cola(items))
    return len(items)


async def _procesar_cola(items: list[dict]) -> None:
    """Abre una sesión de FinnegansSession y procesa las facturas una por una."""
    from agent.flows.base import FinnegansSession
    from agent.main import cargar_una

    total = len(items)
    # `WORKER_EMPRESA or "Prueba"` es solo el default del constructor; cada flow
    # resuelve/override la empresa destino al inicio de su carga.
    async with FinnegansSession(empresa=WORKER_EMPRESA or "Prueba", keep_open=False) as s:
        for i, item in enumerate(items, 1):
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

            # 1) Extracción (LLM). Bloquea el event loop pero no hay nada más que
            #    correr en paralelo en este worker.
            log(f"[{i}/{total}] {nombre}: extrayendo…")
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
                post_callback({
                    "factura_id": factura_id,
                    "estado_carga": "revision",
                    "tipo_flujo": tipo_flujo,
                    "carga_error": "Requiere verificación manual.",
                })
                continue

            # 2) Carga en FinnegansGO reusando la sesión ya logueada.
            log(f"[{i}/{total}] {nombre} ({tipo_flujo}): cargando en FinnegansGO…")
            try:
                carga = await cargar_una(datos, WORKER_EMPRESA, pdf_path, s)
            except Exception as e:  # noqa: BLE001
                carga = {"exito": False, "mensaje": f"Error inesperado: {e}", "nro_interno": None}

            # 3) Callback inmediato con el resultado de ESTA factura.
            estado = _estado_carga_from_result(carga)
            monto = datos.get("monto_total")
            post_callback({
                "factura_id": factura_id,
                "estado_carga": estado,
                "tipo_flujo": datos.get("tipo_flujo"),
                "empresa_destino": WORKER_EMPRESA or datos.get("_empresa_destino"),
                "finnegans_numero_interno": (
                    str(carga["nro_interno"]) if carga.get("nro_interno") else None
                ),
                "carga_error": None if carga.get("exito") else carga.get("mensaje"),
                "proveedor": datos.get("_proveedor_nombre") or datos.get("emisor"),
                "numero_factura": datos.get("numero_factura"),
                "fecha_emision": datos.get("fecha_emision"),
                "monto_total": str(monto) if monto is not None else None,
            })
            log(f"[{i}/{total}] {nombre}: {estado} — {carga.get('mensaje')}")


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
