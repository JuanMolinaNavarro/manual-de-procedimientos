import { describe, it, expect } from 'vitest';
import {
  diaSemanaDe,
  lunesDe,
  semanaDelCiclo,
  rangoMes,
  mesAnterior,
  mesSiguiente,
  fmtMes,
  minutosDe,
  minutoLocalDe,
  versionVigente,
  ultimaVersion,
  jornadaDelDia,
  proximasFechasDia,
  resumirFichadas,
  evaluarDia,
  totalesDe,
  armarCalendario,
  validarHorarioInput,
  validarConfigInput,
  describirHorario,
  resumenLiquidacion,
  fmtHorasMin,
  CONFIG_DEFAULT,
  type HorarioVersion,
  type FichadaDia,
  type FilaEntrada,
} from './asistencia-calendario';

// Septiembre 2026: el 1 es martes, el 7 lunes, el 15 martes (hoy en los tests).
const HOY = '2026-09-15';

function version(over: Partial<HorarioVersion> = {}): HorarioVersion {
  return {
    id: 1,
    empleadoId: 10,
    vigenteDesde: '2026-01-01',
    vigenteHasta: null,
    incluir: true,
    cicloSemanas: 1,
    cicloAncla: '2025-12-29',
    toleranciaMin: null,
    dias: {
      0: { semanas: [0], entrada: '08:00', salida: '17:00' },
      1: { semanas: [0], entrada: '08:00', salida: '17:00' },
      2: { semanas: [0], entrada: '08:00', salida: '17:00' },
      3: { semanas: [0], entrada: '08:00', salida: '17:00' },
      4: { semanas: [0], entrada: '08:00', salida: '17:00' },
    },
    ...over,
  };
}

/** Marca a una hora local de Argentina (-03:00) del día dado. */
function marca(fecha: string, hhmm: string, tipo = 0): FichadaDia {
  return { fechaHora: new Date(`${fecha}T${hhmm}:00-03:00`).toISOString(), tipo };
}

describe('días y semanas', () => {
  it('numera la semana desde el lunes', () => {
    expect(diaSemanaDe('2026-09-07')).toBe(0); // lunes
    expect(diaSemanaDe('2026-09-12')).toBe(5); // sábado
    expect(diaSemanaDe('2026-09-13')).toBe(6); // domingo
  });

  it('lunesDe cruza el año', () => {
    expect(lunesDe('2026-01-01')).toBe('2025-12-29'); // jueves → lunes anterior
    expect(lunesDe('2026-09-07')).toBe('2026-09-07');
    expect(lunesDe('2026-09-13')).toBe('2026-09-07');
  });

  it('semanaDelCiclo: sábados de por medio con ancla lunes 7/9', () => {
    expect(semanaDelCiclo('2026-09-12', '2026-09-07', 2)).toBe(0);
    expect(semanaDelCiclo('2026-09-19', '2026-09-07', 2)).toBe(1);
    expect(semanaDelCiclo('2026-09-26', '2026-09-07', 2)).toBe(0);
    expect(semanaDelCiclo('2026-10-03', '2026-09-07', 2)).toBe(1);
  });

  it('semanaDelCiclo: antes del ancla, ancla no lunes y ciclos largos', () => {
    expect(semanaDelCiclo('2026-09-05', '2026-09-07', 2)).toBe(1); // una semana antes
    expect(semanaDelCiclo('2026-08-29', '2026-09-07', 2)).toBe(0);
    expect(semanaDelCiclo('2026-09-19', '2026-09-09', 2)).toBe(1); // ancla miércoles → mismo lunes
    expect(semanaDelCiclo('2026-09-28', '2026-09-07', 3)).toBe(0);
    expect(semanaDelCiclo('2026-09-21', '2026-09-07', 3)).toBe(2);
    expect(semanaDelCiclo('2026-10-05', '2026-09-07', 4)).toBe(0);
    expect(semanaDelCiclo('2026-09-19', '2026-09-07', 1)).toBe(0);
  });

  it('rangoMes y navegación de meses', () => {
    expect(rangoMes('2026-02')).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
    expect(rangoMes('2024-02')).toEqual({ desde: '2024-02-01', hasta: '2024-02-29' });
    expect(rangoMes('2026-09')).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' });
    expect(rangoMes('2026-12')).toEqual({ desde: '2026-12-01', hasta: '2026-12-31' });
    expect(mesSiguiente('2026-12')).toBe('2027-01');
    expect(mesAnterior('2026-01')).toBe('2025-12');
    expect(mesAnterior('2026-03')).toBe('2026-02');
    expect(fmtMes('2026-09')).toBe('Septiembre 2026');
  });

  it('minutos del día en hora de Argentina', () => {
    expect(minutosDe('08:30')).toBe(510);
    expect(minutoLocalDe('2026-09-15T11:12:00Z')).toBe(8 * 60 + 12);
    // 01:30 UTC del 16 es 22:30 del 15 en Argentina.
    expect(minutoLocalDe('2026-09-16T01:30:00Z')).toBe(22 * 60 + 30);
  });
});

