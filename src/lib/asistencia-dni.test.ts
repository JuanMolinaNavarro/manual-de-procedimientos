import { describe, it, expect, vi } from 'vitest';

// asistencia.ts importa Prisma; para probar el helper puro alcanza con un Prisma de mentira.
vi.mock('./prisma', () => ({ prisma: {} }));

describe('sinCerosIzq (vínculo por CUIL)', () => {
  it('iguala el DNI del CUIL (8 dígitos con ceros) con el user_id del reloj', async () => {
    const { sinCerosIzq } = await import('./asistencia');
    expect(sinCerosIzq('05678901')).toBe('5678901');
    expect(sinCerosIzq('5678901')).toBe('5678901');
    expect(sinCerosIzq('30123456')).toBe('30123456');
    expect(sinCerosIzq('00000000')).toBe('');
  });
});
