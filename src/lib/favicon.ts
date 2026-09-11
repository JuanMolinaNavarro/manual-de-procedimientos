/**
 * Descarga del favicon de un sitio (solo servidor). Se usa para el ícono
 * automático de las licencias de software: con la URL del proveedor el
 * servidor baja el ícono una sola vez y lo guarda en uploads/, así la UI no
 * depende de que cada navegador tenga salida a internet.
 *
 * Nunca tira: cualquier fallo (URL inválida, timeout, respuesta que no es
 * imagen) devuelve null y la licencia se guarda sin ícono.
 */

const TIMEOUT_MS = 8000;
const MAX_BYTES = 1024 * 1024;

const EXT_POR_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

/** Hostname a partir de "microsoft.com", "www.notion.so/login" o "https://…". Null si no parsea. */
export function hostDeSitio(sitio: string): string | null {
  const s = sitio.trim();
  if (!s) return null;
  try {
    const url = new URL(s.includes('://') ? s : `https://${s}`);
    const host = url.hostname.toLowerCase();
    // Sin punto no es un dominio público (evita pedir favicons de "localhost" o basura).
    return host.includes('.') ? host : null;
  } catch {
    return null;
  }
}

async function bajarImagen(url: string): Promise<{ buffer: Buffer; ext: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' });
    if (!res.ok) return null;
    const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const ext = EXT_POR_MIME[mime];
    if (!ext) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_BYTES) return null;
    return { buffer, ext };
  } catch {
    return null;
  }
}

export async function descargarFavicon(
  sitio: string,
): Promise<{ buffer: Buffer; ext: string } | null> {
  const host = hostDeSitio(sitio);
  if (!host) return null;
  const candidatos = [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`,
  ];
  for (const url of candidatos) {
    const img = await bajarImagen(url);
    if (img) return img;
  }
  return null;
}
