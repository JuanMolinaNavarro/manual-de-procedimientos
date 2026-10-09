import { describe, it, expect } from 'vitest';
import { diaLocal, diffDias, fechaCorta, fmtMes, hoyLocal, mesLocal, rangoMes, sumarDias } from './fechas';

describe('fechas (Argentina, UTC-3)', () => {
  it('después de las 21 h sigue siendo hoy (en UTC ya es mañana)', () => {
    const noche = new Date('2026-09-30T23:30:00-03:00');
    expect(noche.toISOString().slice(0, 10)).toBe('2026-10-01');
    expect(hoyLocal(noche)).toBe('2026-09-30');
    expect(mesLocal(noche)).toBe('2026-09');
  });
  it('a la madrugada ya es el día nuevo', () => {
    expect(hoyLocal(new Date('2026-10-01T00:10:00-03:00'))).toBe('2026-10-01');
  });
  it('un instante UTC de la madrugada es el día anterior en Argentina (eventos de deportes)', () => {
    expect(diaLocal(new Date('2026-04-28T02:30:00Z'))).toBe('2026-04-27');
    expect(diaLocal(new Date('2026-04-28T03:00:00Z'))).toBe('2026-04-28');
  });
  it('fechaCorta: dd/mm/aaaa, también con hora; vacío → —', () => {
    expect(fechaCorta('2026-01-05')).toBe('05/01/2026');
    expect(fechaCorta('2026-01-05T10:00:00.000Z')).toBe('05/01/2026');
    expect(fechaCorta(null)).toBe('—');
    expect(fechaCorta('')).toBe('—');
  });
  it('días y meses', () => {
    expect(diffDias('2026-02-27', '2026-03-02')).toBe(3);
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(rangoMes('2028-02')).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
    expect(fmtMes('2026-09')).toBe('Septiembre 2026');
  });
});
