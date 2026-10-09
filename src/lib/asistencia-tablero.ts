/**
 * Servidor de las vistas Día y Mes de Asistencia (lo que revisa RR.HH.). Arman sobre el mismo
 * calendario (`calendarioRango`): solo personas activas con horario. La lectura de cada día y el
 * resumen por persona están en `asistencia-tablero-calc.ts`.
 */

import { prisma } from './prisma';
import { AsistenciaError } from './asistencia';
import { hoyLocal, sumarDias } from './asistencia-datos';
import { resumenLiquidacion, type CeldaDia } from './asistencia-calendario';
import { calendarioMes, calendarioRango, type FilaCalendarioMes } from './asistencia-horarios';
import { resumenMesPersona, type ResumenMesPersona } from './asistencia-tablero-calc';

/** Organigrama de la ficha: los de producción son sedes (Central, General Paz…). */
interface Lugar {
  id: number;
  nombre: string;
}

interface PersonaTablero {
  clave: string;
  empleadoId: number | null;
  userIds: string[];
  nombre: string;
  area: string | null;
  fotoArchivo: string | null;
  lugarId: number | null;
}

/** Lugar de cada fila (organigrama de su ficha) y la lista de lugares que aparecen. */
async function conLugares(filas: FilaCalendarioMes[]): Promise<{ lugares: Lugar[]; persona: (f: FilaCalendarioMes) => PersonaTablero }> {
  const ids = filas.map((f) => f.empleadoId).filter((id): id is number => id != null);
  const fichas = ids.length ? await prisma.orgEmpleado.findMany({ where: { id: { in: ids } }, select: { id: true, organigrama_id: true } }) : [];
  const lugarDe = new Map(fichas.map((e) => [e.id, e.organigrama_id]));
  const lugarIds = [...new Set(fichas.map((e) => e.organigrama_id).filter((id): id is number => id != null))];
  const lugares = lugarIds.length
    ? await prisma.organigrama.findMany({ where: { id: { in: lugarIds } }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } })
    : [];
  const persona = (f: FilaCalendarioMes): PersonaTablero => ({
    clave: f.clave,
    empleadoId: f.empleadoId,
    userIds: f.userIds,
    nombre: f.nombre,
    area: f.area,
    fotoArchivo: f.fotoArchivo,
    lugarId: f.empleadoId != null ? lugarDe.get(f.empleadoId) ?? null : null,
  });
  return { lugares, persona };
}

// ─── Día ─────────────────────────────────────────────────────────────────────

/** Días hacia atrás en que se busca el último día con jornada para "quedó para revisar" (el lunes mira el viernes). */
const DIAS_ATRAS_REVISION = 3;

export interface PersonaDia extends PersonaTablero {
  celda: CeldaDia;
  /**
   * Su último día anterior con jornada (dentro de `DIAS_ATRAS_REVISION`), o null. Es por persona: con sábados
   * alternos, el lunes de quien no trabajó el sábado tiene que mirar el viernes.
   */
  anterior: CeldaDia | null;
}

export interface TableroDia {
  fecha: string;
  hoy: string;
  feriado: boolean;
  /** Desde cuántos minutos una llegada tarde es grave (`AsistenciaConfig`). */
  tardeGraveMin: number;
  lugares: Lugar[];
  personas: PersonaDia[];
  truncado: boolean;
}

export async function tableroDia(fecha: string): Promise<TableroDia> {
  const hoy = hoyLocal();
  if (fecha > hoy) throw new AsistenciaError('Elegí un día de hoy para atrás');
  const cal = await calendarioRango(sumarDias(fecha, -DIAS_ATRAS_REVISION), fecha, false);
  const iDia = cal.dias.length - 1;
  const { lugares, persona } = await conLugares(cal.filas);
  return {
    fecha,
    hoy,
    feriado: cal.feriados.includes(fecha),
    tardeGraveMin: cal.config.tardeGraveMin,
    lugares,
    personas: cal.filas.map((f) => ({ ...persona(f), celda: f.celdas[iDia], anterior: f.celdas.slice(0, iDia).findLast((c) => c.jornada) ?? null })),
    truncado: cal.truncado,
  };
}

// ─── Mes ─────────────────────────────────────────────────────────────────────

export interface PersonaMes extends PersonaTablero {
  resumen: ResumenMesPersona;
}

export interface TableroMes {
  mes: string;
  hoy: string;
  lugares: Lugar[];
  personas: PersonaMes[];
  truncado: boolean;
}

export async function tableroMes(mes: string): Promise<TableroMes> {
  const cal = await calendarioMes(mes, false);
  const hoyEnMes = cal.hoy >= cal.desde && cal.hoy <= cal.hasta;
  const { lugares, persona } = await conLugares(cal.filas);
  return {
    mes,
    hoy: cal.hoy,
    lugares,
    personas: cal.filas.map((f) => ({ ...persona(f), resumen: resumenMesPersona(resumenLiquidacion(f.celdas), hoyEnMes) })),
    truncado: cal.truncado,
  };
}
