/**
 * Cliente mínimo de la API de Teamplace / Finnegans para los recibos de sueldo.
 * ⚠️ Solo servidor: usa TEAMPLACE_CLIENT_ID / TEAMPLACE_CLIENT_SECRET.
 *
 * Patrón del cliente de CentralSM: token cacheado (dura unos minutos), reintento
 * una vez si la API contesta "invalid token", token en el query string.
 *
 * Costo (política de Finnegans): el token y los maestros son gratis; los reportes
 * (`/reports/*`) y los impresos (`custom/transaction/report/execute`) se cobran
 * por llamada. Cada llamada paga se informa con `onLlamada` para registrarla
 * (ver `recibos-finnegans.ts`, tope mensual).
 */

import { clasificarRespuestaPdf, type FilaResumenLiq } from './recibos-finnegans-calc';

export class TeamplaceError extends Error {
  constructor(message: string, public http?: number) {
    super(message);
  }
}

export interface InfoLlamada {
  endpoint: string;
  detalle: string;
  ok: boolean;
  http: number | null;
}
export type OnLlamada = (info: InfoLlamada) => Promise<void> | void;

function cfg() {
  const clientId = process.env.TEAMPLACE_CLIENT_ID;
  const clientSecret = process.env.TEAMPLACE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new TeamplaceError('Faltan TEAMPLACE_CLIENT_ID / TEAMPLACE_CLIENT_SECRET en el entorno.');
  }
  return {
    clientId,
    clientSecret,
    tokenUrl: process.env.TEAMPLACE_TOKEN_URL ?? 'https://api.teamplace.finneg.com/api/oauth/token',
    // Reportes: host del spec. report/execute: host de Teamplace (verificado ahí).
    reportsUrl: process.env.TEAMPLACE_BASE_URL ?? 'https://api.finneg.com/api',
    execUrl: process.env.TEAMPLACE_EXEC_URL ?? 'https://api.teamplace.finneg.com/api',
    reciboXml: process.env.FINNEGANS_RECIBO_XML ?? 'ReciboSueldosOficial.jrxml',
    reciboDatasource: process.env.FINNEGANS_RECIBO_DATASOURCE ?? 'F_GA_LIQ_0065',
  };
}

const TOKEN_TTL_MS = 4 * 60 * 1000;
let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getToken(force = false): Promise<string> {
  if (!force && cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;
  const { tokenUrl, clientId, clientSecret } = cfg();
  const url =
    `${tokenUrl}?grant_type=client_credentials` +
    `&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;
  const res = await fetch(url, { cache: 'no-store' });
  const text = (await res.text()).trim();
  // Éxito = token en texto plano. Error = JSON tipo {"error":"credentials not found"}.
  if (!res.ok || text.startsWith('{') || !text) {
    throw new TeamplaceError('No se pudo obtener el token de Finnegans (revisar las keys).', res.status);
  }
  cachedToken = { value: text, expiresAt: Date.now() + TOKEN_TTL_MS };
  return text;
}

type Params = Record<string, string | number | boolean | undefined>;

function armarUrl(base: string, path: string, token: string, params: Params): string {
  const qs = new URLSearchParams({ ACCESS_TOKEN: token });
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
  return `${base}${path}?${qs.toString()}`;
}

/** El error de token vencido viene como JSON {"error":"invalid token"} (a veces con 200). */
function esTokenInvalido(cuerpo: string): boolean {
  return /invalid token/i.test(cuerpo.slice(0, 300));
}

async function pedir(
  base: string,
  path: string,
  params: Params,
  endpoint: string,
  detalle: string,
  onLlamada?: OnLlamada,
): Promise<{ res: Response; body: Uint8Array }> {
  for (let intento = 0; intento < 2; intento++) {
    const token = await getToken(intento > 0);
    let res: Response;
    try {
      res = await fetch(armarUrl(base, path, token, params), { cache: 'no-store' });
    } catch {
      await onLlamada?.({ endpoint, detalle, ok: false, http: null });
      throw new TeamplaceError('No se pudo conectar con Finnegans.');
    }
    const body = new Uint8Array(await res.arrayBuffer());
    const cuerpo = new TextDecoder().decode(body.subarray(0, 300));
    // Cada HTTP contra un endpoint pago cuenta como interacción (conservador).
    const tokenInvalido = esTokenInvalido(cuerpo);
    await onLlamada?.({ endpoint, detalle, ok: res.ok && !tokenInvalido, http: res.status });
    if (tokenInvalido && intento === 0) continue;
    return { res, body };
  }
  throw new TeamplaceError('Finnegans rechazó el token dos veces seguidas.');
}

/**
 * Reporte RESUMENLIQ (PAGO, 1 interacción): una fila por legajo liquidado entre
 * `desde` y `hasta` (yyyy-mm-dd), de TODAS las empresas (sin filtro de empresa).
 */
export async function getResumenLiq(desde: string, hasta: string, onLlamada?: OnLlamada): Promise<FilaResumenLiq[]> {
  const { reportsUrl } = cfg();
  const { res, body } = await pedir(
    reportsUrl,
    '/reports/RESUMENLIQ',
    { PARAMWEBREPORT_FechaDesde: desde, PARAMWEBREPORT_FechaHasta: hasta },
    'reports/RESUMENLIQ',
    `${desde}..${hasta}`,
    onLlamada,
  );
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new TeamplaceError('Finnegans devolvió una respuesta que no es JSON (RESUMENLIQ).', res.status);
  }
  if (!res.ok || !Array.isArray(data)) {
    const msg = data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : res.status;
    throw new TeamplaceError(`RESUMENLIQ falló: ${msg}`, res.status);
  }
  return data as FilaResumenLiq[];
}

/**
 * Sábana oficial de una liquidación (PAGO, 1 interacción): PDF con una página por
 * legajo. `transaccionId` = TRANSACCIONID de RESUMENLIQ.
 */
export async function getSabana(transaccionId: number, onLlamada?: OnLlamada): Promise<Uint8Array> {
  const { execUrl, reciboXml, reciboDatasource } = cfg();
  const { res, body } = await pedir(
    execUrl,
    '/custom/transaction/report/execute',
    { XMLFILE: reciboXml, DATASOURCE: reciboDatasource, primaryKey: transaccionId, download: 1 },
    'custom/transaction/report/execute',
    `tx ${transaccionId}`,
    onLlamada,
  );
  if (!res.ok) throw new TeamplaceError(`La descarga de la liquidación falló (HTTP ${res.status}).`, res.status);
  const r = clasificarRespuestaPdf(body);
  if (!r.ok) throw new TeamplaceError(r.motivo, res.status);
  return body;
}
