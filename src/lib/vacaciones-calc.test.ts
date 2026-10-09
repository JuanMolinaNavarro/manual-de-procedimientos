import { describe, it, expect } from 'vitest';
import {
  CONFIG_DEFAULT, acusarRecibo, agregarTramo, anticipos, aperturaDe, aprobar, aprobarReprogramacion,
  autorizarFueraTermino, avisoEstado, candidatosPermuta, cerrarTemporada, conTurnoTarde, conformidadFraccionamiento, convenioAuto,
  convenioCodigo, devolver, diasDe, diasPorAntiguedad, diasPorMes, enviar, fechaCorte, grupoDe, iniciosPosibles, interrumpir, legalesDe,
  maxTramosDe, notificar, ocupacionSemana, ordenEleccion, paraPortal, pendienteReprog, permutar, problemasDePersonas, quitarTramo, reabrir, turnoAbierto, usadosDe,
  validarSolicitud, validarTramo, ventanaBloqueada, vueltaDe,
  type AreaVac, type ConfigVacaciones, type EmpleadoVac, type EstadoVac, type Flag, type PerfilVac, type Resultado,
} from './vacaciones-calc';

// La nómina de ejemplo del prototipo (test_vacation_desk.js): los mandos fuera de convenio.
const SAT = 'Satsaid 223/75 · GRUPO 3';
const PERSONAS: [number, string, string, number, string, string][] = [
  [1, 'Carlos González', 'Director General', 1, 'Fuera de Convenio', '2005-03-01'],
  [2, 'Marina Fernández', 'Recursos Humanos', 2, 'Fuera de Convenio', '2012-05-10'],
  [3, 'Facundo Olarte', 'Desarrollo e Ingeniería', 3, 'Fuera de Convenio', '2016-06-15'],
  [4, 'Sofia López', 'Comercial', 4, 'Fuera de Convenio', '2019-08-01'],
  [5, 'Ana Fernández', 'Liquidación de sueldos', 2, SAT, '2019-04-01'],
  [6, 'Luis García', 'Reclutamiento', 2, SAT, '2021-02-01'],
  [7, 'Pablo Sánchez', 'Backend Senior', 3, SAT, '2017-02-10'],
  [8, 'Rosa Domínguez', 'Frontend Developer', 3, SAT, '2018-07-02'],
  [9, 'Marcos Silva', 'Soporte Técnico', 3, SAT, '2014-11-03'],
  [10, 'Valeria Acosta', 'Ejecutiva de Ventas', 4, SAT, '2022-06-06'],
  [11, 'Marco Ruiz', 'Account Manager', 4, SAT, '2020-01-15'],
];
const NOMBRES_AREA: Record<number, string> = { 1: 'Dirección', 2: 'RRHH', 3: 'Tecnología', 4: 'Ventas' };
const CUPOS: Record<number, number | null> = { 1: null, 2: 2, 3: 3, 4: 2 };

const empleados: EmpleadoVac[] = PERSONAS.map(([id, nombre, rol, areaId, convenioTexto, fechaIngreso]) => ({
  id, nombre, rol, area: NOMBRES_AREA[areaId], areaId, organigramaId: 1, organigrama: 'Central', fotoArchivo: null,
  convenioTexto, fechaIngreso, categoria: '', basico: 0,
}));
const areas: Record<number, AreaVac> = Object.fromEntries([1, 2, 3, 4].map((id) => [id, {
  id, nombre: NOMBRES_AREA[id], organigramaId: 1, color: '#888', jefeId: null, segundoId: null,
  cupo: CUPOS[id], semanas: {}, reglas: [], nota: '',
}]));

function base(config: Partial<ConfigVacaciones> = {}, hoy = '2026-10-05'): EstadoVac {
  return { hoy, config: { ...CONFIG_DEFAULT, ...config }, empleados, perfiles: {}, areas, solicitudes: {} };
}
const conHoy = (E: EstadoVac, hoy: string): EstadoVac => ({ ...E, hoy });
const conPerfil = (E: EstadoVac, id: number, p: Partial<PerfilVac>): EstadoVac =>
  ({ ...E, perfiles: { ...E.perfiles, [id]: { ...E.perfiles[id], ...p } } });