describe('versiones', () => {
  const v1 = version({ id: 1, vigenteDesde: '2026-01-01', vigenteHasta: '2026-09-14' });
  const v2 = version({ id: 2, vigenteDesde: '2026-09-15', vigenteHasta: null, toleranciaMin: 0 });

  it('elige la vigente por fecha con bordes inclusive', () => {
    expect(versionVigente([v1, v2], '2026-09-14')?.id).toBe(1);
    expect(versionVigente([v1, v2], '2026-09-15')?.id).toBe(2);
    expect(versionVigente([v1, v2], '2025-12-31')).toBeNull();
    expect(versionVigente([], '2026-09-15')).toBeNull();
    expect(ultimaVersion([v1, v2])?.id).toBe(2);
    expect(ultimaVersion([])).toBeNull();
  });

  it('jornadaDelDia respeta días, ciclo e incluir', () => {
    expect(jornadaDelDia(v1, '2026-09-08')?.entrada).toBe('08:00');
    expect(jornadaDelDia(v1, '2026-09-12')).toBeNull(); // sábado sin jornada
    expect(jornadaDelDia(version({ incluir: false }), '2026-09-08')).toBeNull();
    const alterno = version({ cicloSemanas: 2, cicloAncla: '2026-09-07', dias: { ...v1.dias, 5: { semanas: [0], entrada: '09:00', salida: '13:00' } } });
    expect(jornadaDelDia(alterno, '2026-09-12')?.entrada).toBe('09:00');
    expect(jornadaDelDia(alterno, '2026-09-19')).toBeNull();
    expect(jornadaDelDia(alterno, '2026-09-26')?.entrada).toBe('09:00');
    expect(proximasFechasDia(alterno, 5, '2026-09-10')).toEqual([
      { fecha: '2026-09-12', aplica: true },
      { fecha: '2026-09-19', aplica: false },
      { fecha: '2026-09-26', aplica: true },
      { fecha: '2026-10-03', aplica: false },
    ]);
  });
});

describe('resumirFichadas', () => {
  it('primera entrada y última salida', () => {
    const r = resumirFichadas([marca('2026-09-14', '12:30', 1), marca('2026-09-14', '08:02', 0), marca('2026-09-14', '13:00', 0), marca('2026-09-14', '17:05', 1)]);
    expect(r.entrada).toBe(marca('2026-09-14', '08:02').fechaHora);
    expect(r.salida).toBe(marca('2026-09-14', '17:05').fechaHora);
    expect(r.entradaInferida).toBe(false);
    expect(r.marcas).toBe(4);
  });

  it('reloj sin tipos: infiere la entrada y no inventa salida', () => {
    const r = resumirFichadas([marca('2026-09-14', '08:02', 2), marca('2026-09-14', '17:05', 2)]);
    expect(r.entrada).toBe(marca('2026-09-14', '08:02').fechaHora);
    expect(r.salida).toBeNull();
    expect(r.entradaInferida).toBe(true);
    const soloSalida = resumirFichadas([marca('2026-09-14', '17:05', 1)]);
    expect(soloSalida.entrada).toBe(marca('2026-09-14', '17:05').fechaHora);
    expect(soloSalida.entradaInferida).toBe(true);
    expect(resumirFichadas([]).entrada).toBeNull();
  });
});

