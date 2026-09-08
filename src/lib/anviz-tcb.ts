/**
 * Cliente mínimo del protocolo Anviz TC-B (v2.15) sobre TCP, tal como lo usa
 * CrossChex Standard (tramas capturadas de su log de comunicación).
 *
 * Trama de pedido:    A5 | id dispositivo (4 bytes BE) | cmd | len (2 BE) | data | CRC16 (2, byte bajo primero)
 * Trama de respuesta: A5 | id dispositivo (4 bytes BE) | cmd|0x80 | ret | len (2 BE) | data | CRC16
 *
 * CRC16: polinomio reflejado 0x8408, init 0xFFFF (vectores reales en anviz-tcb.test.ts).
 *
 * La parte pura (crc, armado/parseo de tramas, fechas) no toca la red y se testea
 * con vitest; la parte de red usa `node:net` y ejecuta un comando por vez.
 */

import { Socket } from 'node:net';
import { MAX_REGISTROS_POR_TRAMA, OFFSET_RELOJ_MIN, type ModoDescarga } from './asistencia-datos';

// ─── Comandos ────────────────────────────────────────────────────────────────

export const CMD = {
  INFO1: 0x30, // información básica (firmware, clave de comunicación, etc.)
  CONTADORES: 0x3c, // cantidades: usuarios, huellas, claves, tarjetas, registros totales y nuevos
  REGISTROS: 0x40, // descargar registros de fichadas
  LIMPIAR_NUEVOS: 0x4e, // borrar registros / marca de "nuevos"
} as const;

/** Códigos de retorno del reloj. */
export const RET = {
  OK: 0x00,
  FAIL: 0x01,
  FULL: 0x04,
  EMPTY: 0x05,
  NO_USER: 0x06,
  TIMEOUT: 0x08,
} as const;

export const STX = 0xa5;
const HEADER_REQ = 8; // STX + CH(4) + CMD + LEN(2)
const HEADER_RESP = 9; // STX + CH(4) + CMD + RET + LEN(2)

// ─── Parte pura ──────────────────────────────────────────────────────────────

export function crc16(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0x8408 : crc >>> 1;
  }
  return crc & 0xffff;
}

/** Arma una trama de pedido completa (con CRC). */
export function armarTrama(deviceId: number, cmd: number, data: Uint8Array = new Uint8Array(0)): Buffer {
  const buf = Buffer.alloc(HEADER_REQ + data.length + 2);
  buf[0] = STX;
  buf.writeUInt32BE(deviceId >>> 0, 1);
  buf[5] = cmd;
  buf.writeUInt16BE(data.length, 6);
  buf.set(data, HEADER_REQ);
  const crc = crc16(buf.subarray(0, HEADER_REQ + data.length));
  buf[HEADER_REQ + data.length] = crc & 0xff;
  buf[HEADER_REQ + data.length + 1] = crc >>> 8;
  return buf;
}

export interface Respuesta {
  deviceId: number;
  cmd: number; // comando original (sin el bit 0x80)
  ret: number;
  data: Buffer;
}

/** Largo total que tendrá la trama de respuesta según su cabecera, o null si aún no llegó la cabecera. */
export function largoRespuesta(buf: Buffer): number | null {
  if (buf.length < HEADER_RESP) return null;
  return HEADER_RESP + buf.readUInt16BE(7) + 2;
}

/** Separa las tramas completas al principio del buffer; lo que sobra queda en `resto`. */
export function extraerTramas(buffer: Buffer): { tramas: Buffer[]; resto: Buffer } {
  const tramas: Buffer[] = [];
  let buf = buffer;
  for (;;) {
    const inicio = buf.indexOf(STX);
    if (inicio < 0) return { tramas, resto: Buffer.alloc(0) };
    if (inicio > 0) buf = buf.subarray(inicio);
    const total = largoRespuesta(buf);
    if (total == null || buf.length < total) return { tramas, resto: Buffer.from(buf) };
    tramas.push(Buffer.from(buf.subarray(0, total)));
    buf = buf.subarray(total);
  }
}

