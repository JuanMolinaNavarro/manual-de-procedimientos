'use client';

/** Piezas chicas compartidas por las pantallas de nómina. */

import type { ReactNode } from 'react';
import { Info, Lock, AlertTriangle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { fotoUrl, iniciales } from '@/components/organigrama/foto';
import type { EmpleadoNomina } from '@/lib/nomina-calc';

export function EmpleadoCell({ empleado, sub, className }: { empleado: EmpleadoNomina; sub?: ReactNode; className?: string }) {
  const url = fotoUrl(empleado);
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-muted-foreground">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : iniciales(empleado.nombre)}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-foreground">{empleado.nombre}</div>
        {sub !== undefined && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
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
      {children && <p className="mt-1 text-sm text-muted-foreground">{children}</p>}
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
export function Estado({ loading, error, sinOrg }: { loading: boolean; error: string | null; sinOrg?: boolean }) {
  if (sinOrg) return <Empty title="Elegí una empresa">Creá un organigrama en el módulo Organigrama para empezar a liquidar.</Empty>;
  if (error) return <Banner variant="warn">{error}</Banner>;
  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>;
  return null;
}