const conArea = (E: EstadoVac, id: number, a: Partial<AreaVac>): EstadoVac => ({ ...E, areas: { ...E.areas, [id]: { ...E.areas[id], ...a } } });
function aplicar(E: EstadoVac, id: number, r: Resultado): EstadoVac {
  if (!r.ok) throw new Error(r.error);
  return { ...E, solicitudes: { ...E.solicitudes, [id]: r.sol } };
}
const errs = (fs: Flag[]) => fs.filter((f) => f.tipo === 'error').map((f) => f.msg);
const warns = (fs: Flag[]) => fs.filter((f) => f.tipo === 'warn').map((f) => f.msg);

/** Agrega los tramos, firma la conformidad si hace falta y envía. */
function cargarYEnviar(E: EstadoVac, id: number, tramos: [string, number][]): EstadoVac {
  for (const [d, n] of tramos) E = aplicar(E, id, agregarTramo(E, id, d, n, {}, 'test'));
  if (tramos.length > 1) E = aplicar(E, id, conformidadFraccionamiento(E, id, true, 'test', 'portal'));
  return aplicar(E, id, enviar(E, id));
}

describe('días que corresponden (arts. 150, 151, 153, 164)', () => {
  it('art. 150: "excede" es estricto (5 años justos al corte son 14 días)', () => {
    expect(diasPorAntiguedad('2021-12-31', '2026-12-31')).toBe(14);
    expect(diasPorAntiguedad('2021-12-30', '2026-12-31')).toBe(21);
    expect(diasPorAntiguedad('2016-12-31', '2026-12-31')).toBe(21);
    expect(diasPorAntiguedad('2016-12-30', '2026-12-31')).toBe(28);
    expect(diasPorAntiguedad('2006-12-30', '2026-12-31')).toBe(35);
  });
  it('convenio automático desde el texto de la ficha', () => {
    expect(convenioAuto('Satsaid 223/75 · GRUPO 3')).toBe('CCT223');
    expect(convenioAuto('Fuera de Convenio')).toBe('LCT');
    expect(convenioAuto('Comercio (CCT 130/75)')).toBe('CCT130');
    expect(convenioAuto('')).toBe('LCT');
  });
  it('corte de antigüedad por convenio: CCT 223 al 31/03 del año siguiente', () => {
    const E = base();
    expect(convenioCodigo(E, 7)).toBe('CCT223');
    expect(convenioCodigo(E, 1)).toBe('LCT');
    expect(fechaCorte(E, 7)).toBe('2027-03-31');
    expect(diasDe(E, 7).legales).toBe(28); // 10/02/2017 → excede 10 años al 31/03/2027
    expect(diasDe(conPerfil(E, 7, { convenio: 'LCT' }), 7).legales).toBe(21); // al 31/12/2026, 9 años
  });
  it('máximo de tramos: el menor entre la política y el convenio', () => {
    const E = base();
    expect(maxTramosDe(E, 7)).toBe(2);
    expect(maxTramosDe(E, 1)).toBe(3);
  });
  it('saldos separados y arrastre del art. 164 (solo con acuerdo, hasta 1/3)', () => {
    let E = conPerfil(base(), 11, { extraConvenio: 2, extraBeneficio: 3 });
    const d = diasDe(E, 11);
    expect(d.total).toBe(d.legales + 5);
    E = conPerfil(E, 11, { arrastre: { dias: 10, acuerdo: false, origen: 2025 } });
    expect(diasDe(E, 11).arrastre).toBe(0);
    E = conPerfil(E, 11, { arrastre: { dias: 10, acuerdo: true, origen: 2025 } });
    expect(diasDe(E, 11).arrastre).toBe(Math.floor(legalesDe(E, 11, 2025).legales / 3));
    expect(warns(validarSolicitud(E, 11)).some((m) => /se limitó a 7 días/.test(m))).toBe(true); // pidió 10, tope 21/3
  });
  it('art. 153: sin la mitad de los hábiles, 1 día cada 20 trabajados', () => {
    const E = { ...base(), empleados: empleados.map((e) => (e.id === 6 ? { ...e, fechaIngreso: '2026-09-01' } : e)) };
    const d = diasDe(E, 6);
    expect(d.proporcional).toBe(true);
    expect(d.legales).toBe(Math.floor(d.trabajados / 20));
    expect(d.legales).toBeGreaterThan(0);
  });
});

