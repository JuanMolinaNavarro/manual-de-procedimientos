import { describe, it, expect } from 'vitest';
import { hoyLocal, mesLocal } from './fechas';

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
});
