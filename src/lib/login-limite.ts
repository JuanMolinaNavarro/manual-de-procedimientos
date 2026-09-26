/**
 * Freno a la fuerza bruta del login. Dos capas:
 * - Por usuario (en la base, sobrevive reinicios): `LOGIN_MAX_FALLOS` contraseñas incorrectas
 *   seguidas → bloqueado `LOGIN_BLOQUEO_MS`. Se resetea al entrar bien.
 * - Por IP (en memoria): `IP_MAX_FALLOS` fallos en `IP_VENTANA_MS` → 429 hasta que se vacíe la
 *   ventana. Frena a quien prueba muchos usuarios distintos.
 * Las funciones de cálculo son puras (testeadas en `login-limite.test.ts`).
 */

export const LOGIN_MAX_FALLOS = 10;
export const LOGIN_BLOQUEO_MS = 15 * 60_000;
export const IP_MAX_FALLOS = 30;
export const IP_VENTANA_MS = 15 * 60_000;

export function bloqueoVigente(hasta: Date | null, ahora = Date.now()): number {
  if (!hasta) return 0;
  const resto = hasta.getTime() - ahora;
  return resto > 0 ? Math.ceil(resto / 1000) : 0;
}

/** Estado del usuario tras una contraseña incorrecta. */
export function falloUsuario(fallos: number, ahora = Date.now()): { login_fallos: number; login_bloqueado_hasta: Date | null } {
  const n = fallos + 1;
  if (n >= LOGIN_MAX_FALLOS) return { login_fallos: 0, login_bloqueado_hasta: new Date(ahora + LOGIN_BLOQUEO_MS) };
  return { login_fallos: n, login_bloqueado_hasta: null };
}

const porIp = new Map<string, number[]>();

function recientes(ip: string, ahora: number): number[] {
  const lista = (porIp.get(ip) ?? []).filter((t) => ahora - t < IP_VENTANA_MS);
  if (lista.length) porIp.set(ip, lista);
  else porIp.delete(ip);
  return lista;
}

/** Segundos de espera para esta IP (0 = puede intentar). */
export function esperaIp(ip: string, ahora = Date.now()): number {
  const lista = recientes(ip, ahora);
  if (lista.length < IP_MAX_FALLOS) return 0;
  return Math.ceil((lista[0] + IP_VENTANA_MS - ahora) / 1000);
}

export function registrarFalloIp(ip: string, ahora = Date.now()): void {
  const lista = recientes(ip, ahora);
  lista.push(ahora);
  porIp.set(ip, lista);
  // Tope de memoria: si alguien rota IPs, se descarta lo más viejo.
  if (porIp.size > 10_000) porIp.delete(porIp.keys().next().value!);
}

/** IP del cliente según el proxy inverso (`x-real-ip`), o la última de `x-forwarded-for`. */
export function ipCliente(headers: Headers): string {
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const partes = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (partes.length) return partes[partes.length - 1];
  }
  return 'desconocida';
}
