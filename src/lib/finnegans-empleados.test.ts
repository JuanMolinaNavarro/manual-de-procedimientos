import { describe, it, expect } from 'vitest';
import { agruparEmpleados, convenioNomina } from './finnegans-empleados';

// Datos ficticios.
const fila = (o: Record<string, unknown>) => ({
  EMPRESANOMBRE: 'EMP SA', EMPRESACUIT: '30-70000000-1', EMPRESADIRECCION: 'Calle 1',
  IDENTIFICACIONTRIBUTARIANUMERO: '20-11111111-2', PERSONANOMBRE: 'ANA', PERSONAAPELLIDO: 'UNO',
  NUMEROLEGAJO: '10', FECHAINGRESO: '01/07/2021', FECHAEGRESO: null, CATEGORIA: 'GRUPO 7',
  CONVENIO: 'Satsaid 223/75', OBRASOCIAL: 'OS', CBU: '123', BASICO: 1000, FECHAHASTA: '31/07/2026',
  ...o,
});

describe('agruparEmpleados', () => {
  it('agrupa por empresa y deja la liquidación más reciente de cada persona', () => {
    const r = agruparEmpleados([
      fila({ FECHAHASTA: '31/08/2026', BASICO: 2000 }),
      fila({ FECHAHASTA: '31/07/2026', BASICO: 1000 }),
      fila({ IDENTIFICACIONTRIBUTARIANUMERO: '27-22222222-3', PERSONAAPELLIDO: 'AAA' }),
      fila({ EMPRESANOMBRE: 'OTRA SA', EMPRESACUIT: '30-79999999-9', IDENTIFICACIONTRIBUTARIANUMERO: '23-33333333-4' }),
    ]);
    expect(r.map((e) => e.nombre)).toEqual(['EMP SA', 'OTRA SA']);
    expect(r[0].personas.map((p) => p.cuilDigitos)).toEqual(['27222222223', '20111111112']);
    expect(r[0].personas[1]).toMatchObject({ basico: 2000, fechaIngreso: '2021-07-01', activo: true, cuil: '20-11111111-2' });
  });
  it('una persona con egreso queda inactiva', () => {
    const [e] = agruparEmpleados([fila({ FECHAEGRESO: '13/07/2026' })]);
    expect(e.personas[0]).toMatchObject({ activo: false, fechaEgreso: '2026-07-13' });
  });
  it('ignora filas sin CUIL válido', () => {
    expect(agruparEmpleados([fila({ IDENTIFICACIONTRIBUTARIANUMERO: '' })])).toEqual([]);
  });
});

describe('convenioNomina', () => {
  it('mapea al select de Nómina', () => {
    expect(convenioNomina('Fuera de Convenio')).toEqual({ convenio: 'Fuera de convenio', cct: '' });
    expect(convenioNomina('Satsaid 223/75')).toEqual({ convenio: 'Otro convenio', cct: 'Satsaid 223/75' });
  });
});
