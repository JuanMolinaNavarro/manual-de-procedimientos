import { describe, it, expect } from 'vitest';
import { armarMailAviso, emailValido, normalizarEmail } from './recibos-aviso';

describe('emailValido', () => {
  it('acepta direcciones comunes y rechaza basura', () => {
    expect(emailValido('ana.perez@empresa.com.ar')).toBe(true);
    expect(emailValido(' ana@gmail.com ')).toBe(true);
    for (const v of ['', 'ana', 'ana@', 'ana@empresa', 'a b@empresa.com', null, 42]) expect(emailValido(v)).toBe(false);
    expect(normalizarEmail(' Ana@Gmail.COM ')).toBe('ana@gmail.com');
  });
});

describe('armarMailAviso', () => {
  const base = { nombre: 'Ana María Pérez', empresa: 'EMP SA', periodo: '2026-07', recibos: 1, url: 'https://aurelius.test/admin/mis-recibos' };

  it('avisa sin adjuntos ni importes, con el enlace al portal', () => {
    const m = armarMailAviso(base);
    expect(m.subject).toBe('Julio 2026: tu recibo de sueldo está disponible');
    expect(m.text).toContain('Hola Ana:');
    expect(m.text).toContain(base.url);
    expect(m.html).toContain(`href="${base.url}"`);
    expect(m.text).not.toMatch(/\$|\d{1,3}(\.\d{3})+,\d{2}/); // ningún importe
    expect(m.text).toContain('Nadie de la empresa te va a pedir tu PIN');
  });

  it('plural con varios recibos', () => {
    const m = armarMailAviso({ ...base, recibos: 2 });
    expect(m.subject).toBe('Julio 2026: tus recibos de sueldo están disponibles');
    expect(m.text).toContain('tus 2 recibos de sueldo');
  });

  it('escapa el HTML de los datos', () => {
    const m = armarMailAviso({ ...base, nombre: '<script>x</script>', empresa: 'A & B' });
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('A &amp; B');
  });
});
