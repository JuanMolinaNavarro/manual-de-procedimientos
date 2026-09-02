/** fetch JSON con la convención de error del panel ({ error } → Error(message)). */
export async function nominaFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body && !(init.body instanceof FormData)
      ? { 'Content-Type': 'application/json', ...init?.headers }
      : init?.headers,
  });
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

/** Descarga un archivo generado en el cliente (CSV, etc.). */
export function descargar(nombre: string, contenido: string, mime: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenido], { type: mime }));
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function mensajeError(e: unknown, fallback = 'Algo salió mal'): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
