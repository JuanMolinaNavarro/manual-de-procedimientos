/**
 * Sábado libre elegido: quien tiene `sabadoLibre` en su horario (gerentes que trabajan casi todos
 * los sábados) elige uno por mes desde Mi asistencia, sin aprobación (decisión del usuario
 * 2026-10-14). Cualquier sábado del mes en curso, también los ya pasados; elegir otro lo reemplaza.
 * El estado no se guarda: `calendarioRango` lo lee y `evaluarDia` anula la jornada de ese día.
 */

import { prisma } from './prisma';
import { AsistenciaError } from './asistencia';
import { FECHA_RE } from './asistencia-datos';
import { calendarioRango, listarHorarios } from './asistencia-horarios';
import { diaSemanaDe, versionVigente } from './asistencia-calendario';
import { mesLocal } from './fechas';

const SABADO = 5;

export async function elegirSabadoLibre(empleadoId: number, fecha: unknown, username: string): Promise<{ fecha: string }> {
  if (typeof fecha !== 'string' || !FECHA_RE.test(fecha)) throw new AsistenciaError('Fecha inválida');
  const mes = mesLocal();
  if (fecha.slice(0, 7) !== mes) throw new AsistenciaError('Solo podés elegir un sábado del mes en curso');
  if (diaSemanaDe(fecha) !== SABADO) throw new AsistenciaError('Ese día no es sábado');

  const version = versionVigente(await listarHorarios(empleadoId), fecha);
  if (!version?.incluir || !version.sabadoLibre) throw new AsistenciaError('Tu horario no tiene un sábado libre para elegir', 409);

  const celda = (await calendarioRango(fecha, fecha, false, `e:${empleadoId}`)).filas[0]?.celdas[0];
  if (!celda?.libreElegido) {
    if (!celda?.jornada) throw new AsistenciaError('Ese sábado no te toca trabajar', 409);
    if (celda.marcas > 0) throw new AsistenciaError('Ese sábado fichaste: no puede ser tu sábado libre', 409);
  }

  await prisma.asistenciaSabadoLibre.upsert({
    where: { empleado_id_mes: { empleado_id: empleadoId, mes } },
    create: { empleado_id: empleadoId, mes, fecha, created_by: username, updated_by: username },
    update: { fecha, updated_by: username },
  });
  return { fecha };
}

/** Quita el sábado libre del mes en curso (el de un mes cerrado queda). */
export async function quitarSabadoLibre(empleadoId: number): Promise<void> {
  await prisma.asistenciaSabadoLibre.deleteMany({ where: { empleado_id: empleadoId, mes: mesLocal() } });
}
