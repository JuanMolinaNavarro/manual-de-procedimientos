import { describe, it, expect } from 'vitest';
import { coincide } from './utils';

describe('coincide', () => {
  it('sin tildes ni mayúsculas, en cualquiera de los textos', () => {
    expect(coincide('garcia', 'María García')).toBe(true);
    expect(coincide('RRHH', 'Ana', 'rrhh')).toBe(true);
    expect(coincide('perez', 'Ana', null, undefined)).toBe(false);
  });
  it('búsqueda vacía coincide con todo', () => {
    expect(coincide('  ', 'Ana')).toBe(true);
  });
});
