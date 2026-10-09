'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/components/comunes/api';

export interface DatosDeEmpleado<T> {
  /** null mientras carga; [] para una ficha sin guardar. */
  datos: T[] | null;
  error: string;
  /** Vuelve a pedir la lista (tras subir/editar/borrar). */
  recargar: () => void;
}

/**
 * Trae una lista de la ficha de una persona (documentos, licencias, proyectos, recibos, horario).
 * Se llama desde el modal y no desde cada pestaña porque el resultado decide si la pestaña se
 * muestra: en modo lectura las vacías se ocultan.
 *
 * Resultado y error se guardan junto al id que los produjo: al cambiar de persona el estado se
 * deriva a "cargando" sin resetearlo desde el efecto (nada de datos de la ficha anterior).
 * `activo = false` no pide nada (modal cerrado, ficha sin guardar o sin permiso). `campo`: la
 * respuesta trae la lista dentro de esa clave.
 */
export function useDeEmpleado<T>(
  url: string,
  empleadoId: number | null,
  activo: boolean,
  mensajeError: string,
  campo?: string,
): DatosDeEmpleado<T> {
  const [cache, setCache] = useState<{ id: number; datos: T[] } | null>(null);
  const [fallo, setFallo] = useState<{ id: number; msg: string } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    // id 0 o null = empleado sin guardar (modo alta): no hay nada que buscar.
    if (!activo || !empleadoId) return;
    let vigente = true;
    apiFetch<unknown>(url)
      .then((r) => {
        if (vigente) setCache({ id: empleadoId, datos: (campo ? (r as Record<string, T[]>)[campo] : r) as T[] });
      })
      .catch(() => {
        if (vigente) setFallo({ id: empleadoId, msg: mensajeError });
      });
    return () => {
      vigente = false;
    };
  }, [url, empleadoId, activo, mensajeError, campo, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  if (!empleadoId) return { datos: [], error: '', recargar };
  return {
    datos: cache?.id === empleadoId ? cache.datos : null,
    error: fallo?.id === empleadoId ? fallo.msg : '',
    recargar,
  };
}