describe('evaluarDia', () => {
  const v = version();
  const ev = (fecha: string, fichadas: FichadaDia[], over: Partial<Parameters<typeof evaluarDia>[0]> = {}, cfg = CONFIG_DEFAULT) =>
    evaluarDia({ fecha, hoy: HOY, version: v, fichadas, ...over }, cfg);

  it('futuro, pendiente y ausente', () => {
    expect(ev('2026-09-16', []).estado).toBe('futuro');
    // El futuro trae la jornada planificada (para dibujar qué días le tocan) pero sin estado.
    expect(ev('2026-09-16', []).jornada).toEqual({ entrada: '08:00', salida: '17:00' });
    expect(ev('2026-09-19', []).jornada).toBeNull(); // sábado
    expect(ev('2026-09-16', [], { version: null }).jornada).toBeNull();
    expect(ev(HOY, []).estado).toBe('pendiente');
    expect(ev('2026-09-14', []).estado).toBe('ausente');
    expect(ev('2026-09-14', []).jornada).toEqual({ entrada: '08:00', salida: '17:00' });
  });

  it('a horario / tarde / tarde grave desde la hora pactada', () => {
    expect(ev('2026-09-14', [marca('2026-09-14', '08:09'), marca('2026-09-14', '17:00', 1)]).estado).toBe('a_horario');
    expect(ev('2026-09-14', [marca('2026-09-14', '08:10'), marca('2026-09-14', '17:00', 1)]).estado).toBe('a_horario');
    const tarde = ev('2026-09-14', [marca('2026-09-14', '08:12'), marca('2026-09-14', '17:00', 1)]);
    expect(tarde.estado).toBe('tarde');
    expect(tarde.minutosTarde).toBe(12);
    expect(ev('2026-09-14', [marca('2026-09-14', '08:31'), marca('2026-09-14', '17:00', 1)]).estado).toBe('tarde_grave');
    expect(ev('2026-09-14', [marca('2026-09-14', '07:45'), marca('2026-09-14', '17:00', 1)]).minutosTarde).toBe(0);
  });

  it('la tolerancia de la versión pisa la general', () => {
    const estricta = version({ toleranciaMin: 0 });
    expect(ev('2026-09-14', [marca('2026-09-14', '08:01')], { version: estricta }).estado).toBe('tarde');
    const laxa = version({ toleranciaMin: 20 });
    expect(ev('2026-09-14', [marca('2026-09-14', '08:15')], { version: laxa }).estado).toBe('a_horario');
    // Pero "grave" sigue siendo el umbral general.
    expect(ev('2026-09-14', [marca('2026-09-14', '08:30')], { version: laxa }).estado).toBe('tarde_grave');
  });

  it('sin salida: ayer sí, hoy no', () => {
    expect(ev('2026-09-14', [marca('2026-09-14', '08:00')]).sinSalida).toBe(true);
    expect(ev(HOY, [marca(HOY, '08:00')]).sinSalida).toBe(false);
    expect(ev(HOY, [marca(HOY, '08:00')]).estado).toBe('a_horario');
  });

  it('día no laborable con y sin marcas', () => {
    expect(ev('2026-09-12', []).estado).toBe('no_laborable');
    expect(ev('2026-09-12', [marca('2026-09-12', '09:00')]).estado).toBe('trabajo_no_laborable');
  });

  it('sin horario: sin versión, no incluido o antes del ingreso', () => {
    expect(ev('2026-09-14', [marca('2026-09-14', '08:40')], { version: null }).estado).toBe('sin_horario');
    expect(ev('2026-09-14', [marca('2026-09-14', '08:40')], { version: null }).marcas).toBe(1);
    expect(ev('2026-09-14', [], { version: version({ incluir: false }) }).estado).toBe('sin_horario');
    expect(ev('2026-09-14', [], { fechaIngreso: '2026-09-15' }).estado).toBe('sin_horario');
    expect(ev('2026-09-14', [], { fechaIngreso: '2026-09-14' }).estado).toBe('ausente');
    expect(ev('2026-09-14', [], { fechaIngreso: '' }).estado).toBe('ausente');
  });

  it('entrada inferida con reloj sin tipos', () => {
    const c = ev('2026-09-14', [marca('2026-09-14', '08:20', 3)]);
    expect(c.estado).toBe('tarde');
    expect(c.entradaInferida).toBe(true);
  });
});

