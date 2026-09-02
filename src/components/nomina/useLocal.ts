'use client';

import { useEffect, useState } from 'react';

/**
 * Copia local editable de datos que vienen de la API: se resincroniza cuando
 * llega una versión nueva y se edita en el acto (los inputs son controlados),
 * mientras el guardado va por detrás.
 */
export function useLocal<T>(data: T | null): [T | null, React.Dispatch<React.SetStateAction<T | null>>] {
  const [local, setLocal] = useState<T | null>(data);
  useEffect(() => { setLocal(data); }, [data]);
  return [local, setLocal];
}
