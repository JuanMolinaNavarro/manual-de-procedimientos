import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Minúsculas y sin tildes, para buscar sin importar cómo se escribió ("garcia" encuentra "García"). */
export function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

/** B\u00fasqueda sin tildes: `q` vac\u00edo coincide con todo; si no, alguno de los textos lo contiene. */
export function coincide(q: string, ...textos: (string | null | undefined)[]): boolean {
  const buscado = sinTildes(q.trim())
  return !buscado || textos.some((t) => t != null && sinTildes(t).includes(buscado))
}