describe('tramos (arts. 151 y 154)', () => {
  it('art. 151: lunes, o el hábil siguiente si el lunes es feriado', () => {
    const E = base({ feriados: ['2026-11-23'] });
    expect(errs(validarTramo(E, 9, '2026-11-03', 14)).some((m) => /lunes/.test(m))).toBe(true);
    expect(errs(validarTramo(E, 9, '2026-11-02', 14)).some((m) => /lunes/.test(m))).toBe(false);
    expect(errs(validarTramo(E, 9, '2026-11-23', 14)).some((m) => /feriado/.test(m))).toBe(true);
    expect(errs(validarTramo(E, 9, '2026-11-24', 14)).some((m) => /lunes|feriado/.test(m))).toBe(false);
    const inicios = iniciosPosibles(E, 9);
    expect(inicios[0]).toBe('2026-10-12'); // hoy es lunes 5: mañana en adelante
    expect(inicios).toContain('2026-11-24');
    expect(inicios).not.toContain('2026-11-23');
  });
  it('día de vuelta: salta el descanso semanal y los feriados', () => {
    expect(vueltaDe('2026-11-15', [])).toBe('2026-11-16'); // termina domingo → lunes
    expect(vueltaDe('2026-11-14', [])).toBe('2026-11-16'); // termina sábado → el domingo no cuenta
    expect(vueltaDe('2026-11-22', ['2026-11-23'])).toBe('2026-11-24'); // lunes feriado
    expect(vueltaDe('2026-11-13', [], 6)).toBe('2026-11-15'); // franco rotativo con descanso sábado
  });
  it('art. 151 con francos rotativos: el día siguiente al descanso', () => {
    const E = conPerfil(base({ feriados: ['2026-11-04'] }), 9, { francoRotativo: true, diaDescanso: 2 });
    expect(errs(validarTramo(E, 9, '2026-11-11', 14)).some((m) => /descanso/.test(m))).toBe(false); // miércoles
    expect(errs(validarTramo(E, 9, '2026-11-02', 14)).some((m) => /descanso/.test(m))).toBe(true); // lunes
    expect(errs(validarTramo(E, 9, '2026-11-05', 14)).some((m) => /descanso/.test(m))).toBe(false); // miércoles feriado → jueves
  });
  it('fuera del 1/10–30/4 solo de mutuo acuerdo, y queda registrado', () => {
    const E = base();
    expect(errs(validarTramo(E, 10, '2027-05-03', 14)).some((m) => /acuerdo/.test(m))).toBe(true);
    const v = validarTramo(E, 10, '2027-05-03', 14, undefined, { fueraAcuerdo: true });
    expect(errs(v)).toEqual([]);
    expect(warns(v).some((m) => /mutuo acuerdo/.test(m))).toBe(true);
    const r = agregarTramo(E, 10, '2027-05-03', 14, { fueraAcuerdo: true }, 'RRHH');
    expect(r.ok && r.sol.tramos[0].fueraTemp?.por).toBe('RRHH');
  });
  it('fraccionar exige tramos de 7 días o más y conformidad de la persona', () => {
    let E = base();
    expect(errs(validarTramo(E, 5, '2026-11-02', 5)).some((m) => /al menos 7/.test(m))).toBe(true);
    E = aplicar(E, 5, agregarTramo(E, 5, '2026-11-02', 14, {}, 'test'));
    E = aplicar(E, 5, agregarTramo(E, 5, '2027-02-01', 7, {}, 'test'));
    expect(errs(validarSolicitud(E, 5)).some((m) => /conformidad/.test(m))).toBe(true);
    E = aplicar(E, 5, conformidadFraccionamiento(E, 5, true, 'Ana', 'portal'));
    expect(errs(validarSolicitud(E, 5))).toEqual([]);
    expect(errs(validarTramo(E, 5, '2027-03-01', 7)).some((m) => /máximo 2/.test(m))).toBe(true);
    // Cambiar el plan anula la conformidad.
    const E2 = aplicar(E, 5, agregarTramo({ ...E, solicitudes: {} }, 5, '2026-11-09', 7, {}, 'test'));
    expect(E2.solicitudes[5].acuerdoFracc).toBeNull();
    expect(enviar(E, 5).ok).toBe(true);
  });
});

