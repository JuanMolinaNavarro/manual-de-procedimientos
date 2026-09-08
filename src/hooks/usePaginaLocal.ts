'use client';

import { useState } from 'react';

/**
 * Pagina en el navegador una lista que ya vino entera del server.
 *
 * `clave` identifica al conjunto que se está paginando (búsqueda + filtros
 * activos). Cuando cambia, se vuelve sola a la página 1: filtrar parada en la
 * página 12 dejaba la tabla vacía sin explicación. Se resuelve durante el
 * render en vez de con un efecto para no repintar dos veces por cada tecla.
 *
 * La página también se recorta contra el total: archivar o vincular filas puede
 * dejar la página actual fuera de rango.
 */
export function usePaginaLocal<T>(items: T[], clave: string, tam: number) {
  const [estado, setEstado] = useState({ clave, page: 1 });

  const total = items.length;
  const totalPaginas = Math.max(1, Math.ceil(total / tam));
  const page = Math.min(estado.clave === clave ? estado.page : 1, totalPaginas);

  return {
    visibles: items.slice((page - 1) * tam, page * tam),
    page,
    totalPaginas,
    total,
    desdeFila: total === 0 ? 0 : (page - 1) * tam + 1,
    hastaFila: Math.min(page * tam, total),
    onPage: (p: number) => setEstado({ clave, page: p }),
  };
}
