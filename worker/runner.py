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
  WORKER_RESTART_EVERY  reinicia el navegador cada N facturas (default 5; <=0 lo desactiva)
  (+ FINNEGANS_USER/PASS/WORKSPACE, HEADLESS — usadas por el agente. El LLM ya no se usa.)
"""
from __future__ import annotations

import asyncio
import os
import sys
import time
from pathlib import Path
from typing import Optional

import requests

from agent.main import _cargar_batch, process_pdf

NEXT_BASE = os.getenv("NEXT_BASE", "http://app:3000").rstrip("/")
WORKER_SECRET = os.getenv("WORKER_SECRET", "")
WORKER_EMPRESA = os.getenv("WORKER_EMPRESA") or None
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", "/app/uploads/facturas"))
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "15"))
# Reinicia el navegador cada N facturas (preventivo, para que un cuelgue de
# Finnegans a mitad de lote no arrastre a las siguientes). <=0 lo desactiva.
RESTART_EVERY = int(os.getenv("WORKER_RESTART_EVERY", "5"))

_HEADERS = {"X-Worker-Key": WORKER_SECRET}

# Firmas en el mensaje de error que delatan una SESIÓN/NAVEGADOR roto (vs. un
# problema de datos como un descuadre de control-total, que es una revisión
# legítima y NO amerita reiniciar). Ante estas, se reinicia y se reintenta.
_SESION_ROTA_SIGNS = (
    "iframe",
    "empresa destino",
    "seleccionar empresa",
    "header qued",
    "timeout",
    "target closed",
    "no-scope",
    "crash",
)


def _parece_sesion_rota(carga: dict) -> bool:
    msg = (carga.get("mensaje") or "").lower()
    return any(s in msg for s in _SESION_ROTA_SIGNS)


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
    """Procesa las facturas una por una REINICIANDO el navegador periódicamente.

    Un solo navegador para todo el lote se degrada: si Finnegans cuelga a mitad de
    camino (sesión expirada, modal trabado, iframe perdido) todas las facturas
    siguientes fallan en cascada. Para evitarlo:
      - Reinicio PREVENTIVO cada `RESTART_EVERY` facturas (estado 100% limpio).
      - Reinicio REACTIVO + reintento cuando una carga falla por sesión rota
        (detectado por el mensaje o por is_logged_in()), para no condenar al resto.
    Cada factura: extrae (determinista) → carga → callback inmediato.
    """
    from agent.flows.base import FinnegansSession
    from agent.main import cargar_una

    total = len(items)

    # `WORKER_EMPRESA or "Prueba"` es solo el default del constructor; cada flow
    # resuelve/override la empresa destino al inicio de su carga.
    async def _abrir() -> FinnegansSession:
        s = FinnegansSession(empresa=WORKER_EMPRESA or "Prueba", keep_open=False)
        await s.start()
        return s

    async def _cerrar(s: Optional[FinnegansSession]) -> None:
        if s is not None:
            try:
                await s.close()
            except Exception as e:  # noqa: BLE001
                log(f"error cerrando el navegador: {e}")

    session: Optional[FinnegansSession] = None
    usadas = 0  # facturas cargadas con la sesión actual

    async def _reiniciar(motivo: str) -> FinnegansSession:
        nonlocal usadas
        log(f"reiniciando navegador — {motivo}")
        await _cerrar(session)
        s = await _abrir()
        usadas = 0
        return s

    try:
        session = await _abrir()
        for i, item in enumerate(items, 1):
            factura_id = item["factura_id"]
            nombre = item.get("nombre_archivo")
            pdf_path = UPLOADS_DIR / nombre if nombre else None

            # Reinicio PREVENTIVO del navegador cada RESTART_EVERY facturas.
            if RESTART_EVERY > 0 and usadas >= RESTART_EVERY:
                session = await _reiniciar(f"preventivo tras {usadas} factura(s)")

            post_callback({"factura_id": factura_id, "estado_carga": "cargando"})

            if not pdf_path or not pdf_path.exists():
                post_callback({
                    "factura_id": factura_id,
                    "estado_carga": "error",
                    "carga_error": f"PDF no encontrado en {pdf_path}",
                })
                continue

            # 1) Extracción DETERMINISTA (sin IA). No usa el navegador.
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
                    "carga_error": datos.get("_error_extraccion") or "Requiere verificación manual.",
                })
                continue

            # 2) Carga en FinnegansGO reusando la sesión ya logueada.
            log(f"[{i}/{total}] {nombre} ({tipo_flujo}): cargando en FinnegansGO…")
            try:
                carga = await cargar_una(datos, WORKER_EMPRESA, pdf_path, session)
            except Exception as e:  # noqa: BLE001
                carga = {"exito": False, "mensaje": f"Error inesperado: {e}", "nro_interno": None}
            usadas += 1

            # Si FALLÓ por sesión/navegador roto (no por datos), reiniciar el
            # navegador y reintentar ESTA factura una vez. Un descuadre de
            # control-total NO entra acá (es revisión legítima).
            if not carga.get("exito") and (
                _parece_sesion_rota(carga) or not await session.is_logged_in()
            ):
                session = await _reiniciar("sesión rota tras fallo de carga")
                log(f"[{i}/{total}] {nombre}: reintentando con navegador nuevo…")
                try:
                    carga = await cargar_una(datos, WORKER_EMPRESA, pdf_path, session)
                except Exception as e:  # noqa: BLE001
                    carga = {
                        "exito": False,
                        "mensaje": f"Error inesperado tras reinicio: {e}",
                        "nro_interno": None,
                    }
                usadas += 1

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
    finally:
        await _cerrar(session)


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
