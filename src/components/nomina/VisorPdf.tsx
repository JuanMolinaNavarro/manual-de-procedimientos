'use client';

/**
 * Visor de PDF con pdf.js: dibuja cada página en un <canvas> al ancho del contenedor. Se usa
 * en el portal porque los celulares (Chrome en Android, sobre todo) no muestran un PDF dentro
 * de un <iframe>. Muestra el archivo tal cual lo entrega el servidor (que ya verificó su hash).
 */

import { useEffect, useRef, useState } from 'react';

export default function VisorPdf({ url, onListo }: { url: string; onListo?: (paginas: number) => void }) {
  const cont = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;
    // Cada ejecución tiene su propio worker: si React re-ejecuta el efecto (modo desarrollo) o
    // cambia la URL, la limpieza de una no deja colgada a la otra.
    let worker: Worker | null = null;
    let liberar: (() => void) | null = null;
    (async () => {
      try {
        const u8proto = Uint8Array.prototype as unknown as { toHex?: () => string };
        if (typeof Uint8Array !== 'undefined' && !u8proto.toHex) {
          u8proto.toHex = function (this: Uint8Array) {
            return Array.from(this, (b) => b.toString(16).padStart(2, '0')).join('');
          };
        }
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          let msg = `No se pudo abrir el recibo (${res.status})`;
          try {
            const b = await res.json();
            if (b?.error) msg = b.error;
          } catch {}
          throw new Error(msg);
        }
        const data = new Uint8Array(await res.arrayBuffer());
        if (cancelado) return;
        worker = new Worker(new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url), { type: 'module' });
        const pdfWorker = pdfjs.PDFWorker.create({ port: worker });
        const tarea = pdfjs.getDocument({ data, worker: pdfWorker });
        liberar = () => {
          void tarea.destroy();
          pdfWorker.destroy();
        };
        const doc = await tarea.promise;
        const div = cont.current;
        if (cancelado || !div) return;
        // Se dibuja fuera de pantalla y se muestra todo junto al final.
        const hojas: HTMLCanvasElement[] = [];
        const ancho = div.clientWidth || 360;
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: (ancho / base.width) * dpr });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(vp.width);
          canvas.height = Math.floor(vp.height);
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.className = 'mb-2 rounded border border-border bg-white';
          canvas.setAttribute('aria-label', `Página ${i} del recibo`);
          await page.render({ canvas, viewport: vp }).promise;
          if (cancelado) return;
          hojas.push(canvas);
        }
        div.replaceChildren(...hojas);
        setEstado('listo');
        onListo?.(doc.numPages);
      } catch (e) {
        if (!cancelado) {
          setError(e instanceof Error ? e.message : 'No se pudo mostrar el recibo');
          setEstado('error');
        }
      }
    })();
    return () => {
      cancelado = true;
      liberar?.();
      worker?.terminate();
    };
    // onListo se llama una sola vez por URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <div>
      {estado === 'cargando' && <p className="py-8 text-center text-sm text-muted-foreground">Cargando el recibo…</p>}
      {estado === 'error' && <p className="py-4 text-sm font-medium text-destructive">{error}</p>}
      <div ref={cont} />
    </div>
  );
}