describe('armarCalendario y totales', () => {
  it('arma los días del mes y los totales por fila', () => {
    const filas: (FilaEntrada & { clave: string })[] = [
        {
          clave: 'e:10',
          versiones: [version()],
          fichadasPorFecha: {
            '2026-09-01': [marca('2026-09-01', '08:05'), marca('2026-09-01', '17:00', 1)],
            '2026-09-02': [marca('2026-09-02', '08:45')],
            '2026-09-05': [marca('2026-09-05', '10:00'), marca('2026-09-05', '12:00', 1)],
          },
        },
        { clave: 'u:123', versiones: [], fichadasPorFecha: { '2026-09-03': [marca('2026-09-03', '08:00')] } },
    ];
    const cal = armarCalendario({ desde: '2026-09-01', hasta: '2026-09-30', hoy: HOY, cfg: CONFIG_DEFAULT, filas });
    expect(cal.dias).toHaveLength(30);
    expect(cal.dias[0]).toMatchObject({ fecha: '2026-09-01', dia: 1, diaSemana: 1, finDeSemana: false });
    expect(cal.dias[14]).toMatchObject({ fecha: HOY, esHoy: true });
    expect(cal.dias[4].finDeSemana).toBe(true); // sábado 5

    const [emp, suelto] = cal.filas;
    expect(emp.clave).toBe('e:10');
    expect(emp.tieneHorario).toBe(true);
    expect(emp.celdas[0].estado).toBe('a_horario');
    expect(emp.celdas[1].estado).toBe('tarde_grave');
    expect(emp.celdas[1].sinSalida).toBe(true);
    expect(emp.celdas[4].estado).toBe('trabajo_no_laborable');
    expect(emp.celdas[14].estado).toBe('pendiente');
    expect(emp.celdas[15].estado).toBe('futuro');
    // Laborables hasta ayer: 1-4, 7-11, 14 = 10 días; hoy pendiente no cuenta.
    expect(emp.totales).toMatchObject({ laborables: 10, aHorario: 1, tardeGrave: 1, ausente: 8, trabajoNoLaborable: 1, sinSalida: 1, minutosTarde: 50 }); // 5 (a horario) + 45

    expect(suelto.tieneHorario).toBe(false);
    expect(suelto.celdas[2].estado).toBe('sin_horario');
    expect(suelto.totales.ausente).toBe(0);
    expect(suelto.totales.conMarcas).toBe(1);
  });

  it('tieneHorario mira la intersección con el rango', () => {
    const t = totalesDe([]);
    expect(t.laborables).toBe(0);
    const cal = armarCalendario({
      desde: '2026-09-01',
      hasta: '2026-09-30',
      hoy: HOY,
      cfg: CONFIG_DEFAULT,
      filas: [{ versiones: [version({ vigenteDesde: '2026-10-01' })], fichadasPorFecha: {} }],
    });
    expect(cal.filas[0].tieneHorario).toBe(false);
    expect(cal.filas[0].celdas[0].estado).toBe('sin_horario');
  });
});

describe('resumenLiquidacion', () => {
  it('suma ausencias, tardanzas y horas contra lo esperado', () => {
    const cal = armarCalendario({
      desde: '2026-09-01',
      hasta: '2026-09-30',
      hoy: HOY,
      cfg: CONFIG_DEFAULT,
      filas: [{
        versiones: [version()],
        fichadasPorFecha: {
          '2026-09-01': [marca('2026-09-01', '08:05'), marca('2026-09-01', '17:05', 1)], // 9 h
          '2026-09-02': [marca('2026-09-02', '08:45')], // grave, sin salida
          '2026-09-03': [marca('2026-09-03', '08:15'), marca('2026-09-03', '12:15', 1)], // tarde 15, 4 h
          '2026-09-05': [marca('2026-09-05', '10:00'), marca('2026-09-05', '12:00', 1)], // sábado
        },
      }],
    });
    const r = resumenLiquidacion(cal.filas[0].celdas);
    expect(r.laborablesMes).toBe(22); // L–V de septiembre 2026
    expect(r.laborables).toBe(10); // 1-4, 7-11, 14 (hoy 15 pendiente no cuenta)
    expect(r.minutosEsperadosMes).toBe(22 * 9 * 60);
    expect(r.minutosEsperadosHastaHoy).toBe(11 * 9 * 60); // incluye hoy
    expect(r.ausentes).toHaveLength(7);
    expect(r.tardes).toEqual([
      { fecha: '2026-09-02', minutos: 45, grave: true },
      { fecha: '2026-09-03', minutos: 15, grave: false },
    ]);
    expect(r.minutosTarde).toBe(60);
    expect(r.sinSalida).toEqual(['2026-09-02']);
    expect(r.trabajoNoLaborable).toEqual(['2026-09-05']);
    expect(r.minutosTrabajados).toBe(9 * 60 + 4 * 60 + 2 * 60);
    expect(r.diasComputados).toBe(3);
    expect(cal.filas[0].celdas[1].minutosTrabajados).toBeNull();
    expect(fmtHorasMin(510)).toBe('8 h 30 min');
    expect(fmtHorasMin(120)).toBe('2 h');
  });
});

