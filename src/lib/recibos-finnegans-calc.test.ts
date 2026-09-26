import { describe, it, expect } from 'vitest';
import {
  agruparPorTransaccion,
  asignarPaginas,
  clasificarRespuestaPdf,
  estadoEntrega,
  validarFirmaInput,
  fechaIso,
  formatoNeto,
  periodoDe,
  tokensCuil,
} from './recibos-finnegans-calc';

// CUIL ficticios (no son de personas reales).
const A = '20111111112';
const B = '27222222223';
const C = '23333333334';
const EMPRESA = '30700000001';

const esperados = [
  { liquidacionLegajoId: 1, cuil: A, neto: 1053625, nombre: 'Uno, Ana' },
  { liquidacionLegajoId: 2, cuil: B, neto: 1313744.5, nombre: 'Dos, Beto' },
];
const pag = (cuil: string, neto: number) => `Empresa 30-70000000-1 CUIL ${cuil.slice(0, 2)}-${cuil.slice(2, 10)}-${cuil[10]} Neto ${formatoNeto(neto)}`;

describe('fechas y formatos', () => {
  it('convierte las fechas de ambos reportes', () => {
    expect(fechaIso('31/07/2026')).toBe('2026-07-31');
    expect(fechaIso('31-07-2026')).toBe('2026-07-31');
    expect(fechaIso(null)).toBe('');
    expect(fechaIso('2026-07-31')).toBe('');
    expect(periodoDe('13/07/2026')).toBe('2026-07');
  });
  it('formatea el neto como el recibo', () => {
    expect(formatoNeto(1053625)).toBe('1.053.625,00');
    expect(formatoNeto(1313744.5)).toBe('1.313.744,50');
    expect(formatoNeto(999.999)).toBe('1.000,00');
    expect(formatoNeto(0)).toBe('0,00');
  });
  it('encuentra CUIL con y sin guiones', () => {
    expect(tokensCuil('x 20-11111111-2 y 27222222223 z 1234567890123')).toEqual([A, B]);
  });
});

describe('agruparPorTransaccion', () => {
  const fila = (tx: number, ll: number, cuil: string, extra: Record<string, unknown> = {}) => ({
    TRANSACCIONID: tx, LIQUIDACIONLEGAJOID: ll, IDENTIFICACIONTRIBUTARIANUMERO: `${cuil.slice(0, 2)}-${cuil.slice(2, 10)}-${cuil[10]}`,
    NETO: 100, EMPRESACUIT: '30-70000000-1', EMPRESANOMBRE: 'EMP SA', NROLIQUIDACION: 416,
    TIPOLIQUIDACION: 'Normal', FECHADESDE: '01/07/2026', FECHAHASTA: '31/07/2026', FECHAPAGO: '06/08/2026',
    LEGAJOAPELLIDONOMBRE: 'X', ...extra,
  });
  it('arma una liquidación por transacción con sus legajos', () => {
    const r = agruparPorTransaccion([fila(2, 10, A), fila(1, 11, B), fila(2, 12, C)]);
    expect(r.map((l) => l.transaccionId)).toEqual([1, 2]);
    expect(r[1].legajos.map((l) => l.cuil)).toEqual([A, C]);
    expect(r[1]).toMatchObject({ empresaCuit: EMPRESA, periodo: '2026-07', fechaPago: '2026-08-06', nroLiquidacion: 416 });
  });
  it('rechaza una transacción que mezcla empresas', () => {
    expect(() => agruparPorTransaccion([fila(1, 10, A), fila(1, 11, B, { EMPRESACUIT: '30-79999999-9' })])).toThrow(/mezcla empresas/);
  });
  it('rechaza filas incompletas', () => {
    expect(() => agruparPorTransaccion([fila(1, 10, A, { IDENTIFICACIONTRIBUTARIANUMERO: '' })])).toThrow(/incompleta/);
  });
});

