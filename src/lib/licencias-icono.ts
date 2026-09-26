/**
 * Manejo del ícono físico y del formulario multipart de las licencias de
 * software (solo servidor). Compartido por las rutas de alta y edición para no
 * duplicar validación ni reglas del ícono.
 */
import { randomUUID } from 'crypto';
import { mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { EXT_POR_MIME_IMAGEN } from './archivos';
import { descargarFavicon } from './favicon';
import { LICENCIA_MONEDAS, LICENCIA_PERIODICIDADES } from './organigrama';

export const LICENCIAS_DIR = join(process.cwd(), 'uploads', 'organigrama', 'licencias');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const ICONO_MAX_BYTES = 2 * 1024 * 1024;

export function guardarIcono(buffer: Buffer, ext: string): string {
  const storedName = `${randomUUID()}.${ext.replace(/^\./, '')}`;
  mkdirSync(LICENCIAS_DIR, { recursive: true });
  writeFileSync(join(LICENCIAS_DIR, storedName), buffer);
  return storedName;
}

/** Best-effort: si el archivo ya no está, no pasa nada. */
export function borrarIcono(nombreArchivo: string | null | undefined): void {
  if (!nombreArchivo) return;
  try {
    unlinkSync(join(LICENCIAS_DIR, nombreArchivo));
  } catch {}
}

/** Descarga el favicon del sitio y lo guarda. Null si no se pudo. */
export async function guardarFaviconDe(sitioUrl: string): Promise<string | null> {
  const img = await descargarFavicon(sitioUrl);
  return img ? guardarIcono(img.buffer, img.ext) : null;
}

export class LicenciaFormError extends Error {}

export interface LicenciaForm {
  titulo: string;
  cuenta: string;
  password: string | null;
  sitio_url: string | null;
  costo: number | null;
  moneda: string | null;
  periodicidad: string | null;
  /** Ícono subido a mano (ya validado), o null si no vino. */
  icono: { buffer: Buffer; ext: string } | null;
  quitar_icono: boolean;
}

function texto(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

/** Valida y normaliza el multipart de alta/edición. Tira LicenciaFormError con mensaje para el usuario. */
export async function parseLicenciaForm(fd: FormData): Promise<LicenciaForm> {
  const titulo = texto(fd, 'titulo');
  const cuenta = texto(fd, 'cuenta');
  if (!titulo) throw new LicenciaFormError('El título es requerido');
  if (!cuenta) throw new LicenciaFormError('El usuario o mail es requerido');

  const moneda = texto(fd, 'moneda');
  if (moneda && !(LICENCIA_MONEDAS as readonly string[]).includes(moneda)) {
    throw new LicenciaFormError('Moneda inválida');
  }
  const periodicidad = texto(fd, 'periodicidad');
  if (periodicidad && !(LICENCIA_PERIODICIDADES as readonly string[]).includes(periodicidad)) {
    throw new LicenciaFormError('Periodicidad inválida');
  }
  const costoRaw = texto(fd, 'costo');
  let costo: number | null = null;
  if (costoRaw) {
    costo = Number(costoRaw.replace(',', '.'));
    if (!Number.isFinite(costo) || costo < 0) throw new LicenciaFormError('Costo inválido');
  }

  let icono: LicenciaForm['icono'] = null;
  const file = fd.get('icono');
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new LicenciaFormError('Ícono no permitido. Use PNG, JPG, WebP, GIF o SVG.');
    }
    if (file.size > ICONO_MAX_BYTES) throw new LicenciaFormError('El ícono no puede superar 2 MB');
    // Extensión según el tipo aceptado, no el nombre del cliente (se sirve por extensión).
    const ext = EXT_POR_MIME_IMAGEN[file.type].slice(1);
    icono = { buffer: Buffer.from(await file.arrayBuffer()), ext };
  }

  // Sin costo no guardamos moneda ni periodicidad sueltas; con costo, moneda por defecto USD.
  const hayCosto = costo != null;
  return {
    titulo,
    cuenta,
    password: texto(fd, 'password'),
    sitio_url: texto(fd, 'sitio_url'),
    costo,
    moneda: hayCosto ? moneda ?? 'USD' : null,
    periodicidad: hayCosto ? periodicidad : null,
    icono,
    quitar_icono: fd.get('quitar_icono') === '1',
  };
}
