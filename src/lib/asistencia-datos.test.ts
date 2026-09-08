import { describe, it, expect } from 'vitest';
import {
  esFechaImposible,
  fmtFechaDia,
  fmtRelativo,
  sumarDias,
  diasEntre,
  rangoPreset,
  presetDeRango,
  hoyLocal,
  inicioDeMes,
  armarResumen,
  personaActiva,
  type GrupoFichadas,
  type PersonaResumen,
} from './asistencia-datos';

describe('fechas', () => {
  it('formatea un día sin correrse de huso', () => {
    // Con new Date('2026-01-05') esto daría 04/01/2026 en Argentina.
    expect(fmtFechaDia('2026-01-05')).toBe('05/01/2026');
    expect(fmtFechaDia('2026-12-31')).toBe('31/12/2026');
  });

  it('deja pasar lo que no es una fecha', () => {
    expect(fmtFechaDia('')).toBe('');
    expect(fmtFechaDia('cualquiera')).toBe('cualquiera');
  });

  it('suma y resta días cruzando meses y años', () => {
    expect(sumarDias('2026-01-31', 1)).toBe('2026-02-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(sumarDias('2024-03-01', -1)).toBe('2024-02-29'); // bisiesto
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('cuenta los días del rango inclusive', () => {
    expect(diasEntre('2026-09-07', '2026-09-07')).toBe(1);
    expect(diasEntre('2026-09-01', '2026-09-30')).toBe(30);
    expect(diasEntre('2025-12-31', '2026-01-01')).toBe(2);
  });

  it('inicioDeMes y hoyLocal usan el huso del reloj', () => {
    expect(inicioDeMes('2026-09-07')).toBe('2026-09-01');
    // 00:30 UTC del 8 todavía es el 7 en Argentina (-03:00).
    expect(hoyLocal(new Date('2026-09-08T00:30:00Z'))).toBe('2026-09-07');
    expect(hoyLocal(new Date('2026-09-08T03:30:00Z'))).toBe('2026-09-08');
  });
});

describe('rangoPreset', () => {
  const hoy = '2026-09-07'; // lunes

  it('hoy', () => {
    expect(rangoPreset('hoy', hoy)).toEqual({ desde: hoy, hasta: hoy });
  });

  it('la semana arranca el lunes', () => {
    expect(rangoPreset('semana', '2026-09-07')).toEqual({ desde: '2026-09-07', hasta: '2026-09-07' });
    // Domingo 13: sigue perteneciendo a la semana que empezó el lunes 7.
    expect(rangoPreset('semana', '2026-09-13')).toEqual({ desde: '2026-09-07', hasta: '2026-09-13' });
    expect(rangoPreset('semana', '2026-09-09')).toEqual({ desde: '2026-09-07', hasta: '2026-09-09' });
  });

  it('este mes va del día 1 a hoy', () => {
    expect(rangoPreset('mes', hoy)).toEqual({ desde: '2026-09-01', hasta: hoy });
  });

  it('mes anterior toma el mes completo', () => {
    expect(rangoPreset('mesAnterior', hoy)).toEqual({ desde: '2026-08-01', hasta: '2026-08-31' });
    // Febrero, con y sin bisiesto.
    expect(rangoPreset('mesAnterior', '2026-03-15')).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
    expect(rangoPreset('mesAnterior', '2024-03-15')).toEqual({ desde: '2024-02-01', hasta: '2024-02-29' });
  });

  it('mes anterior cruza el año', () => {
    expect(rangoPreset('mesAnterior', '2026-01-15')).toEqual({ desde: '2025-12-01', hasta: '2025-12-31' });
  });

  it('últimos 30 incluye hoy', () => {
    const r = rangoPreset('ultimos30', hoy);
    expect(r).toEqual({ desde: '2026-08-09', hasta: hoy });
    expect(diasEntre(r.desde, r.hasta)).toBe(30);
  });
});

describe('presetDeRango', () => {
  const hoy = '2026-09-07';

  it('devuelve un preset que reproduce el mismo rango', () => {
    for (const p of ['hoy', 'semana', 'mes', 'mesAnterior', 'ultimos30'] as const) {
      const { desde, hasta } = rangoPreset(p, hoy);
      const hallado = presetDeRango(desde, hasta, hoy);
      expect(hallado).not.toBeNull();
      expect(rangoPreset(hallado!, hoy)).toEqual({ desde, hasta });
    }
  });

  it('con rangos ambiguos prefiere el más específico', () => {
    // Un lunes, "Hoy" y "Esta semana" son el mismo día.
    expect(presetDeRango('2026-09-07', '2026-09-07', '2026-09-07')).toBe('hoy');
    // Un martes ya se distinguen.
    expect(presetDeRango('2026-09-07', '2026-09-08', '2026-09-08')).toBe('semana');
  });

  it('devuelve null para un rango a mano', () => {
    expect(presetDeRango('2026-05-03', '2026-06-11', hoy)).toBeNull();
  });
});

describe('esFechaImposible', () => {
  const ahora = Date.parse('2026-09-07T12:00:00Z');

  it('acepta una fecha normal', () => {
    expect(esFechaImposible('2026-09-07T09:04:41Z', ahora)).toBe(false);
    expect(esFechaImposible('2020-06-15T10:00:00Z', ahora)).toBe(false);
  });

  it('tolera hasta 24 h de adelanto (relojes con la hora corrida)', () => {
    expect(esFechaImposible('2026-09-08T11:00:00Z', ahora)).toBe(false); // +23 h
    expect(esFechaImposible('2026-09-08T13:00:00Z', ahora)).toBe(true); // +25 h
  });

  it('rechaza lo anterior a 2010 y lo que no parsea', () => {
    expect(esFechaImposible('2009-12-31T23:59:59Z', ahora)).toBe(true);
    expect(esFechaImposible('no es una fecha', ahora)).toBe(true);
  });
});

describe('fmtRelativo', () => {
  const ahora = Date.parse('2026-09-07T12:00:00Z');
  const hace = (ms: number) => new Date(ahora - ms).toISOString();

  it('cubre los cortes', () => {
    expect(fmtRelativo(hace(30_000), ahora)).toBe('hace segundos');
    expect(fmtRelativo(hace(60_000), ahora)).toBe('hace 1 min');
    expect(fmtRelativo(hace(90 * 60_000), ahora)).toBe('hace 1 h');
    expect(fmtRelativo(hace(25 * 3_600_000), ahora)).toBe('hace 1 día');
    expect(fmtRelativo(hace(50 * 3_600_000), ahora)).toBe('hace 2 días');
  });

  it('no rompe con null ni con el futuro', () => {
    expect(fmtRelativo(null, ahora)).toBe('—');
    expect(fmtRelativo(hace(-5000), ahora)).toBe('recién');
  });
});

describe('armarResumen', () => {
  const RANGO = { desde: '2026-09-01', hasta: '2026-09-07' };
  const HOY = '2026-09-07';

  const personas: PersonaResumen[] = [
    { userId: '111', nombre: 'Ana', empleadoId: 1 },
    { userId: '222', nombre: 'Bruno', empleadoId: 2 },
    { userId: '333', nombre: 'Carla', empleadoId: null }, // sin vincular
    { userId: '444', nombre: 'Dario', empleadoId: 4 }, // no fichó nunca
  ];

  const grupos: GrupoFichadas[] = [
    // Ana el 01: entrada y salida → día completo.
    { userId: '111', fecha: '2026-09-01', tipo: 0, marcas: 1 },
    { userId: '111', fecha: '2026-09-01', tipo: 1, marcas: 1 },
    // Ana el 02: dos entradas y ninguna salida → incompleto.
    { userId: '111', fecha: '2026-09-02', tipo: 0, marcas: 2 },
    // Bruno el 02: una sola marca → incompleto.
    { userId: '222', fecha: '2026-09-02', tipo: 0, marcas: 1 },
    // Carla hoy: completo.
    { userId: '333', fecha: HOY, tipo: 0, marcas: 1 },
    { userId: '333', fecha: HOY, tipo: 1, marcas: 1 },
    // Bruno hoy: entró y todavía no se fue. La jornada está abierta, así que no
    // es un día incompleto ni cuenta como día cerrado.
    { userId: '222', fecha: HOY, tipo: 0, marcas: 1 },
    // Fuera del rango: no tiene que contar en nada.
    { userId: '111', fecha: '2026-08-31', tipo: 0, marcas: 5 },
  ];

  const r = armarResumen(grupos, personas, RANGO, HOY);

  it('ignora lo que cae fuera del rango', () => {
    expect(r.totales.fichadas).toBe(8);
    expect(r.rango).toEqual({ ...RANGO, dias: 7 });
  });

  it('cuenta días-persona y cuáles quedaron sin salida', () => {
    // Los 3 días-persona cerrados: Ana el 01 y el 02, Bruno el 02. Los de hoy
    // (Carla y Bruno) no entran: la jornada todavía está abierta.
    expect(r.totales.diasPersona).toBe(3);
    expect(r.totales.diasIncompletos).toBe(2);
  });

  it('no cuenta el día de hoy como día sin salida', () => {
    // Bruno fichó entrada hoy y nada más, pero sigue con 1 solo día incompleto
    // (el 02): hoy no se juzga.
    expect(r.incompletos.find((i) => i.userId === '222')?.dias).toBe(1);
    // Con el mismo set de grupos, si "hoy" fuera el 08 el día de Bruno ya está
    // cerrado y sí cuenta como incompleto.
    const manana = armarResumen(grupos, personas, { desde: '2026-09-01', hasta: '2026-09-08' }, '2026-09-08');
    expect(manana.totales.diasIncompletos).toBe(3);
    expect(manana.incompletos.find((i) => i.userId === '222')?.dias).toBe(2);
  });

  it('un día con marcas pero sin ninguna de tipo salida es incompleto', () => {
    expect(r.incompletos).toEqual([
      { userId: '111', nombre: 'Ana', empleadoId: 1, dias: 1 },
      { userId: '222', nombre: 'Bruno', empleadoId: 2, dias: 1 },
    ]);
    expect(r.incompletosTotal).toBe(2);
  });

  it('separa a quien no fichó de quien no está vinculado', () => {
    expect(r.totales.personasSinVincular).toBe(1); // Carla
    expect(r.totales.personasConMarcas).toBe(3);
    expect(r.totales.personasTotales).toBe(4);
  });

  it('cuenta los presentes de hoy cuando hoy cae en el rango', () => {
    expect(r.hoy).toEqual({ fecha: HOY, enRango: true, presentes: 2 });
  });

  it('no inventa presentes cuando hoy queda fuera del rango', () => {
    const otro = armarResumen(grupos, personas, { desde: '2026-08-01', hasta: '2026-08-31' }, HOY);
    expect(otro.hoy.enRango).toBe(false);
    expect(otro.hoy.presentes).toBe(0);
    expect(otro.totales.fichadas).toBe(5); // solo la fila del 31/08
    expect(otro.totales.diasPersona).toBe(1); // hoy no está en el rango: nada que excluir
  });

  it('la serie por día cubre el rango completo, con ceros incluidos', () => {
    expect(r.porDia).toHaveLength(7);
    expect(r.porDia[0]).toEqual({ fecha: '2026-09-01', marcas: 2, personas: 1 });
    expect(r.porDia[1]).toEqual({ fecha: '2026-09-02', marcas: 3, personas: 2 });
    // Hoy sigue entero en la serie y en "presentes": lo que se excluye es solo
    // el conteo de días sin salida.
    // Un día hábil sin ninguna marca tiene que existir en la serie: es la señal
    // de que el reloj se cayó.
    expect(r.porDia[2]).toEqual({ fecha: '2026-09-03', marcas: 0, personas: 0 });
    expect(r.porDia[6]).toEqual({ fecha: HOY, marcas: 3, personas: 2 });
  });

  it('sobrevive a un período sin ninguna fichada', () => {
    const vacio = armarResumen([], personas, RANGO, HOY);
    expect(vacio.totales.fichadas).toBe(0);
    expect(vacio.totales.diasPersona).toBe(0);
    expect(vacio.porDia).toHaveLength(7);
    expect(vacio.hoy.presentes).toBe(0);
  });
});

describe('personaActiva', () => {
  it('sin vincular manda su propio flag', () => {
    expect(personaActiva({ empleadoId: null, activo: true, empleadoEstado: null })).toBe(true);
    expect(personaActiva({ empleadoId: null, activo: false, empleadoEstado: null })).toBe(false);
  });

  it('vinculada manda el organigrama, aunque su flag diga otra cosa', () => {
    expect(personaActiva({ empleadoId: 7, activo: false, empleadoEstado: 'active' })).toBe(true);
    expect(personaActiva({ empleadoId: 7, activo: true, empleadoEstado: 'inactive' })).toBe(false);
  });

  it('vinculada a una ficha sin estado conocido no cuenta como activa', () => {
    expect(personaActiva({ empleadoId: 7, activo: true, empleadoEstado: null })).toBe(false);
  });
});
