/** fetch JSON con la convención de error del panel ({ error } → Error(message)). */
export async function asistFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json', ...init?.headers } : init?.headers,
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

export function mensajeError(e: unknown, fallback = 'Algo salió mal'): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export interface Reloj {
  id: number;
  nombre: string;
  ip: string;
  puerto: number;
  device_id: number;
  activo: boolean;
  limpiar_nuevos: boolean;
  ultimo_sync: string | null;
  ultimo_error: string | null;
  reg_total: number | null;
  reg_nuevos: number | null;
  usuarios: number | null;
}

export interface Persona {
  id: number;
  userId: string;
  nombreReloj: string;
  empleadoId: number | null;
  empleado: { id: number; nombre: string; rol: string; area: string } | null;
  nombre: string;
  /** Actividad efectiva: el organigrama si está vinculada, `activoPropio` si no. */
  activa: boolean;
  activoPropio: boolean;
  empleadoEstado: string | null;
  ultimaFichada: string | null;
}

export interface FichadaDetalle {
  id: number;
  userId: string;
  nombre: string;
  reloj: string;
  fechaHora: string;
  tipo: number;
  modo: number | null;
  origen: string;
  sospechosa: boolean;
}

export interface FichadaDia {
  userId: string;
  nombre: string;
  fecha: string;
  entrada: string | null;
  salida: string | null;
  marcas: number;
  /** El día no tiene marca de salida. */
  incompleto: boolean;
}

export interface ResultadoSync {
  relojId: number;
  nombre: string;
  bajados: number;
  guardados: number;
  contadores?: { registrosTotales: number; registrosNuevos: number; usuarios: number };
  error?: string;
}

export type { HorarioVersion, ConfigAsistencia, CeldaDia, TotalesFila, DiaCalendario } from '@/lib/asistencia-calendario';
export type { CalendarioMes, FilaCalendarioMes, ResultadoGuardar, ResultadoMigracionLegacy } from '@/lib/asistencia-horarios';