describe('orden de elección y garantía de verano (art. 154)', () => {
  it('rotación: quien eligió último el año pasado va antes', () => {
    let E = conPerfil(base(), 10, { historial: { 2025: { verano: true, pos: 10 } } });
    E = conPerfil(E, 11, { historial: { 2025: { verano: true, pos: 0 } } });
    const orden = ordenEleccion(E, grupoDe(empleados[9])).map((e) => e.id);
    expect(orden.indexOf(10)).toBeLessThan(orden.indexOf(11));
  });
  it('dos temporadas sin verano: elige primero y se le avisa si no pide verano', () => {
    let E = conPerfil(base(), 9, { historial: { 2025: { verano: false, pos: 3 }, 2024: { verano: false, pos: 2 } } });
    const orden = ordenEleccion(E, grupoDe(empleados[8])).map((e) => e.id);
    expect(orden[0]).toBe(9);
    expect(aperturaDe(E, orden[0])).toBe('2026-09-28');
    expect(aperturaDe(E, orden[3])).toBe('2026-09-30'); // turnos de 3 personas cada 2 días
    expect(turnoAbierto(conHoy(E, '2026-09-28'), orden[3])).toBe(false);
    // Si los turnos no entran antes de la fecha límite de carga, Configuración lo avisa.
    expect(conTurnoTarde(E)).toBe(0);
    expect(conTurnoTarde({ ...E, config: { ...E.config, fechaLimiteCarga: '2026-09-29' } })).toBe(1);
    E = aplicar(E, 9, agregarTramo(E, 9, '2026-11-02', 21, {}, 'test'));
    expect(warns(validarSolicitud(E, 9)).some((m) => /corresponde verano/.test(m))).toBe(true);
    E = { ...E, solicitudes: {} };
    E = aplicar(E, 9, agregarTramo(E, 9, '2027-01-04', 21, {}, 'test'));
    expect(warns(validarSolicitud(E, 9)).some((m) => /corresponde verano/.test(m))).toBe(false);
  });
});

describe('cobertura del área', () => {
  it('cupo semanal, jefe y segundo, mínimo de presentes', () => {
    let E = conArea(base(), 3, { jefeId: 3, segundoId: 7 });
    E = cargarYEnviar(E, 7, [['2026-11-09', 14], ['2027-01-11', 14]]);
    expect(errs(validarTramo(E, 3, '2026-11-09', 14)).some((m) => /Jefe y segundo/.test(m))).toBe(true);
    expect(errs(validarTramo(E, 3, '2026-12-07', 14)).some((m) => /Jefe y segundo/.test(m))).toBe(false);
    // En el portal no se ve el nombre ni las fechas del otro (ni en el tramo ni en la revisión general).
    const portal = validarTramo(E, 3, '2026-11-09', 14).map(paraPortal).map((f) => f.msg).join(' ');
    expect(portal).toMatch(/otra persona de tu área/);
    expect(portal).not.toMatch(/Pablo|Sánchez|01\/2027|Jefe y segundo/);
    E = aplicar(E, 3, agregarTramo(conArea(E, 3, { jefeId: null }), 3, '2026-11-09', 14, {}, 'test'));
    expect(validarSolicitud(E, 3).map(paraPortal).some((f) => /Tramo 9 nov: Esas fechas se cruzan/.test(f.msg))).toBe(true);
    E = conArea(E, 3, { reglas: [{ tipo: 'minimo', nombre: 'Guardia técnica', min: 2, ids: [7, 8, 9] }] });
    expect(errs(validarTramo(E, 8, '2026-11-09', 14)).some((m) => /Guardia técnica/.test(m))).toBe(true);
    E = conArea(E, 3, { reglas: [], cupo: 1 });
    expect(errs(validarTramo(E, 8, '2026-11-09', 14)).some((m) => /cupo \(1\/1\)/.test(m))).toBe(true);
    E = conArea(E, 3, { semanas: { '2026-12-07': 0 } });
    expect(errs(validarTramo(E, 8, '2026-12-07', 14)).some((m) => /cerrada/.test(m))).toBe(true);
  });
});