describe('validarHorarioInput', () => {
  const base = {
    empleadoId: 10,
    aplicarDesde: '2026-09-15',
    incluir: true,
    cicloSemanas: 1,
    dias: { '0': { entrada: '08:00', salida: '17:00' }, '4': { entrada: '08:00', salida: '13:00' } },
  };

  it('normaliza el caso simple', () => {
    const v = validarHorarioInput(base);
    expect(v.dias[0]).toEqual({ semanas: [0], entrada: '08:00', salida: '17:00' });
    expect(v.dias[1]).toBeUndefined();
    expect(v.cicloAncla).toBe('2026-09-14'); // lunes de la semana de aplicarDesde
    expect(v.toleranciaMin).toBeNull();
    expect(v.versionEsperadaId).toBeUndefined();
    expect(validarHorarioInput({ ...base, versionEsperadaId: null }).versionEsperadaId).toBeNull();
    expect(validarHorarioInput({ ...base, versionEsperadaId: 7 }).versionEsperadaId).toBe(7);
  });

  it('ciclo: normaliza el ancla al lunes y filtra semanas', () => {
    const v = validarHorarioInput({ ...base, cicloSemanas: 2, cicloAncla: '2026-09-09', dias: { '5': { entrada: '09:00', salida: '13:00', semanas: [1, 1, 7, '0'] } } });
    expect(v.cicloAncla).toBe('2026-09-07');
    expect(v.dias[5]?.semanas).toEqual([0, 1]);
    expect(() => validarHorarioInput({ ...base, cicloSemanas: 2, cicloAncla: '2026-09-09', dias: { '5': { entrada: '09:00', salida: '13:00', semanas: [3] } } })).toThrow(/semana del ciclo/);
    expect(() => validarHorarioInput({ ...base, cicloSemanas: 2 })).toThrow(/semana empieza/);
    expect(() => validarHorarioInput({ ...base, cicloSemanas: 5, cicloAncla: '2026-09-07' })).toThrow(/1 a 4/);
  });

  it('rechaza horas mal formadas, nocturnos, sin días y tolerancias raras', () => {
    expect(() => validarHorarioInput({ ...base, dias: { '0': { entrada: '8:00', salida: '17:00' } } })).toThrow(/HH:MM/);
    expect(() => validarHorarioInput({ ...base, dias: { '0': { entrada: '22:00', salida: '06:00' } } })).toThrow(/nocturnos/);
    expect(() => validarHorarioInput({ ...base, dias: {} })).toThrow(/al menos un día/);
    expect(validarHorarioInput({ ...base, incluir: false, dias: {} }).incluir).toBe(false);
    expect(() => validarHorarioInput({ ...base, toleranciaMin: -1 })).toThrow(/tolerancia/);
    expect(() => validarHorarioInput({ ...base, toleranciaMin: 1.5 })).toThrow(/tolerancia/);
    expect(validarHorarioInput({ ...base, toleranciaMin: '' }).toleranciaMin).toBeNull();
    expect(validarHorarioInput({ ...base, toleranciaMin: '15' }).toleranciaMin).toBe(15);
    expect(() => validarHorarioInput({ ...base, aplicarDesde: '15/09/2026' })).toThrow(/fecha/);
    expect(() => validarHorarioInput({ ...base, empleadoId: 0 })).toThrow(/empleado/);
  });

  it('validarConfigInput', () => {
    expect(validarConfigInput({ toleranciaMin: 10, tardeGraveMin: 30 })).toEqual({ toleranciaMin: 10, tardeGraveMin: 30 });
    expect(() => validarConfigInput({ toleranciaMin: 30, tardeGraveMin: 30 })).toThrow(/superar/);
    expect(() => validarConfigInput({ toleranciaMin: 200, tardeGraveMin: 300 })).toThrow(/tolerancia/);
  });
});

describe('describirHorario', () => {
  it('agrupa días consecutivos con la misma jornada', () => {
    expect(describirHorario(version())).toBe('L–V 08:00–17:00');
    const conSabado = version({ dias: { ...version().dias, 5: { semanas: [0], entrada: '09:00', salida: '13:00' } } });
    expect(describirHorario(conSabado)).toBe('L–V 08:00–17:00 · S 09:00–13:00');
    const todas = Object.fromEntries(Object.entries(version().dias).map(([k, d]) => [k, { ...d!, semanas: [0, 1] }]));
    const alterno = version({ cicloSemanas: 2, dias: { ...todas, 5: { semanas: [0], entrada: '09:00', salida: '13:00' } } });
    expect(describirHorario(alterno)).toBe('L–V 08:00–17:00 · S 09:00–13:00 (S1) · semanas alternas');
    const lmv = version({ dias: { 0: { semanas: [0], entrada: '08:00', salida: '12:00' }, 2: { semanas: [0], entrada: '08:00', salida: '12:00' }, 4: { semanas: [0], entrada: '08:00', salida: '12:00' } } });
    expect(describirHorario(lmv)).toBe('L, X, V 08:00–12:00');
    expect(describirHorario(version({ incluir: false }))).toBe('No incluido en el control');
    expect(describirHorario(version({ dias: {} }))).toBe('Sin días laborables');
  });
});

