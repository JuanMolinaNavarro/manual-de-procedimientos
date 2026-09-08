'use client';

/**
 * Selector de empleado con buscador. El `Select` de shadcn no tiene búsqueda y
 * el organigrama tiene más de cien fichas: elegir una era scrollear la lista
 * entera. Se arma con Popover (ya instalado) en vez de traer `cmdk`.
 */

import { useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { EmpleadoOpt } from './AsistenciaContext';

export default function EmpleadoPicker({
  empleados,
  valor,
  onCambio,
  disabled,
  className,
}: {
  empleados: EmpleadoOpt[];
  valor: number | null;
  onCambio: (empleadoId: number | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const listaRef = useRef<HTMLDivElement>(null);
  const listaId = useId();

  const elegido = valor != null ? empleados.find((e) => e.id === valor) : undefined;

  const opciones = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtrados = needle
      ? empleados.filter((e) => `${e.nombre} ${e.rol} ${e.area}`.toLowerCase().includes(needle))
      : empleados;
    // Agrupadas por área: con 100+ fichas, la lista plana no se lee.
    const porArea = new Map<string, EmpleadoOpt[]>();
    for (const e of filtrados) {
      const area = e.area || 'Sin área';
      const arr = porArea.get(area);
      if (arr) arr.push(e);
      else porArea.set(area, [e]);
    }
    return [...porArea.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [empleados, q]);

  const hayResultados = opciones.length > 0;

  function elegir(id: number | null) {
    onCambio(id);
    setAbierto(false);
    setQ('');
  }

  return (
    <Popover open={abierto} onOpenChange={(o) => { setAbierto(o); if (!o) setQ(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          role="combobox"
          aria-expanded={abierto}
          aria-controls={listaId}
          className={cn(
            'flex h-9 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors',
            'hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span className={cn('truncate', !elegido && 'text-muted-foreground')}>
            {elegido ? `${elegido.nombre} · ${elegido.rol}` : 'Sin vincular'}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80 p-0">
        <div className="relative border-b border-border">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, rol o área"
            className="h-10 border-0 pl-9 shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                listaRef.current?.querySelector<HTMLButtonElement>('button[data-opcion]')?.focus();
              }
            }}
          />
        </div>

        <div id={listaId} ref={listaRef} role="listbox" className="max-h-72 overflow-y-auto p-1">
          <Opcion elegida={valor == null} onClick={() => elegir(null)}>
            <span className="text-muted-foreground">Sin vincular</span>
          </Opcion>

          {!hayResultados && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nadie coincide con «{q}».</p>
          )}

          {opciones.map(([area, gente]) => (
            <div key={area}>
              <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{area}</p>
              {gente.map((e) => (
                <Opcion key={e.id} elegida={e.id === valor} onClick={() => elegir(e.id)}>
                  <span className="truncate">{e.nombre}</span>
                  <span className="truncate text-xs text-muted-foreground">{e.rol}</span>
                </Opcion>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Opcion({ elegida, onClick, children }: { elegida: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      data-opcion
      role="option"
      aria-selected={elegida}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors',
        'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
        elegida && 'bg-accent/60',
      )}
    >
      <Check className={cn('h-3.5 w-3.5 shrink-0', elegida ? 'opacity-100' : 'opacity-0')} />
      <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2">{children}</span>
    </button>
  );
}