describe('aprobación, aviso escrito y bloqueo (art. 154)', () => {
  it('notificar 30 días antes, acuse y cambios solo de mutuo acuerdo', () => {
    let E = cargarYEnviar(base(), 7, [['2026-11-09', 14], ['2027-01-11', 14]]);
    expect(devolver(E, 7, '  ').ok).toBe(false);
    E = aplicar(E, 7, aprobar(E, 7));
    expect(avisoEstado(E, 7)?.limite).toBe('2026-10-10');
    // Sin notificar es un problema recién cuando venció el plazo para hacerlo.
    const sinNotificar = (hoy: string) => problemasDePersonas(conHoy(E, hoy)).some((p) => p.empId === 7 && /sin notificación/.test(p.msg));
    expect(sinNotificar('2026-10-10')).toBe(false);
    expect(sinNotificar('2026-10-11')).toBe(true);
    E = aplicar(E, 7, notificar(E, 7, 'RRHH'));
    expect(E.solicitudes[7].notificacion?.fecha).toBe('2026-10-05');
    E = aplicar(E, 7, acusarRecibo(E, 7, 'Pablo'));
    expect(E.solicitudes[7].notificacion?.acuse).toBe('2026-10-05');
    E = conHoy(E, '2026-10-20');
    expect(ventanaBloqueada(E, 7)).toBe(true);
    expect(reabrir(E, 7, 'cambio', false).ok).toBe(false);
    expect(reabrir(E, 7, 'cambio', true).ok).toBe(true);
  });
});

describe('interrupción por enfermedad y reprogramación (art. 154, Ley 27.802)', () => {
  it('sin certificado no interrumpe; el saldo no gozado se reprograma', () => {
    let E = cargarYEnviar(base(), 7, [['2026-11-09', 14], ['2027-01-11', 14]]);
    E = conHoy(aplicar(E, 7, aprobar(E, 7)), '2026-11-12');
    const x = { tramoDesde: '2026-11-09', desde: '2026-11-12', hasta: '2026-11-22', motivo: 'enfermedad', certificado: '', informada: true };
    expect(interrumpir(E, 7, x, 'RRHH').ok).toBe(false);
    expect(interrumpir(E, 7, { ...x, certificado: 'CERT-1', informada: false }, 'RRHH').ok).toBe(false);
    E = aplicar(E, 7, interrumpir(E, 7, { ...x, certificado: 'CERT-123' }, 'RRHH'));
    expect(E.solicitudes[7].tramos[0].hasta).toBe('2026-11-22'); // vuelve al final del período previsto
    expect(pendienteReprog(E, 7)).toBe(11);
    expect(usadosDe(E, 7)).toBe(17);
    expect(interrumpir(base(), 1, { ...x, motivo: 'fallecimiento' }, 'RRHH').ok).toBe(false);
    E = aplicar(E, 7, agregarTramo(E, 7, '2027-02-15', 11, { reprog: true }, 'Pablo'));
    expect(pendienteReprog(E, 7)).toBe(0);
    E = aplicar(E, 7, aprobarReprogramacion(E, 7, '2027-02-15'));
    expect(E.solicitudes[7].tramos.find((t) => t.reprog)?.estadoTramo).toBe('aprobado');
    // Los días de enfermedad no se informan como vacaciones a Nómina.
    const nov = diasPorMes(E).find((r) => r.empId === 7 && r.mes === '2026-11');
    expect(nov?.dias).toBe(3);
  });
});