describe('asignarPaginas', () => {
  it('una página por persona', () => {
    const r = asignarPaginas([pag(A, 1053625), pag(B, 1313744.5)], esperados, EMPRESA);
    expect(r.diferencias).toEqual([]);
    expect(r.grupos).toEqual([
      { liquidacionLegajoId: 1, cuil: A, paginas: [0] },
      { liquidacionLegajoId: 2, cuil: B, paginas: [1] },
    ]);
  });
  it('una página sin CUIL es continuación del recibo anterior', () => {
    const r = asignarPaginas([pag(A, 1053625), 'hoja 2 sin datos', pag(B, 1313744.5)], esperados, EMPRESA);
    expect(r.diferencias).toEqual([]);
    expect(r.grupos[0].paginas).toEqual([0, 1]);
  });
  it('la primera página sin CUIL es una diferencia', () => {
    const r = asignarPaginas(['portada', pag(A, 1053625), pag(B, 1313744.5)], esperados, EMPRESA);
    expect(r.diferencias).toEqual(['La página 1 no tiene ningún CUIL de la liquidación.']);
  });
  it('detecta un recibo faltante', () => {
    const r = asignarPaginas([pag(A, 1053625)], esperados, EMPRESA);
    expect(r.diferencias.some((d) => d.includes('Falta el recibo de Dos, Beto'))).toBe(true);
  });
  it('detecta el recibo de alguien que no está en la liquidación', () => {
    const r = asignarPaginas([pag(A, 1053625), pag(C, 5), pag(B, 1313744.5)], esperados, EMPRESA);
    expect(r.diferencias).toEqual([`La página 2 es de un CUIL que no está en la liquidación (${C}).`]);
  });
  it('detecta un CUIL duplicado y una página con dos CUIL', () => {
    expect(asignarPaginas([pag(A, 1053625), pag(A, 1053625), pag(B, 1313744.5)], esperados, EMPRESA).diferencias)
      .toContain(`El CUIL ${A} aparece en más de un recibo (página 2).`);
    expect(asignarPaginas([pag(A, 1053625) + pag(B, 1313744.5)], esperados, EMPRESA).diferencias)
      .toContain('La página 1 tiene más de un CUIL de la liquidación.');
  });
  it('detecta un neto distinto', () => {
    const r = asignarPaginas([pag(A, 1053625), pag(B, 1)], esperados, EMPRESA);
    expect(r.diferencias).toEqual(['El neto de Dos, Beto no coincide con el de Finnegans (1.313.744,50).']);
  });
});

describe('clasificarRespuestaPdf', () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  it('acepta un PDF', () => expect(clasificarRespuestaPdf(enc('%PDF-1.4 ...'))).toEqual({ ok: true }));
  it('rechaza el cuerpo vacío', () => expect(clasificarRespuestaPdf(new Uint8Array())).toMatchObject({ ok: false }));
  it('rechaza el HTML de error y extrae el mensaje', () => {
    const r = clasificarRespuestaPdf(enc('<b>Se ha producido un error</b><br/><table><tr><td class=\\"x\\">No hay datos para generar PDF</td></tr></table>'));
    expect(r).toEqual({ ok: false, motivo: 'Finnegans no devolvió un PDF: No hay datos para generar PDF' });
  });
});

describe('estadoEntrega', () => {
  const pub = new Date('2026-09-01T12:00:00Z');
  const dia = (n: number) => new Date(pub.getTime() + n * 86_400_000);
  it('pendiente hasta el día 14, no retirado desde el 15', () => {
    expect(estadoEntrega({ estado: 'disponible', publicado: pub }, dia(14))).toEqual({ estado: 'pendiente', dias: 14 });
    expect(estadoEntrega({ estado: 'accedido', publicado: pub }, dia(15))).toEqual({ estado: 'no_retirado', dias: 15 });
  });
  it('firmado y papel ganan siempre', () => {
    expect(estadoEntrega({ estado: 'firmado', publicado: pub }, dia(40)).estado).toBe('firmado');
    expect(estadoEntrega({ estado: 'papel', publicado: pub }, dia(40)).estado).toBe('papel');
  });
});

describe('validarFirmaInput', () => {
  const ok = { pin: '4821', conformidad: 'conforme', observaciones: '', leido: true };
  it('acepta una firma conforme', () => expect(validarFirmaInput(ok)).toEqual({ ok: true, firma: { pin: '4821', conformidad: 'conforme', observaciones: '' } }));
  it('exige la declaración de lectura', () => expect(validarFirmaInput({ ...ok, leido: 'true' })).toMatchObject({ ok: false }));
  it('no hay conformidad por defecto', () => expect(validarFirmaInput({ ...ok, conformidad: undefined })).toMatchObject({ ok: false }));
  it('disconforme exige observaciones', () => {
    expect(validarFirmaInput({ ...ok, conformidad: 'disconforme', observaciones: '   ' })).toMatchObject({ ok: false });
    expect(validarFirmaInput({ ...ok, conformidad: 'disconforme', observaciones: ' faltan horas ' }))
      .toEqual({ ok: true, firma: { pin: '4821', conformidad: 'disconforme', observaciones: 'faltan horas' } });
  });
  it('PIN con formato inválido', () => expect(validarFirmaInput({ ...ok, pin: '12' })).toMatchObject({ ok: false }));
});
