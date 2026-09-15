'use client';

/**
 * Horario de asistencia de la ficha, solo lectura. Se edita únicamente en
 * Asistencia › Personas (versionado, "aplicar desde"); acá se muestra la
 * versión vigente hoy con un link para ir a editarla.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtFechaDia, hoyLocal } from '@/lib/asistencia-datos';
import {
  CICLO_LABELS,
  DIAS_SEMANA,
  DIAS_SEMANA_CORTO,
  DIAS_SEMANA_LARGO,
  ultimaVersion,
  versionVigente,
  type HorarioVersion,
} from '@/lib/asistencia-calendario';

export interface EstadoHorarioEmpleado {
  /** null mientras carga. */
  versiones: HorarioVersion[] | null;
  error: string;
}

/**
 * Versiones de horario de una persona. Vive en el modal (y no en la pestaña)
 * porque el resultado decide si la pestaña Resumen se muestra en modo lectura.
 */
export function useHorarioDeEmpleado(empleadoId: number | null, activo: boolean): EstadoHorarioEmpleado {
  const [cache, setCache] = useState<{ id: number; datos: HorarioVersion[] } | null>(null);
  const [fallo, setFallo] = useState<{ id: number; msg: string } | null>(null);

  useEffect(() => {
    if (!activo || !empleadoId) return;
    let vigente = true;
    fetch(`/api/admin/asistencia/horarios?empleadoId=${empleadoId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudo cargar el horario');
        return ((await res.json()) as { horarios: HorarioVersion[] }).horarios;
      })
      .then((datos) => {
        if (vigente) setCache({ id: empleadoId, datos });
      })
      .catch((e) => {
        if (vigente) setFallo({ id: empleadoId, msg: e instanceof Error ? e.message : 'Error al cargar' });
      });
    return () => {
      vigente = false;
    };
  }, [empleadoId, activo]);

  if (!empleadoId) return { versiones: [], error: '' };
  return {
    versiones: cache?.id === empleadoId ? cache.datos : null,
    error: fallo?.id === empleadoId ? fallo.msg : '',
  };
}

export function HorarioDelEmpleado({ estado, creating }: { estado: EstadoHorarioEmpleado; creating: boolean }) {
  const [hoy] = useState(() => hoyLocal());
  if (creating) return null;
  const { versiones, error } = estado;
  const linkEditar = (
    <Link href="/admin/asistencia?tab=personas" className="inline-flex items-center gap-1 text-xs text-[var(--neu-fg-soft)] hover:text-foreground">
      <ExternalLink className="h-3 w-3" /> Se edita en Asistencia › Personas
    </Link>
  );

  if (error) return <p className="text-xs text-red-600 dark:text-red-400">{error}</p>;
  if (versiones == null) return <p className="text-xs text-[var(--neu-fg-soft)]">Cargando horario…</p>;

  const vigente = versionVigente(versiones, hoy);
  const ultima = ultimaVersion(versiones);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <CalendarClock className="h-4 w-4" /> Horario
        </h4>
        {linkEditar}
      </div>

      {!vigente ? (
        <p className="text-sm text-[var(--neu-fg-soft)]">
          {versiones.length === 0
            ? 'Sin horario cargado.'
            : ultima && ultima.vigenteDesde > hoy
              ? `Sin horario vigente hoy; hay uno que empieza el ${fmtFechaDia(ultima.vigenteDesde)}.`
              : 'Sin horario vigente hoy.'}
        </p>
      ) : !vigente.incluir ? (
        <p className="text-sm text-[var(--neu-fg-soft)]">No incluido en el control de asistencia desde el {fmtFechaDia(vigente.vigenteDesde)}.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {DIAS_SEMANA.map((ds) => {
              const d = vigente.dias[ds];
              const parcial = d && vigente.cicloSemanas > 1 && d.semanas.length < vigente.cicloSemanas;
              return (
                <div
                  key={ds}
                  title={d ? `${DIAS_SEMANA_LARGO[ds]} ${d.entrada}–${d.salida}${parcial ? ` (semanas ${d.semanas.map((n) => n + 1).join(', ')})` : ''}` : `${DIAS_SEMANA_LARGO[ds]}: no laborable`}
                  className={cn(
                    'flex w-[4.25rem] flex-col items-center rounded-lg border px-1 py-1.5 text-center',
                    d ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-dashed border-border text-[var(--neu-fg-soft)] opacity-60',
                  )}
                >
                  <span className="text-xs font-bold">{DIAS_SEMANA_CORTO[ds]}</span>
                  {d ? (
                    <>
                      <span className="text-[11px] tabular-nums">{d.entrada}</span>
                      <span className="text-[11px] tabular-nums">{d.salida}</span>
                      {parcial && <span className="mt-0.5 text-[10px] text-[var(--neu-fg-soft)]">S{d.semanas.map((n) => n + 1).join('/S')}</span>}
                    </>
                  ) : (
                    <span className="text-[11px]">—</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-[var(--neu-fg-soft)]">
            {vigente.cicloSemanas > 1 && `${CICLO_LABELS[vigente.cicloSemanas]} (semana 1 desde el ${fmtFechaDia(vigente.cicloAncla)}) · `}
            {vigente.toleranciaMin != null ? `Tolerancia ${vigente.toleranciaMin} min · ` : ''}
            Vigente desde el {fmtFechaDia(vigente.vigenteDesde)}
            {vigente.vigenteHasta ? ` hasta el ${fmtFechaDia(vigente.vigenteHasta)}` : ''}
            {versiones.length > 1 ? ` · ${versiones.length} versiones` : ''}
          </p>
        </>
      )}
    </div>
  );
}
