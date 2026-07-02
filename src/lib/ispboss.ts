/**
 * Cliente server-side de la API REST de ISPBoss / ViaCCC.
 *
 * IMPORTANTE: este módulo se ejecuta SOLO en el servidor. La API key
 * (`ISPBOSS_API_KEY`) nunca debe llegar al navegador — por eso las consultas
 * se hacen desde route handlers / server components, nunca desde el cliente.
 *
 * La API expone (con esta key) sólo lectura:
 *   1) GET /api/Abonados/AbonadosBotConsulta?abonadoDocumento=<dni>
 *      -> { status, Registros, ClienteID }   (siempre HTTP 200; mirar `status`)
 *   2) GET /api/abonados/<ClienteID>
 *      -> ficha completa del abonado (48 campos)
 */

const BASE_URL = process.env.ISPBOSS_BASE_URL ?? 'https://viaccc.ispboss.com';

/** Subconjunto tipado de la ficha del abonado (los campos que usa la app). */
export interface AbonadoIspboss {
  id: number;
  Codigo: number;
  NombreCompleto: string;
  EstadoCodigo: string;
  EstadoNombre: string;
  DocumentoTipoCodigo: string;
  DocumentoNumero: string;
  Email: string | null;
  DomicilioInstalacionDomicilio: string;
  DomicilioInstalacionPiso: string;
  DomicilioInstalacionManzana: string;
  DomicilioInstalacionCasa: string;
  DomicilioInstalacionZonaNombre: string;
  DomicilioFacturacionDomicilio: string;
  DomicilioFacturacionPiso: string;
  DomicilioFacturacionManzana: string;
  DomicilioFacturacionCasa: string;
  // La respuesta trae más campos; se conservan por si se necesitan.
  [key: string]: unknown;
}

interface BotConsultaResponse {
  status: string;
  Registros?: number;
  ClienteID?: number;
  message?: string;
  errorCode?: number;
}

/** Resultado normalizado de la consulta por DNI. */
export interface ConsultaAbonadoResult {
  /** true si se encontró un abonado y se pudo traer su ficha. */
  found: boolean;
  /** Cantidad de registros que ISPBoss asocia a ese documento. */
  registros: number;
  /** id interno (ClienteID) usado para la ficha, o null si no hay. */
  clienteId: number | null;
  /** Ficha del abonado, o null si no se encontró. */
  abonado: AbonadoIspboss | null;
}

/** Error con status HTTP para propagar al route handler. */
export class IspbossError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'IspbossError';
    this.status = status;
  }
}

function apiKey(): string {
  const key = process.env.ISPBOSS_API_KEY;
  if (!key) {
    throw new IspbossError('ISPBOSS_API_KEY no está configurada en el servidor.', 500);
  }
  return key;
}

async function ispbossGet<T>(path: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'X-Api-Key': apiKey(), Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    throw new IspbossError('No se pudo conectar con ISPBoss.', 502);
  }
  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

/**
 * Consulta un abonado por su número de documento (DNI), encadenando los dos
 * endpoints de ISPBoss. Devuelve un resultado normalizado; lanza IspbossError
 * ante fallos de conexión / configuración / respuestas inesperadas.
 */
export async function consultarAbonadoPorDni(dni: string): Promise<ConsultaAbonadoResult> {
  // 1) DNI -> ClienteID
  const consulta = await ispbossGet<BotConsultaResponse>(
    `/api/Abonados/AbonadosBotConsulta?abonadoDocumento=${encodeURIComponent(dni)}`,
  );
  if (!consulta.ok || !consulta.data) {
    throw new IspbossError('ISPBoss no respondió correctamente a la consulta.', 502);
  }
  const c = consulta.data;
  if (c.status !== 'OK') {
    // Ej.: errorCode 100 = parámetro faltante/ inválido.
    throw new IspbossError(c.message ?? 'ISPBoss rechazó la consulta del documento.', 502);
  }

  const registros = c.Registros ?? 0;
  const clienteId = c.ClienteID && c.ClienteID > 0 ? c.ClienteID : null;

  // Sin ClienteID => no hay abonado para ese documento.
  if (!clienteId) {
    return { found: false, registros, clienteId: null, abonado: null };
  }

  // 2) ClienteID -> ficha del abonado
  const detalle = await ispbossGet<AbonadoIspboss>(`/api/abonados/${clienteId}`);
  if (!detalle.ok || !detalle.data) {
    throw new IspbossError('No se pudo obtener la ficha del abonado en ISPBoss.', 502);
  }

  return { found: true, registros, clienteId, abonado: detalle.data };
}
