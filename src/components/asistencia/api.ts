/** Tipos de las respuestas de /api/admin/asistencia/** (el fetch es `apiFetch` de comunes). */

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

export type { ConfigAsistencia, CeldaDia } from '@/lib/asistencia-calendario';
export type { CalendarioMes, FilaCalendarioMes, MarcaReloj, PerfilPersona, ResultadoGuardar } from '@/lib/asistencia-horarios';
export type { PersonaDia, PersonaMes, TableroDia, TableroMes } from '@/lib/asistencia-tablero';
export type { MiAsistencia } from '@/lib/asistencia-horarios';
/** Respuesta de `GET /api/admin/mi-asistencia`: el usuario puede no tener ficha vinculada. */
export type MiAsistenciaRespuesta =
  | ({ vinculado: true } & import('@/lib/asistencia-horarios').MiAsistencia)
  | { vinculado: false; usuario: string };
