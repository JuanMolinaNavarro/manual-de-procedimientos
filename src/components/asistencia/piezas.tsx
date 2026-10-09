'use client';

/** Piezas chicas compartidas por las pestañas de Asistencia. */

import Link from 'next/link';
import { ChevronLeft, ChevronRight, MapPin, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, sinTildes } from '@/lib/utils';
import { PRESETS_RANGO, rangoPreset, presetDeRango } from '@/lib/asistencia-datos';
import { porcentajeHoras, type ResumenMesPersona } from '@/lib/asistencia-tablero-calc';
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

/** Presets + desde/hasta de Fichadas. El rango vive en la URL: se puede compartir por link. */
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

/** Perfil de una persona del reloj; con `mes`, abre en ese mes. */
const hrefPerfil = (personaId: number, mes?: string) => `/admin/asistencia/personas/${personaId}${mes ? `?mes=${mes}` : ''}`;

/**
 * Envuelve el nombre de una persona con el link a su perfil. Sin `personaId`
 * (empleado sin legajo en el reloj) queda como texto plano: no hay perfil.
 */
export function LinkPerfil({ personaId, nombre, mes, className, children }: { personaId: number | null | undefined; nombre?: string; mes?: string; className?: string; children: React.ReactNode }) {
  if (personaId == null) return <div className={className}>{children}</div>;
  return (
    <Link
      href={hrefPerfil(personaId, mes)}
      aria-label={nombre ? `Ver perfil de ${nombre}` : 'Ver perfil'}
      className={cn('block rounded-md transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', className)}
    >
      {children}
    </Link>
  );
}

// ─── Piezas de las vistas Día, Mes y Perfil (letra de 16 px, controles de 44 px) ──

/** Colores de estado del sistema (README de Aurelius): el color siempre va con su palabra. */
const TONOS = {
  ok: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  warn: 'bg-amber-400/25 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300',
  grave: 'bg-orange-600/15 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  bad: 'bg-red-500/15 text-red-700 dark:text-red-400',
  info: 'bg-sky-400/20 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300',
  neutro: 'bg-muted text-foreground',
  comp: 'border border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-400',
} as const;
export type Tono = keyof typeof TONOS;

export function Etiqueta({ tono, children }: { tono: Tono; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-sm font-medium [&_svg]:size-4', TONOS[tono])}>
      {children}
    </span>
  );
}

/** Horas trabajadas contra las esperadas (Mes y Perfil). */
export function BarraHoras({ r, className }: { r: Pick<ResumenMesPersona, 'minutosTrabajados' | 'minutosEsperados'>; className?: string }) {
  return (
    <span aria-hidden className={cn('block h-2 overflow-hidden rounded-full bg-muted', className)}>
      <span className="block h-full rounded-full bg-primary" style={{ width: `${porcentajeHoras(r)}%` }} />
    </span>
  );
}

/** Anterior / etiqueta / siguiente, para moverse de a un día o de a un mes. */
export function NavPeriodo({
  label, sub, unidad, onAnterior, onSiguiente, sinSiguiente = false,
}: {
  label: React.ReactNode; sub?: React.ReactNode; unidad: 'Día' | 'Mes'; onAnterior: () => void; onSiguiente: () => void; sinSiguiente?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" className="size-11 shrink-0" aria-label={`${unidad} anterior`} onClick={onAnterior}>
        <ChevronLeft className="size-5" />
      </Button>
      <div className="min-w-44 flex-1 text-center leading-tight">
        <div className="text-lg font-semibold">{label}</div>
        {sub && <div className="text-sm text-muted-foreground">{sub}</div>}
      </div>
      <Button variant="outline" size="icon" className="size-11 shrink-0" aria-label={`${unidad} siguiente`} disabled={sinSiguiente} onClick={onSiguiente}>
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );
}

const TODOS = 'todos';

/** Sede (organigrama) a mirar; vive en la URL y la comparten Día y Mes. */
export function SelectorLugar({ lugares }: { lugares: { id: number; nombre: string }[] }) {
  const { f, set } = useAsistencia();
  // El texto va explícito: Radix no lo pinta hasta tener las opciones, y mientras carga quedaba vacío.
  const elegido = f.lugar == null ? 'Todos los lugares' : lugares.find((l) => l.id === f.lugar)?.nombre ?? '…';
  return (
    <Select value={f.lugar != null ? String(f.lugar) : TODOS} onValueChange={(v) => set({ lugar: v === TODOS ? null : Number(v) })}>
      <SelectTrigger aria-label="Lugar" className="h-11 w-full justify-start text-base sm:w-56 [&_svg]:size-4">
        <MapPin className="text-muted-foreground" />
        <span className="flex-1 truncate text-left"><SelectValue>{elegido}</SelectValue></span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>Todos los lugares</SelectItem>
        {lugares.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function Buscador({ valor, onCambio }: { valor: string; onCambio: (v: string) => void }) {
  return (
    <div className="relative min-w-0 flex-1 sm:min-w-64">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" aria-label="Buscar persona o área" placeholder="Buscar persona o área" value={valor} onChange={(e) => onCambio(e.target.value)} className="h-11 pl-11 text-base md:text-base" />
    </div>
  );
}

/** Búsqueda sin tildes por nombre o área. */
export function coincide(p: { nombre: string; area: string | null }, q: string): boolean {
  const needle = sinTildes(q.trim());
  return !needle || sinTildes(p.nombre).includes(needle) || sinTildes(p.area ?? '').includes(needle);
}
