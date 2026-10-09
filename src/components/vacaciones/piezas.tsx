'use client';

/** Piezas chicas compartidas por las pantallas de vacaciones (RR.HH. y Mis vacaciones). */

import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { apiFetch, mensajeError } from '@/components/comunes/api';
import { Avatar } from '@/components/comunes/ui';
import { cn } from '@/lib/utils';
import { DIAS_SEMANA, type EstadoSolicitud, type Flag } from '@/lib/vacaciones-calc';

/**
 * Valida en el servidor el tramo que se está eligiendo (`accion: 'validar'`, con pausa de 300 ms).
 * Devuelve null mientras no hay datos. `version` fuerza a revalidar cuando cambió la selección.
 */
export function usePrevia(url: string, body: Record<string, unknown> | null, version: unknown): Flag[] | null {
  const clave = body ? JSON.stringify(body) : null;
  const [r, setR] = useState<{ clave: string; flags: Flag[] } | null>(null);
  useEffect(() => {
    if (!clave) return;
    const t = setTimeout(() => {
      apiFetch<{ flags: Flag[] }>(url, { method: 'POST', body: JSON.stringify({ accion: 'validar', ...JSON.parse(clave) }) })
        .then((x) => setR({ clave, flags: x.flags }))
        .catch((e: unknown) => setR({ clave, flags: [{ tipo: 'error', msg: mensajeError(e) }] }));
    }, 300);
    return () => clearTimeout(t);
  }, [clave, url, version]);
  return r && r.clave === clave ? r.flags : null;
}

/** Corre una acción por vez: mientras el servidor responde, `ocupado` deshabilita los botones. */
export function useOcupado() {
  const [ocupado, setOcupado] = useState(false);
  async function correr(fn: () => Promise<unknown>) {
    setOcupado(true);
    try {
      await fn();
    } finally {
      setOcupado(false);
    }
  }
  return { ocupado, correr };
}

// ─── Fechas y textos ────────────────────────────────────────────────────────

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** `yyyy-mm-dd` (o `yyyy-mm`) → números. */
export const partesFecha = (f: string) => f.split('-').map(Number);
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** «4 de enero». */
export const diaMes = (f: string) => `${partesFecha(f)[2]} de ${MESES[partesFecha(f)[1] - 1]}`;
/** `MM-DD` → «1 de diciembre». */
export const diaMesMMDD = (md: string) => diaMes(`2000-${md}`);
/** «lunes 4 de enero». */
export function fechaLarga(f: string): string {
  const [y, m, d] = partesFecha(f);
  return `${DIAS_SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${diaMes(f)}`;
}
/** «Lunes 4 de enero → domingo 24 de enero». */
export const rangoLargo = (desde: string, hasta: string) => `${mayuscula(fechaLarga(desde))} → ${fechaLarga(hasta)}`;
/** «4 al 24 de enero» o «22 de febrero al 7 de marzo». */
export const rangoCorto = (desde: string, hasta: string) =>
  desde.slice(0, 7) === hasta.slice(0, 7) ? `${partesFecha(desde)[2]} al ${diaMes(hasta)}` : `${diaMes(desde)} al ${diaMes(hasta)}`;
/** Ejercicio 2026 → «2026/27». */
export const temporadaTxt = (ejercicio: number) => `${ejercicio}/${String(ejercicio + 1).slice(2)}`;
export const primerNombre = (nombre: string) => nombre.split(/\s+/)[0];

/** Para RR.HH.: los mensajes del motor citan artículos; en pantalla alcanza con el qué. */
export const sinCita = (msg: string) => msg.replace(/\s*\((?:arts?\.|Ley|política)[^)]*\)/gi, '');
/** Para la persona: además de los artículos, saca las pantallas de RR.HH. («Nómina › Maestro»). */
export const sinArticulo = (msg: string) => msg.replace(/\s*\((?:(?:arts?\.|Ley|política)[^)]*|[^)]*›[^)]*)\)/gi, '');

// ─── Tamaños ────────────────────────────────────────────────────────────────

/** Botones grandes: la gente que usa el módulo prefiere blancos fáciles de tocar y leer. */
export const BOTON = 'h-11 px-5 text-base';
/** Campos de formulario del mismo alto que los botones. */
export const CAMPO = 'h-11 text-base';

// ─── Componentes ────────────────────────────────────────────────────────────

