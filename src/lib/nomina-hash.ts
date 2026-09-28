/**
 * Nómina — hashes y cadena de constancias. Solo servidor (y tests): usa
 * node:crypto. El cliente nunca calcula hashes, los recibe de la API.
 *
 * Evidencia de cada firma: quién (empId + CUIL, PIN verificado), qué (SHA-256
 * del PDF del recibo de Finnegans + su id), cuándo (fecha ISO), cómo (conformidad,
 * observaciones) y encadenado con la constancia anterior (chainHash) para
 * detectar alteraciones. El hash del PIN vive en `nomina-pin.ts` (scrypt).
 * `reciboHash` queda para el recibo simulado del motor propio (ya no se firma).
 */

import { createHash } from 'node:crypto';
import { canonicalJson, type ReciboPayload } from './nomina-calc';

/**
 * Formato de la cadena de constancias. v1 encadenaba solo qué/cuándo/cómo; v2 suma quién y
 * desde dónde (firmante con su código de adhesión, IP, dispositivo, canal y "leído"), así un
 * cambio en esos campos también rompe la cadena. Las constancias viejas quedan en v1 y se
 * verifican con su fórmula.
 */
export const FORMATO_CADENA = 2;

export const GENESIS = '0'.repeat(64);

export function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

export function reciboHash(payload: ReciboPayload): string {
  return sha256(canonicalJson(payload));
}

export interface ConstanciaMin {
  hash: string;
  prev_hash: string;
  chain_hash: string;
  fecha: string;
  empleado_id: number;
  periodo: string;
  recibo_id: string;
  conformidad: string;
  observaciones: string;
  /** 1 (sin estos campos) o 2. Ausente = 1. */
  formato?: number;
  firmante?: unknown;
  ip?: string;
  dispositivo?: string;
  canal?: string;
  leido?: boolean;
}

export function chainHash(prev: string, c: Omit<ConstanciaMin, 'prev_hash' | 'chain_hash'>): string {
  const partes: (string | number)[] = [prev, c.hash, c.fecha, c.empleado_id, c.periodo, c.recibo_id, c.conformidad, c.observaciones || ''];
  if ((c.formato ?? 1) >= 2) {
    partes.push(canonicalJson(c.firmante ?? null), c.ip ?? '', c.dispositivo ?? '', c.canal ?? '', c.leido ? '1' : '0');
  }
  return sha256(partes.join('|'));
}

/** Verifica una cadena ya ordenada (fecha asc, id asc). */
export function verificarCadena(ordenadas: ConstanciaMin[]): { total: number; rotos: number } {
  let prev = GENESIS, rotos = 0;
  for (const c of ordenadas) {
    const esperado = chainHash(prev, c);
    if (c.prev_hash !== prev || c.chain_hash !== esperado) rotos++;
    prev = c.chain_hash;
  }
  return { total: ordenadas.length, rotos };
}
