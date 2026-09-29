/**
 * PDF de los recibos de Finnegans: leer el texto de cada página de la sábana
 * (pdfjs-dist) y partirla en un PDF por persona (pdf-lib). Solo servidor.
 *
 * `pdfjs-dist` va en `serverExternalPackages` (next.config.ts): carga su worker
 * con un import dinámico que el bundler no debe tocar.
 */

import { PDFDocument } from 'pdf-lib';

/** Texto de cada página, en orden (índice 0 = página 1). */
export async function extraerTextos(pdf: Uint8Array): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const tarea = pdfjs.getDocument({
    data: new Uint8Array(pdf), // pdfjs se queda con el buffer: le pasamos una copia
    verbosity: 0,
    disableFontFace: true,
    useSystemFonts: false,
  });
  try {
    const doc = await tarea.promise;
    const textos: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const contenido = await page.getTextContent();
      textos.push(contenido.items.map((it) => ('str' in it ? it.str : '')).join(' '));
      page.cleanup();
    }
    return textos;
  } finally {
    await tarea.destroy();
  }
}

/** Cantidad de páginas (sin leer el texto). */
export async function contarPaginas(pdf: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  return doc.getPageCount();
}

/**
 * Parte la sábana: un PDF nuevo por grupo con las páginas indicadas (0-based), en
 * el mismo orden. Copia las páginas tal cual (sin re-renderizar).
 */
export async function partirPorGrupos(pdf: Uint8Array, grupos: number[][]): Promise<Uint8Array[]> {
  const origen = await PDFDocument.load(pdf, { updateMetadata: false });
  const total = origen.getPageCount();
  const salida: Uint8Array[] = [];
  for (const paginas of grupos) {
    if (paginas.length === 0 || paginas.some((p) => !Number.isInteger(p) || p < 0 || p >= total)) {
      throw new Error(`Páginas fuera de rango: ${paginas.join(', ')} (la sábana tiene ${total})`);
    }
    const nuevo = await PDFDocument.create({ updateMetadata: false });
    const copiadas = await nuevo.copyPages(origen, paginas);
    copiadas.forEach((p) => nuevo.addPage(p));
    nuevo.setProducer('Aurelius (recibo de Finnegans)');
    salida.push(await nuevo.save({ useObjectStreams: true }));
  }
  return salida;
}