/** Foto (o iniciales), nombre y una línea de detalle, en tamaño cómodo. */
export function Persona({ e, sub, grande }: { e: { id: number; nombre: string; fotoArchivo: string | null }; sub?: ReactNode; grande?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar nombre={e.nombre} emp={{ id: e.id, foto_archivo: e.fotoArchivo }} className={grande ? 'h-14 w-14 text-lg' : 'h-11 w-11 text-sm'} />
      <div className="min-w-0">
        <div className={cn('truncate font-semibold text-foreground', grande ? 'text-2xl' : 'text-[17px]')}>{e.nombre}</div>
        {sub !== undefined && <div className="truncate text-[15px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

/** Línea de resultado: color + ícono + texto (el color nunca va solo). */
export function Linea({ tono, children }: { tono: 'ok' | 'error' | 'warn' | 'info'; children: ReactNode }) {
  const Icono = tono === 'ok' ? CheckCircle2 : tono === 'info' ? Info : AlertTriangle;
  return (
    <div className={cn(
      'flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-base font-medium',
      tono === 'ok' && 'bg-emerald-500/10',
      tono === 'error' && 'border border-destructive/40 bg-destructive/10',
      tono === 'warn' && 'bg-amber-500/10',
      tono === 'info' && 'bg-muted',
    )}>
      <Icono className={cn(
        'mt-0.5 h-5 w-5 shrink-0',
        tono === 'ok' && 'text-emerald-600 dark:text-emerald-400',
        tono === 'error' && 'text-destructive',
        tono === 'warn' && 'text-amber-700 dark:text-amber-400',
        tono === 'info' && 'text-muted-foreground',
      )} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

type TonoChip = 'neutro' | 'ok' | 'warn' | 'error';

/** Etiqueta redonda y legible. */
export function Chip({ tono = 'neutro', children }: { tono?: TonoChip; children: ReactNode }) {
  return (
    <span className={cn(
      'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-medium',
      tono === 'neutro' && 'bg-secondary text-secondary-foreground',
      tono === 'ok' && 'bg-emerald-500/15 text-foreground',
      tono === 'warn' && 'bg-amber-500/20 text-foreground',
      tono === 'error' && 'bg-destructive/15 text-foreground',
    )}>
      {children}
    </span>
  );
}

const ESTADO_SOLICITUD: Record<EstadoSolicitud, { txt: string; tono: TonoChip }> = {
  borrador: { txt: 'Todavía no eligió', tono: 'neutro' },
  enviada: { txt: 'Para aprobar', tono: 'neutro' },
  aprobada: { txt: 'Aprobada', tono: 'ok' },
  rechazada: { txt: 'Devuelta', tono: 'warn' },
};

export const textoEstado = (estado: EstadoSolicitud) => ESTADO_SOLICITUD[estado].txt;

export function EstadoChip({ estado }: { estado: EstadoSolicitud }) {
  return <Chip tono={ESTADO_SOLICITUD[estado].tono}>{ESTADO_SOLICITUD[estado].txt}</Chip>;
}

/** Las barras de los calendarios se distinguen por relleno y borde, no solo por color. */
export const BARRA = {
  aprobada: 'bg-foreground/70',
  pedida: 'border-2 border-dashed border-foreground/50',
  cierre: 'bg-muted',
  pide: 'border-2 border-foreground bg-[repeating-linear-gradient(135deg,color-mix(in_oklch,var(--foreground)_25%,transparent)_0_6px,transparent_6px_12px)]',
};

export function Buscador({ valor, onCambio, className }: { valor: string; onCambio: (v: string) => void; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
      <Input value={valor} onChange={(ev) => onCambio(ev.target.value)} placeholder="Buscar persona" aria-label="Buscar persona" className={cn(CAMPO, 'pl-10')} />
    </div>
  );
}

/** Referencias de las barras de un calendario. */
export function Leyenda({ items, children }: { items: readonly (readonly [keyof typeof BARRA, string])[]; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px]">
      {items.map(([barra, txt]) => (
        <span key={barra} className="inline-flex items-center gap-2"><span className={cn('h-4 w-7 rounded', BARRA[barra])} />{txt}</span>
      ))}
      {children}
    </div>
  );
}

/** CSV con `;` y BOM, como lo abre Excel en castellano. */
export function csv(filas: (string | number | null | undefined)[][]): string {
  const campo = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `﻿${filas.map((f) => f.map(campo).join(';')).join('\n')}`;
}
