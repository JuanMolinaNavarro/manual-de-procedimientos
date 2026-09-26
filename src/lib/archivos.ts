/**
 * Cómo se sirven los archivos que sube la gente (documentos, logos, fotos, íconos). Puro.
 *
 * - El `Content-Type` sale de la extensión guardada, nunca del `file.type` que mandó el
 *   navegador al subir: si no, un `.txt` subido como `text/html` se renderizaba como página
 *   del propio sitio (XSS almacenado).
 * - Inline solo lo que el navegador muestra sin ejecutar nada (PDF, imágenes, texto plano);
 *   el resto se descarga.
 * - `nosniff` siempre y CSP `sandbox` en todo lo que no es PDF: un SVG con `<script>` abierto
 *   directo no ejecuta nada (en un `<img>` nunca ejecuta). El visor de PDF de Chrome no
 *   funciona dentro de un documento sandbox, por eso el PDF queda afuera.
 */

const MIME_POR_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8',
  csv: 'text/plain; charset=utf-8',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
};

/** Extensión de imagen para cada MIME aceptado al subir (la extensión la decide el servidor). */
export const EXT_POR_MIME_IMAGEN: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

function extDe(nombre: string): string {
  const i = nombre.lastIndexOf('.');
  return i >= 0 ? nombre.slice(i + 1).toLowerCase() : '';
}

export function mimeDeArchivo(nombre: string): string {
  return MIME_POR_EXT[extDe(nombre)] ?? 'application/octet-stream';
}

function mostrableInline(mime: string): boolean {
  return mime === 'application/pdf' || mime.startsWith('image/') || mime.startsWith('text/plain');
}

/** `filename` ASCII de respaldo + `filename*` UTF-8 (RFC 5987) para acentos y ñ. */
export function contentDisposition(tipo: 'inline' | 'attachment', nombre: string): string {
  const ascii = nombre.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, "'");
  return `${tipo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}

/**
 * Headers para servir un archivo subido. `nombreArchivo` es el guardado en disco (define el
 * tipo); `nombreDescarga`, el que ve el usuario (opcional: sin él no se manda
 * Content-Disposition, como en fotos y logos).
 */
export function headersArchivo(
  nombreArchivo: string,
  opts: { nombreDescarga?: string; descargar?: boolean; cache?: string } = {},
): Record<string, string> {
  const mime = mimeDeArchivo(nombreArchivo);
  const inline = !opts.descargar && mostrableInline(mime);
  const h: Record<string, string> = {
    'Content-Type': mime,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': opts.cache ?? 'private, max-age=3600',
  };
  h['Content-Security-Policy'] = mime === 'application/pdf'
    ? "frame-ancestors 'self'"
    : "default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-ancestors 'self'; sandbox";
  if (opts.nombreDescarga || !inline) {
    h['Content-Disposition'] = contentDisposition(inline ? 'inline' : 'attachment', opts.nombreDescarga ?? nombreArchivo);
  }
  return h;
}