describe('casos que corrompían datos (auditoría 2026-10)', () => {
  const enfermo = { tramoDesde: '2026-11-09', desde: '2026-11-12', hasta: '2026-11-22', motivo: 'enfermedad', certificado: 'C-1', informada: true };
  /** Pablo (7) con 14 + 14 aprobados y el primer tramo interrumpido 11 días. */
  function interrumpido(): EstadoVac {
    let E = cargarYEnviar(base(), 7, [['2026-11-09', 14], ['2027-01-11', 14]]);
    E = conHoy(aplicar(E, 7, aprobar(E, 7)), '2026-11-12');
    return aplicar(E, 7, interrumpir(E, 7, enfermo, 'RRHH'));
  }

  it('un tramo interrumpido no se puede quitar (sus días no gozados quedarían sueltos)', () => {
    let E = interrumpido();
    E = aplicar(E, 7, reabrir(E, 7, '', true));
    expect(quitarTramo(E, 7, '2026-11-09').ok).toBe(false);
    expect(quitarTramo(E, 7, '2027-01-11').ok).toBe(true);
  });
  it('una reprogramación se valida sin contarse a sí misma', () => {
    let E = interrumpido();
    expect(errs(validarTramo(E, 7, '2027-02-15', 12, undefined, { reprog: true }))).toContain('Solo quedan 11 días por reprogramar.');
    E = aplicar(E, 7, agregarTramo(E, 7, '2027-02-15', 11, { reprog: true }, 'Pablo'));
    expect(errs(validarSolicitud(E, 7)).filter((m) => /reprogramar/.test(m))).toEqual([]);
  });
  it('mínimo de presentes: alguien que ya no está en el organigrama no cuenta como presente', () => {
    const E = conArea(base(), 3, { reglas: [{ tipo: 'minimo', nombre: 'Guardia', min: 1, ids: [7, 999] }] });
    expect(errs(validarTramo(E, 7, '2026-11-09', 14)).some((m) => /Guardia/.test(m))).toBe(true);
  });
  it('claves heredadas de Object no son convenios ni motivos', () => {
    expect(convenioCodigo(conPerfil(base(), 7, { convenio: 'constructor' }), 7)).toBe('CCT223');
    expect(interrumpir(interrumpido(), 7, { ...enfermo, desde: '2026-11-09', hasta: '2026-11-10', motivo: 'toString' }, 'RRHH').ok).toBe(false);
  });
});