/**
 * ¿Esta trama responde al comando `cmd`? El reloj contesta con `cmd | 0x80`.
 *
 * Además de responder, el reloj **empuja** tramas que nadie pidió: al menos
 * 0x5F, con la fichada que alguien acaba de marcar (14 bytes, misma disposición
 * que un registro del 0x40). Se vio en GRAL PAZ CCC. Sin este chequeo, esa trama
 * se tomaba como la respuesta al comando pendiente y los contadores llegaban
 * "cortos (14 bytes)" cada vez que alguien fichaba durante el sync.
 */
export function esRespuestaA(trama: Buffer, cmd: number): boolean {
  return (trama[5] & 0x7f) === (cmd & 0x7f);
}

/** Parsea una trama de respuesta completa. Lanza si el STX o el CRC no cierran. */
export function parsearRespuesta(buf: Buffer): Respuesta {
  if (buf[0] !== STX) throw new Error(`Trama inválida: STX ${buf[0]?.toString(16)}`);
  const total = largoRespuesta(buf);
  if (total == null || buf.length < total) throw new Error('Trama incompleta');
  const cuerpo = buf.subarray(0, total - 2);
  const crcRecibido = buf[total - 2] | (buf[total - 1] << 8);
  const crcCalc = crc16(cuerpo);
  if (crcRecibido !== crcCalc) {
    throw new Error(`CRC inválido: recibido ${crcRecibido.toString(16)}, calculado ${crcCalc.toString(16)}`);
  }
  return {
    deviceId: buf.readUInt32BE(1),
    cmd: buf[5] & 0x7f,
    ret: buf[6],
    data: Buffer.from(buf.subarray(HEADER_RESP, total - 2)),
  };
}

export interface Contadores {
  usuarios: number;
  huellas: number;
  claves: number;
  tarjetas: number;
  registrosTotales: number;
  registrosNuevos: number;
}

