'use client';

import { useEffect, useState } from 'react';

/**
 * Devuelve `valor` recién después de que se quedó quieto `ms`. Para inputs de
 * búsqueda que disparan un fetch: sin esto se manda una request por tecla.
 */
export function useDebouncedValue<T>(valor: T, ms = 300): T {
  const [tardio, setTardio] = useState(valor);

  useEffect(() => {
    const t = setTimeout(() => setTardio(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);

  return tardio;
}
