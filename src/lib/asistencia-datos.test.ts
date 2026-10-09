import { describe, it, expect } from 'vitest';
import {
  esFechaImposible,
  fmtFechaDia,
  fmtRelativo,
  sumarDias,
  rangoPreset,
  presetDeRango,
  hoyLocal,
  inicioDeMes,
  personaActiva,
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