/** Data del cmd 0x3C: seis cantidades de 3 bytes BE. */
export function parsearContadores(data: Buffer): Contadores {
  if (data.length < 18) throw new Error(`Respuesta de contadores corta (${data.length} bytes)`);
  const n = (i: number) => (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
  return {
    usuarios: n(0),
    huellas: n(3),
    claves: n(6),
    tarjetas: n(9),
    registrosTotales: n(12),
    registrosNuevos: n(15),
  };
}

export interface RegistroReloj {
  userId: string; // ID en el reloj (5 bytes BE), como texto sin ceros a la izquierda
  segundos: number; // segundos desde 2000-01-01 00:00:00 hora local del reloj
  fechaHora: Date; // instante real (UTC) asumiendo hora local -03:00
  fecha: string; // yyyy-mm-dd local
  modo: number; // backup code (huella/tarjeta/clave)
  tipo: number; // tipo de marca (0 in, 1 out, 2 break, 3 overtime)
  tipoRaw: number;
  workType: number;
}

// En Anviz TC-B, el offset 0 de segundos corresponde al 2000-01-02 00:00:00 hora local
// (comprobado contra los registros del log y .mdb de CrossChex Standard).
const EPOCA_RELOJ_MS = Date.UTC(2000, 0, 2);

/** Convierte los segundos del reloj (hora local -03:00) a instante real. */
export function fechaReloj(segundos: number): { fechaHora: Date; fecha: string } {
  const localMs = EPOCA_RELOJ_MS + segundos * 1000;
  return {
    fechaHora: new Date(localMs - OFFSET_RELOJ_MIN * 60_000),
    fecha: new Date(localMs).toISOString().slice(0, 10),
  };
}

export const BYTES_POR_REGISTRO = 14;

/** Data del cmd 0x40: cantidad (1 byte) + N registros de 14 bytes. */
export function parsearRegistros(data: Buffer): RegistroReloj[] {
  if (data.length === 0) return [];
  const cantidad = data[0];
  const out: RegistroReloj[] = [];
  for (let i = 0; i < cantidad; i++) {
    const o = 1 + i * BYTES_POR_REGISTRO;
    if (o + BYTES_POR_REGISTRO > data.length) break;
    const userId = data[o] * 2 ** 32 + data.readUInt32BE(o + 1);
    const segundos = data.readUInt32BE(o + 5);
    const modo = data[o + 9];
    const tipoRaw = data[o + 10];
    const workType = (data[o + 11] << 16) | (data[o + 12] << 8) | data[o + 13];
    out.push({
      userId: String(userId),
      segundos,
      ...fechaReloj(segundos),
      modo,
      tipo: tipoRaw & 0x0f,
      tipoRaw,
      workType,
    });
  }
  return out;
}

export interface Info1 {
  firmware: string;
  claveComunicacion: number;
  sleepMin: number;
  volumen: number;
  idioma: number;
  formatoFecha: number;
  formatoHora: number;
}

/** Data del cmd 0x30 (18 bytes): firmware (8 ascii), clave (3), sleep, volumen, idioma, fmt fecha, fmt hora, ... */
export function parsearInfo1(data: Buffer): Info1 {
  if (data.length < 13) throw new Error(`Respuesta de info corta (${data.length} bytes)`);
  return {
    firmware: data.subarray(0, 8).toString('ascii').replace(/\0+$/, ''),
    claveComunicacion: (data[8] << 16) | (data[9] << 8) | data[10],
    sleepMin: data[11],
    volumen: data[12],
    idioma: data[13] ?? 0,
    formatoFecha: data[14] ?? 0,
    formatoHora: data[15] ?? 0,
  };
}

// ─── Parte de red ────────────────────────────────────────────────────────────

export class AnvizError extends Error {
  constructor(message: string, readonly ret?: number) {
    super(message);
    this.name = 'AnvizError';
  }
}

export interface OpcionesConexion {
  ip: string;
  puerto?: number;
  deviceId: number;
  timeoutMs?: number;
}

/**
 * Conexión TCP a un reloj. Un comando por vez (el protocolo no multiplexa):
 * `enviar` encola y espera la respuesta completa o el timeout.
 */
export class ClienteAnviz {
  private socket: Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private pendiente: { cmd: number; resolve: (r: Respuesta) => void; reject: (e: Error) => void; timer: NodeJS.Timeout } | null = null;
  private cola: Promise<unknown> = Promise.resolve();
  readonly deviceId: number;
  readonly timeoutMs: number;

  constructor(private readonly opts: OpcionesConexion) {
    this.deviceId = opts.deviceId;
    this.timeoutMs = opts.timeoutMs ?? 5000;
  }

  conectar(): Promise<void> {
    return new Promise((resolve, reject) => {
      const s = new Socket();
      const timer = setTimeout(() => {
        s.destroy();
        reject(new AnvizError(`Sin respuesta de ${this.opts.ip}:${this.opts.puerto ?? 5010} (timeout de conexión)`));
      }, this.timeoutMs);
      s.once('error', (e) => {
        clearTimeout(timer);
        reject(new AnvizError(`No se pudo conectar a ${this.opts.ip}: ${e.message}`));
      });
      s.connect(this.opts.puerto ?? 5010, this.opts.ip, () => {
        clearTimeout(timer);
        s.removeAllListeners('error');
        s.on('data', (chunk) => this.onData(chunk));
        s.on('error', (e) => this.fallar(new AnvizError(`Error de conexión: ${e.message}`)));
        s.on('close', () => this.fallar(new AnvizError('El reloj cerró la conexión')));
        this.socket = s;
        resolve();
      });
    });
  }

  cerrar(): void {
    const s = this.socket;
    this.socket = null;
    if (s) {
      s.removeAllListeners();
      s.destroy();
    }
    if (this.pendiente) this.fallar(new AnvizError('Conexión cerrada'));
  }

  private fallar(e: Error) {
    const p = this.pendiente;
    if (!p) return;
    this.pendiente = null;
    clearTimeout(p.timer);
    p.reject(e);
  }

  private onData(chunk: Buffer) {
    const { tramas, resto } = extraerTramas(Buffer.concat([this.buffer, chunk]));
    this.buffer = resto;
    for (const trama of tramas) {
      const p = this.pendiente;
      // Trama que nadie pidió (ver `esRespuestaA`): se descarta y se sigue
      // esperando la respuesta real. La fichada empujada no se pierde: el
      // 0x40 de la misma pasada la baja como registro nuevo.
      if (!p || !esRespuestaA(trama, p.cmd)) continue;
      this.pendiente = null;
      clearTimeout(p.timer);
      try {
        p.resolve(parsearRespuesta(trama));
      } catch (e) {
        p.reject(e instanceof Error ? e : new Error(String(e)));
      }
    }
  }

  /** Envía un comando y espera su respuesta (serializado). */
  enviar(cmd: number, data?: Uint8Array): Promise<Respuesta> {
    const run = () =>
      new Promise<Respuesta>((resolve, reject) => {
        if (!this.socket) return reject(new AnvizError('No conectado'));
        this.buffer = Buffer.alloc(0);
        const timer = setTimeout(() => {
          this.pendiente = null;
          reject(new AnvizError(`El reloj no respondió al comando 0x${cmd.toString(16)} (timeout)`));
        }, this.timeoutMs);
        this.pendiente = { cmd, resolve, reject, timer };
        this.socket.write(armarTrama(this.deviceId, cmd, data));
      });
    const p = this.cola.then(run, run);
    this.cola = p.catch(() => undefined);
    return p;
  }

  private async exigirOk(cmd: number, data?: Uint8Array): Promise<Respuesta> {
    const r = await this.enviar(cmd, data);
    if (r.ret !== RET.OK) throw new AnvizError(`El reloj respondió con error 0x${r.ret.toString(16)} al comando 0x${cmd.toString(16)}`, r.ret);
    return r;
  }

  async obtenerInfo(): Promise<Info1> {
    return parsearInfo1((await this.exigirOk(CMD.INFO1)).data);
  }

  async obtenerContadores(): Promise<Contadores> {
    return parsearContadores((await this.exigirOk(CMD.CONTADORES)).data);
  }

  /**
   * Descarga registros: primer lote con param 1 (todos) o 2 (nuevos) y sigue con
   * param 0 hasta que el reloj devuelva menos de 25 o "vacío". `onLote` permite
   * procesar de a lotes sin acumular todo en memoria.
   */
  async descargarRegistros(modo: ModoDescarga, onLote?: (lote: RegistroReloj[]) => Promise<void> | void, maxLotes = 4000): Promise<RegistroReloj[]> {
    const todos: RegistroReloj[] = [];
    let param = modo === 'todos' ? 1 : 2;
    for (let i = 0; i < maxLotes; i++) {
      const r = await this.enviar(CMD.REGISTROS, new Uint8Array([param, MAX_REGISTROS_POR_TRAMA]));
      if (r.ret === RET.EMPTY || r.ret === RET.FAIL) break; // sin (más) registros
      if (r.ret !== RET.OK) throw new AnvizError(`El reloj respondió con error 0x${r.ret.toString(16)} al bajar registros`, r.ret);
      const lote = parsearRegistros(r.data);
      if (lote.length === 0) break;
      if (onLote) await onLote(lote);
      else todos.push(...lote);
      if (lote.length < MAX_REGISTROS_POR_TRAMA) break;
      param = 0;
    }
    return todos;
  }

  /** Borra la marca de "nuevos" de `cantidad` registros (lo que hace CrossChex tras descargar). */
  async limpiarNuevos(cantidad: number): Promise<void> {
    const n = Math.max(0, Math.min(cantidad, 0xffffff));
    await this.exigirOk(CMD.LIMPIAR_NUEVOS, new Uint8Array([2, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]));
  }
}

/** Abre, ejecuta `fn` y cierra siempre. */
export async function conReloj<T>(opts: OpcionesConexion, fn: (c: ClienteAnviz) => Promise<T>): Promise<T> {
  const c = new ClienteAnviz(opts);
  await c.conectar();
  try {
    return await fn(c);
  } finally {
    c.cerrar();
  }
}
