/**
 * Los controles de una solicitud en frases simples para RR.HH.: lo que está bien (✓) y lo que el
 * motor marca (`validarSolicitud`). Lo usan la tarjeta de la bandeja y la pantalla de revisión.
 */

import {
  avisoDe, conTurnoTarde, debeVerano, diasDe, inicioValido, noReprog, rangoTocaVerano, solDe, validarSolicitud,
  type EmpleadoVac, type EstadoVac,
} from '@/lib/vacaciones-calc';
import { sumarDias } from '@/lib/asistencia-datos';
import { diaMes, sinCita } from './piezas';

export interface Control { tono: 'ok' | 'error' | 'warn'; txt: string }

const reescribir = (msg: string) => sinCita(msg).replace(' Se puede enviar igual y completarlos después.', ' Los puede elegir más adelante.');

export function controles(E: EstadoVac, e: EmpleadoVac): { items: Control[]; errores: number; resumen: Control | { tono: 'info'; txt: string } } {
  const s = solDe(E, e.id), d = diasDe(E, e.id), c = E.config, nr = noReprog(s);
  const flags = validarSolicitud(E, e.id);
  const malos: Control[] = flags.map((f) => ({ tono: f.tipo, txt: reescribir(f.msg) }));
  const errores = malos.filter((m) => m.tono === 'error');
  const sinCupo = flags.some((f) => f.tipo === 'error' && /cupo|cerrada|Regla «|personas mínimas/.test(f.msg));

  const bien: Control[] = [];
  const ok = (txt: string) => bien.push({ tono: 'ok', txt });
  if (d.anios !== null) {
    ok(d.proporcional
      ? `Le corresponden ${d.total} días, proporcionales a lo que trabajó.`
      : `Le corresponden ${d.total} días: tiene ${d.anios} año${d.anios === 1 ? '' : 's'} de antigüedad.`);
  }
  if (s.tramos.length && s.tramos.every((t) => t.reprog || inicioValido(E, e.id, t.desde).ok)) ok(nr.length > 1 ? 'Cada parte empieza en un día válido.' : 'Empieza en un día válido.');
  if (s.tramos.length && s.tramos.every((t) => t.desde >= c.temporadaDesde && t.hasta <= c.temporadaHasta)) {
    ok(`Está dentro de la temporada (${diaMes(c.temporadaDesde)} al ${diaMes(c.temporadaHasta)}).`);
  }
  if (debeVerano(E, e.id) && s.tramos.some((t) => rangoTocaVerano(c, t.desde, t.hasta))) ok('Le tocaba verano este año y lo tiene.');
  if (e.areaId != null && s.tramos.length && !sinCupo) ok(`Hay lugar en ${e.area} esas semanas.`);
  if (nr.length > 1 && s.acuerdoFracc) ok(`Las dividió en ${nr.length} partes y firmó el acuerdo.`);

  const resumen = errores.length
    ? { tono: 'error' as const, txt: `No se puede aprobar: ${errores[0].txt}${errores.length > 1 ? ` (y ${errores.length - 1} problema${errores.length > 2 ? 's' : ''} más)` : ''}` }
    : malos.length ? malos[0]
      : nr.length > 1 && s.acuerdoFracc ? { tono: 'info' as const, txt: `Las dividió en ${nr.length} partes y firmó el acuerdo para dividirlas.` }
        : { tono: 'ok' as const, txt: e.areaId != null ? 'Cumple todo. Hay lugar en su área esas semanas.' : 'Cumple todo.' };

  return { items: [...bien, ...malos], errores: errores.length, resumen };
}

/** Problemas de la configuración de la temporada, en una frase cada uno. */
export function avisosDeConfiguracion(E: EstadoVac): string[] {
  const c = E.config, avisos: string[] = [];
  if (!c.feriados.some((f) => f >= c.temporadaDesde && f <= c.temporadaHasta)) avisos.push('No hay feriados cargados para esta temporada.');
  const tarde = conTurnoTarde(E);
  if (tarde) avisos.push(`${tarde === 1 ? 'A 1 persona le toca' : `A ${tarde} personas les toca`} elegir después de la fecha límite.`);
  return avisos;
}

/** Último día para entregar el aviso por escrito del primer tramo (null sin tramos). */
export function limiteAviso(E: EstadoVac, id: number): string | null {
  const primero = noReprog(solDe(E, id)).map((t) => t.desde).sort()[0];
  return primero ? sumarDias(primero, -avisoDe(E, id)) : null;
}
