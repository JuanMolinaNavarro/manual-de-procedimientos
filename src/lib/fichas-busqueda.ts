/**
 * Búsqueda de fichas del organigrama para vincular a un usuario (FichaPicker). Pura, para
 * poder probarla sin React.
 */

import { coincide, sinTildes } from '@/lib/utils';

/** Lo que devuelve `GET /api/admin/usuarios/fichas`. */
export interface FichaOpcion {
  id: number;
  nombre: string;
  puesto: string;
  area: string;
  /** Nombre del organigrama (empresa o ubicación). '' = sin organigrama. */
  lugar: string;
  /** Del Maestro de Nómina; '' = sin cargar. */
  cuil: string;
  /** Quitada del organigrama: no se ofrece. */
  oculta: boolean;
  usuario: { id: number; usuario: string } | null;
}

/** La ficha ya está vinculada a otro usuario (no al que se está editando). */
export function ocupada(f: FichaOpcion, usuarioId?: number): boolean {
  return f.usuario != null && f.usuario.id !== usuarioId;
}

/**
 * Fichas visibles que coinciden con `q`: cada palabra, sin tildes, en el nombre, el puesto o el
 * área (en cualquier orden: «olarte facundo» encuentra a «Facundo Olarte»); con 3 dígitos o más,
 * también por CUIL, con o sin guiones. Las ocupadas solo con `verOcupadas`, y al final.
 */
export function buscarFichas(
  fichas: FichaOpcion[],
  q: string,
  { verOcupadas, usuarioId }: { verOcupadas: boolean; usuarioId?: number },
): FichaOpcion[] {
  const palabras = q.trim().split(/\s+/).filter(Boolean);
  const digitos = q.replace(/\D/g, '');
  const porCuil = (f: FichaOpcion) => digitos.length >= 3 && f.cuil.replace(/\D/g, '').includes(digitos);
  return fichas
    .filter((f) => !f.oculta && (verOcupadas || !ocupada(f, usuarioId)))
    .filter((f) => palabras.every((p) => coincide(p, f.nombre, f.puesto, f.area)) || porCuil(f))
    .sort((a, b) => Number(ocupada(a, usuarioId)) - Number(ocupada(b, usuarioId)) || a.nombre.localeCompare(b.nombre, 'es'));
}

/** `texto` en tramos, con `marca` en cada aparición (sin tildes) de las palabras de `q`. */
export function resaltar(texto: string, q: string): { texto: string; marca: boolean }[] {
  const plano = sinTildes(texto);
  // Quitar tildes deja una letra por letra; si no (texto ya descompuesto), no se marca nada.
  if (plano.length !== texto.length) return [{ texto, marca: false }];
  const marca = new Array<boolean>(texto.length).fill(false);
  for (const p of sinTildes(q).split(/\s+/).filter(Boolean)) {
    for (let i = plano.indexOf(p); i >= 0; i = plano.indexOf(p, i + 1)) marca.fill(true, i, i + p.length);
  }
  const tramos: { texto: string; marca: boolean }[] = [];
  for (let i = 0; i < texto.length; i++) {
    const ultimo = tramos.at(-1);
    if (ultimo?.marca === marca[i]) ultimo.texto += texto[i];
    else tramos.push({ texto: texto[i], marca: marca[i] });
  }
  return tramos;
}
