import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { contarPaginas, extraerTextos, partirPorGrupos } from './recibos-pdf';
import { asignarPaginas } from './recibos-finnegans-calc';

/** Sábana sintética: una página por línea de texto (CUIL ficticios). */
async function sabana(lineas: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const l of lineas) {
    const p = doc.addPage([400, 200]);
    p.drawText(l, { x: 20, y: 100, size: 10, font });
  }
  return doc.save();
}

describe('recibos-pdf', () => {
  it('lee el texto de cada página y la parte en un PDF por persona', async () => {
    const pdf = await sabana([
      'CUIT 30-70000000-1 CUIL 20-11111111-2 Neto 1.000,00',
      'continuacion del recibo',
      'CUIT 30-70000000-1 CUIL 27-22222222-3 Neto 2.500,50',
    ]);
    const textos = await extraerTextos(pdf);
    expect(textos).toHaveLength(3);
    expect(textos[0]).toContain('20-11111111-2');

    const { grupos, diferencias } = asignarPaginas(
      textos,
      [
        { liquidacionLegajoId: 1, cuil: '20111111112', neto: 1000, nombre: 'A' },
        { liquidacionLegajoId: 2, cuil: '27222222223', neto: 2500.5, nombre: 'B' },
      ],
      '30700000001',
    );
    expect(diferencias).toEqual([]);
    expect(grupos.map((g) => g.paginas)).toEqual([[0, 1], [2]]);

    const partes = await partirPorGrupos(pdf, grupos.map((g) => g.paginas));
    expect(partes).toHaveLength(2);
    expect(await contarPaginas(partes[0])).toBe(2);
    expect(await contarPaginas(partes[1])).toBe(1);
    const [soloB] = await extraerTextos(partes[1]);
    expect(soloB).toContain('27-22222222-3');
    expect(soloB).not.toContain('20-11111111-2');
  });

  it('rechaza páginas fuera de rango', async () => {
    const pdf = await sabana(['una']);
    await expect(partirPorGrupos(pdf, [[1]])).rejects.toThrow(/fuera de rango/);
  });
});
