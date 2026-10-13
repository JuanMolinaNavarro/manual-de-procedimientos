'use client';

/**
 * Piezas chicas compartidas por las pantallas del panel (nómina, asistencia, …).
 * Nacieron en las pantallas de nómina.
 */

import type { ReactNode } from 'react';
import { Info, Lock, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { fmtMes, mesAnterior, mesSiguiente } from '@/lib/fechas';
import { fotoUrl, iniciales } from '@/components/organigrama/foto';

/** Lo mínimo que necesita `EmpleadoCell`: cualquier ficha con foto sirve. */
export interface EmpleadoConFoto {
  id: number;
  nombre: string;
  foto_archivo: string | null;
}

/** Foto de la ficha o, sin foto, sus iniciales. `className` fija el tamaño y la letra (por defecto 96 px). */
export function Avatar({ nombre, emp, className }: { nombre: string | null; emp?: { id: number; foto_archivo: string | null }; className?: string }) {
  const url = emp ? fotoUrl(emp) : null;
  return (
    <div className={cn('flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-semibold text-muted-foreground', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : nombre ? iniciales(nombre) : ''}
    </div>
  );
}

/** `grande`: letra de 16 px y foto de 40 px, para las pantallas pensadas para leer sin esfuerzo. */
export function EmpleadoCell({ empleado, sub, className, grande = false }: { empleado: EmpleadoConFoto; sub?: ReactNode; className?: string; grande?: boolean }) {
  return (
    <div className={cn('flex min-w-0 items-center', grande ? 'gap-3' : 'gap-2.5', className)}>
      <Avatar nombre={empleado.nombre} emp={empleado} className={grande ? 'h-10 w-10 text-sm' : 'h-9 w-9 text-xs'} />
      <div className="min-w-0">
        <div className={cn('truncate font-semibold text-foreground', grande ? 'text-base' : 'text-sm')}>{empleado.nombre}</div>
        {/* En grande el detalle se parte en dos líneas antes que cortarse: en el celular trae datos (horas). */}
        {sub !== undefined && <div className={cn('text-muted-foreground', grande ? 'text-sm' : 'truncate text-xs')}>{sub}</div>}
      </div>
    </div>
  );
}

export function StatCard({ label, value, detail, tone, children }: { label: string; value?: ReactNode; detail?: ReactNode; tone?: 'violet' | 'red' | 'orange' | 'green'; children?: ReactNode }) {
  const color = tone === 'violet' ? 'text-violet-600 dark:text-violet-400'
    : tone === 'red' ? 'text-red-600 dark:text-red-400'
    : tone === 'orange' ? 'text-amber-600 dark:text-amber-400'
    : tone === 'green' ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-foreground';
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        {value !== undefined && <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>}
        {children}
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * Mes con flechas (`yyyy-mm`). Reemplaza a `<input type="month">`, que Safari de escritorio no
 * soporta (muestra un campo de texto libre).
 */
export function SelectorMes({ mes, onCambio, className }: { mes: string; onCambio: (mes: string) => void; className?: string }) {
  return (
    <div className={cn('flex h-9 items-center rounded-md border border-input', className)}>
      <Button variant="ghost" size="icon" className="h-full w-9 shrink-0 rounded-r-none" aria-label="Mes anterior" onClick={() => onCambio(mesAnterior(mes))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="flex-1 whitespace-nowrap px-1 text-center text-sm font-medium" aria-live="polite">{fmtMes(mes)}</span>
      <Button variant="ghost" size="icon" className="h-full w-9 shrink-0 rounded-l-none" aria-label="Mes siguiente" onClick={() => onCambio(mesSiguiente(mes))}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function Banner({ variant = 'info', children }: { variant?: 'info' | 'locked' | 'warn'; children: ReactNode }) {
  const Icon = variant === 'locked' ? Lock : variant === 'warn' ? AlertTriangle : Info;
  return (
    <div className={cn(
      'flex gap-3 rounded-lg border p-3 text-sm leading-relaxed',
      variant === 'locked' && 'border-amber-500/40 bg-amber-500/10 text-foreground',
      variant === 'warn' && 'border-red-500/40 bg-red-500/10 text-foreground',
      variant === 'info' && 'border-border bg-muted/40 text-muted-foreground',
    )}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Encabezado de columna con ayuda en popover. */
export function ColHelp({ label, desc }: { label: string; desc: string }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap">
      {label}
      <Popover>
        <PopoverTrigger
          aria-label={`Ayuda: ${label}`}
          className="ml-1 inline-flex rounded-full align-middle text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Info className="h-3.5 w-3.5" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-1.5">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
        </PopoverContent>
      </Popover>
    </span>
  );
}

export function PageTitle({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <p className="font-semibold text-foreground">{title}</p>
      {children && <div className="mt-1 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function FlagRow({ tipo, children }: { tipo: 'error' | 'warn' | 'ok'; children: ReactNode }) {
  return (
    <div className={cn(
      'rounded-md border-l-4 px-3 py-2 text-sm',
      tipo === 'error' && 'border-red-500 bg-red-500/10',
      tipo === 'warn' && 'border-amber-500 bg-amber-500/10',
      tipo === 'ok' && 'border-emerald-500 bg-emerald-500/10',
    )}>
      {children}
    </div>
  );
}

/** Estado de carga/errores uniforme; devuelve null cuando hay datos. */
/**
 * Error al cargar un bloque, con reintento. Sin esto la pantalla se quedaba en "Cargando…" (o
 * en blanco) para siempre cuando la API respondía un error.
 */
export function ErrorCarga({ error, onReintentar }: { error: string; onReintentar?: () => void }) {
  return (
    <p className="text-sm text-destructive" role="alert">
      No se pudo cargar: {error}
      {onReintentar && (
        <>
          {' '}
          <button type="button" className="font-medium underline underline-offset-2" onClick={onReintentar}>
            Reintentar
          </button>
        </>
      )}
    </p>
  );
}

export function Estado({ loading, error, sinOrg }: { loading: boolean; error: string | null; sinOrg?: boolean }) {
  if (sinOrg) return <Empty title="Elegí una empresa">Creá un organigrama en el módulo Organigrama para empezar a liquidar.</Empty>;
  if (error) return <Banner variant="warn">{error}</Banner>;
  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>;
  return null;
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
