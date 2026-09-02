/**
 * Nómina — hashes y cadena de constancias. Solo servidor (y tests): usa
 * node:crypto. El cliente nunca calcula hashes, los recibe de la API.
 *
 * Evidencia de cada firma: quién (empId + CUIL, PIN verificado), qué (SHA-256
 * del recibo canónico), cuándo (fecha ISO), cómo (canal, conformidad,
 * observaciones) y encadenado con la constancia anterior (chainHash) para
 * detectar alteraciones.
 */

import { createHash } from 'node:crypto';
import { canonicalJson, type ReciboPayload } from './nomina-calc';

export const GENESIS = '0'.repeat(64);

export function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

/** Hash del PIN ligado al CUIL (solo dígitos). Nunca se guarda el PIN. */
export function pinHash(pin: string, cuil: string): string {
  return sha256('pin:' + String(pin).trim() + ':' + String(cuil || '').replace(/\D/g, ''));
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
  conformidad: string;
  observaciones: string;
}

export function chainHash(prev: string, c: Omit<ConstanciaMin, 'prev_hash' | 'chain_hash'>): string {
  return sha256(prev + '|' + c.hash + '|' + c.fecha + '|' + c.empleado_id + '|' + c.periodo + '|' + c.conformidad + '|' + (c.observaciones || ''));
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