describe('derechos de convenio', () => {
  it('permuta: misma función, categoría y días; anula las notificaciones', () => {
    const emps = empleados.map((e) => (e.id === 8 ? { ...e, rol: 'Backend Senior' } : e));
    let E: EstadoVac = { ...base(), empleados: emps };
    E = cargarYEnviar(E, 7, [['2026-11-09', 14], ['2027-01-11', 7]]);
    E = aplicar(E, 7, aprobar(E, 7));
    E = aplicar(E, 7, notificar(E, 7, 'RRHH'));
    E = cargarYEnviar(E, 8, [['2026-12-07', 14], ['2027-03-01', 7]]);
    E = aplicar(E, 8, aprobar(E, 8));
    expect(candidatosPermuta(E, 7).map((e) => e.id)).toEqual([8]);
    const r = permutar(E, 7, 8);
    expect(r.ok && r.solA.tramos[0].desde).toBe('2026-12-07');
    expect(r.ok && r.solB.tramos[0].desde).toBe('2026-11-09');
    expect(r.ok && r.solA.notificacion).toBeNull();
    // El acuerdo para dividirlas viaja con los tramos que acuerda.
    expect(r.ok && r.solA.acuerdoFracc?.tramos).toBe(E.solicitudes[8].acuerdoFracc?.tramos);
    // Con una interrupción en el medio, las fechas ya no se pueden intercambiar.
    const enfermo = { tramoDesde: '2026-11-09', desde: '2026-11-12', hasta: '2026-11-15', motivo: 'enfermedad', certificado: 'C', informada: true };
    const conInterrupcion = aplicar(conHoy(E, '2026-11-12'), 7, interrumpir(conHoy(E, '2026-11-12'), 7, enfermo, 'RRHH'));
    expect(permutar(conInterrupcion, 7, 8).ok).toBe(false);
  });
  it('cónyuges: aviso para coincidir', () => {
    let E = conPerfil(base(), 11, { conyugeId: 10 });
    E = cargarYEnviar(E, 10, [['2026-11-02', 14]]);
    E = aplicar(E, 11, agregarTramo(E, 11, '2026-11-16', 14, {}, 'test'));
    expect(warns(validarSolicitud(E, 11)).some((m) => /cónyuge/.test(m))).toBe(true);
  });
});

describe('pago (art. 155), fecha límite y cierres colectivos', () => {
  it('valor día = remuneración ÷ 25, pagado el hábil anterior al inicio', () => {
    let E = conPerfil(base(), 8, { remuneracionRef: 250000 });
    E = cargarYEnviar(E, 8, [['2026-11-09', 21]]);
    E = aplicar(E, 8, aprobar(E, 8));
    const a = anticipos(E).find((x) => x.empId === 8)!;
    expect(a.valorDia).toBe(10000);
    expect(a.importe).toBe(210000);
    expect(a.pago).toBe('2026-11-06');
    expect(a.criterio).toMatch(/12 meses/);
  });
  it('pasada la fecha límite hace falta autorización de RRHH', () => {
    let E = conHoy(base(), '2026-10-20');
    E = aplicar(E, 4, agregarTramo(E, 4, '2026-12-07', 21, {}, 'test'));
    expect(errs(validarSolicitud(E, 4)).some((m) => /fecha límite/.test(m))).toBe(true);
    E = aplicar(E, 4, autorizarFueraTermino(E, 4));
    expect(errs(validarSolicitud(E, 4)).some((m) => /fecha límite/.test(m))).toBe(false);
  });
  it('el cierre colectivo descuenta días a todos, bloquea la semana y no consume cupo', () => {
    const E = base({ cierres: [{ nombre: 'Receso', desde: '2026-12-28', hasta: '2027-01-03' }] });
    expect(usadosDe(E, 6)).toBe(7);
    expect(errs(validarTramo(E, 6, '2026-12-28', 7)).some((m) => /cierre colectivo/.test(m))).toBe(true);
    expect(ocupacionSemana(E, 2, '2026-12-28')).toBe(0);
    expect(diasPorMes(E).filter((r) => r.empId === 6).reduce((a, r) => a + r.dias, 0)).toBe(7);
  });
});

describe('cierre de temporada', () => {
  it('guarda verano y turno, propone el arrastre sin acuerdo y avanza un año', () => {
    let E = cargarYEnviar(base(), 8, [['2026-12-07', 14], ['2027-03-01', 7]]);
    E = aplicar(E, 8, aprobar(E, 8));
    const r = cerrarTemporada(E);
    expect(r.perfiles[8].historial[2026]).toEqual({ verano: true, pos: expect.any(Number) });
    expect(r.perfiles[9].historial[2026].verano).toBe(false);
    expect(r.perfiles[9].arrastre).toEqual({ dias: expect.any(Number), acuerdo: false, origen: 2026 });
    expect(r.config.ejercicio).toBe(2027);
    expect(r.config.temporadaDesde).toBe('2027-10-01');
    expect(r.config.fechaLimiteCarga).toBe('2027-10-16');
  });
});
