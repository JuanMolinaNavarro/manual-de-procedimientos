'use client';

/**
 * Piezas del panel de Recibos de RR.HH.: la tarjeta de cada paso del mes (importar → avisar →
 * firmas) y la barra de búsqueda + filtros de las listas.
 */

import type { ReactNode } from 'react';
import { AlertTriangle, Check, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type EstadoPaso = 'hecho' | 'pendiente' | 'atencion' | 'bloqueado';

export function PasoCard({ n, titulo, estado, children, accion }: {
  n: number;
  titulo: string;
  estado: EstadoPaso;
  children: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <div className={cn(
      'flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors',
      estado === 'atencion' ? 'border-amber-500/50' : 'border-border',
      estado === 'bloqueado' && 'opacity-60',
    )}>
      <div className="flex items-center gap-2.5">
        <span className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          estado === 'hecho' && 'bg-emerald-600 text-white',
          estado === 'atencion' && 'bg-amber-500 text-white',
          (estado === 'pendiente' || estado === 'bloqueado') && 'bg-muted text-muted-foreground',
        )}>
          {estado === 'hecho' ? <Check className="h-4 w-4" /> : estado === 'atencion' ? <AlertTriangle className="h-3.5 w-3.5" /> : n}
        </span>
        <h3 className="font-semibold text-foreground">{titulo}</h3>
      </div>
      <div className="flex-1 space-y-1 text-sm text-muted-foreground">{children}</div>
      {accion && <div className="flex flex-wrap gap-2">{accion}</div>}
    </div>
  );
}

export interface Filtro<T extends string> { valor: T; label: string; cuenta: number }

/** Buscador por nombre + chips de filtro con su cantidad. */
export function BarraFiltros<T extends string>({ buscar, onBuscar, filtros, activo, onFiltro, placeholder = 'Buscar por nombre' }: {
  buscar: string;
  onBuscar: (v: string) => void;
  filtros: Filtro<T>[];
  activo: T;
  onFiltro: (v: T) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative sm:w-64">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={buscar} onChange={(e) => onBuscar(e.target.value)} placeholder={placeholder} className="h-9 pl-8" aria-label={placeholder} />
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar">
        {filtros.map((f) => (
          <button
            key={f.valor}
            type="button"
            aria-pressed={activo === f.valor}
            onClick={() => onFiltro(f.valor)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
              activo === f.valor
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
            )}
          >
            {f.label}
            <span className={cn('tabular-nums', activo === f.valor ? 'opacity-70' : 'opacity-60')}>{f.cuenta}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Normaliza para buscar sin tildes ni mayúsculas. */
export function coincide(texto: string, buscar: string): boolean {
  const n = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return n(texto).includes(n(buscar.trim()));
}
