'use client';

/** Piezas chicas compartidas por las pestañas de Asistencia. */

import Link from 'next/link';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { PRESETS_RANGO, rangoPreset, presetDeRango } from '@/lib/asistencia-datos';
import { useAsistencia } from './AsistenciaContext';

export function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        'rounded-md border px-2.5 py-1 text-xs transition-colors',
        activo
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

export function FiltroChip({ onQuitar, children }: { onQuitar: () => void; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs">
      {children}
      <button type="button" aria-label="Quitar filtro" onClick={onQuitar} className="text-muted-foreground hover:text-foreground">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/** Presets + desde/hasta. El rango vive en la URL, así que lo comparten Resumen y Fichadas. */
export function ControlesPeriodo() {
  const { f, set } = useAsistencia();
  const preset = presetDeRango(f.desde, f.hasta);

  return (
    <>
      <Campo label="Período">
        {/* h-9 para que los chips queden a la misma altura que los inputs. */}
        <div className="flex h-9 flex-wrap items-center gap-1.5">
          {PRESETS_RANGO.map((p) => (
            <Chip key={p.id} activo={preset === p.id} onClick={() => set(rangoPreset(p.id))}>
              {p.label}
            </Chip>
          ))}
        </div>
      </Campo>

      <Campo label="Desde">
        <Input type="date" value={f.desde} max={f.hasta} onChange={(e) => set({ desde: e.target.value })} className="h-9 w-40" />
      </Campo>
      <Campo label="Hasta">
        <Input type="date" value={f.hasta} min={f.desde} onChange={(e) => set({ hasta: e.target.value })} className="h-9 w-40" />
      </Campo>
    </>
  );
}

/**
 * Pie de tabla: cuántas filas se están viendo y los saltos de página. Lo usan
 * tanto las tablas que pagina el server (Fichadas) como las que se paginan en
 * el navegador (Personas), así que el pie se lee igual en las dos.
 */
export function Paginacion({
  desdeFila, hastaFila, total, page, totalPaginas, unidad, onPage,
}: {
  desdeFila: number; hastaFila: number; total: number; page: number; totalPaginas: number; unidad: string;
  onPage: (p: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">
        Mostrando {desdeFila.toLocaleString('es-AR')}–{hastaFila.toLocaleString('es-AR')} de {total.toLocaleString('es-AR')} {unidad}
      </span>
      {totalPaginas > 1 && (
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</Button>
          <span className="text-sm text-muted-foreground">Página {page} de {totalPaginas}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPaginas} onClick={() => onPage(page + 1)}>Siguiente</Button>
        </div>
      )}
    </div>
  );
}

export const hrefPerfil = (personaId: number) => `/admin/asistencia/personas/${personaId}`;

/**
 * Envuelve el nombre de una persona con el link a su perfil. Sin `personaId`
 * (empleado sin legajo en el reloj) queda como texto plano: no hay perfil.
 */
export function LinkPerfil({ personaId, nombre, className, children }: { personaId: number | null | undefined; nombre?: string; className?: string; children: React.ReactNode }) {
  if (personaId == null) return <div className={className}>{children}</div>;
  return (
    <Link
      href={hrefPerfil(personaId)}
      aria-label={nombre ? `Ver perfil de ${nombre}` : 'Ver perfil'}
      className={cn('block rounded-md transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', className)}
    >
      {children}
    </Link>
  );
}
