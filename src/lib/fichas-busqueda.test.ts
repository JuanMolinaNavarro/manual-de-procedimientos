import { describe, expect, it } from 'vitest';
import { buscarFichas, resaltar, type FichaOpcion } from './fichas-busqueda';

const ficha = (id: number, nombre: string, extra: Partial<FichaOpcion> = {}): FichaOpcion => ({
  id, nombre, puesto: 'Operador', area: 'Atención', lugar: 'Central', cuil: '', oculta: false, usuario: null, ...extra,
});

const FICHAS = [
  ficha(1, 'Facundo Olarte', { cuil: '20-43028438-0' }),
  ficha(2, 'Lucía García', { area: 'Recursos Humanos', usuario: { id: 7, usuario: 'lgarcia' } }),
  ficha(3, 'Ana Pérez', { oculta: true }),
  ficha(4, 'Bruno Díaz', { area: 'Recursos Humanos' }),
];
const ids = (fs: FichaOpcion[]) => fs.map((f) => f.id);

describe('buscarFichas', () => {
  it('sin texto ofrece solo las libres y visibles', () => {
    expect(ids(buscarFichas(FICHAS, '', { verOcupadas: false }))).toEqual([4, 1]);
  });

  it('busca sin tildes, por palabra en cualquier orden, y por área', () => {
    expect(ids(buscarFichas(FICHAS, 'olarte FACUNDO', { verOcupadas: false }))).toEqual([1]);
    expect(ids(buscarFichas(FICHAS, 'diaz', { verOcupadas: false }))).toEqual([4]);
    expect(ids(buscarFichas(FICHAS, 'recursos', { verOcupadas: false }))).toEqual([4]);
  });

  it('busca por CUIL con o sin guiones desde 3 dígitos', () => {
    expect(ids(buscarFichas(FICHAS, '43028438', { verOcupadas: false }))).toEqual([1]);
    expect(ids(buscarFichas(FICHAS, '20-4302', { verOcupadas: false }))).toEqual([1]);
    expect(ids(buscarFichas(FICHAS, '20', { verOcupadas: false }))).toEqual([]);
  });

  it('las ocupadas van al final con la casilla, y la propia no cuenta como ocupada', () => {
    expect(ids(buscarFichas(FICHAS, 'recursos', { verOcupadas: true }))).toEqual([4, 2]);
    expect(ids(buscarFichas(FICHAS, 'recursos', { verOcupadas: false, usuarioId: 7 }))).toEqual([4, 2]);
  });
});

describe('resaltar', () => {
  it('marca cada palabra sin importar tildes ni mayúsculas', () => {
    expect(resaltar('Lucía García', 'luc garc')).toEqual([
      { texto: 'Luc', marca: true },
      { texto: 'ía ', marca: false },
      { texto: 'Garc', marca: true },
      { texto: 'ía', marca: false },
    ]);
    expect(resaltar('Lucía', 'lucia')).toEqual([{ texto: 'Lucía', marca: true }]);
    expect(resaltar('Ana', '')).toEqual([{ texto: 'Ana', marca: false }]);
  });
});
