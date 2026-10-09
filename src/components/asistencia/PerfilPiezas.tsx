'use client';

/**
 * Piezas de asistencia que no dependen del contexto del módulo (reciben todo por props): la foto
 * del perfil y la grilla de días de un horario, que también usa la ficha del organigrama.
 */

import { fotoUrl, iniciales } from '@/components/organigrama/foto';
import { cn } from '@/lib/utils';
import { DIAS_SEMANA, DIAS_SEMANA_CORTO, DIAS_SEMANA_LARGO, type HorarioVersion } from '@/lib/asistencia-calendario';

/** `className` cambia el tamaño (por defecto 96 px). */
export function Foto({ nombre, emp, className }: { nombre: string | null; emp?: { id: number; foto_archivo: string | null }; className?: string }) {
  const url = emp ? fotoUrl(emp) : null;
  return (
    <div className={cn('flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-semibold text-muted-foreground', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : nombre ? iniciales(nombre) : ''}
    </div>
  );
}

/**
 * Días de la semana de un horario (con turnos rotativos por semana del ciclo). Lo usa la ficha del
 * organigrama. `suave` = clase del texto atenuado (la ficha usa la paleta neumórfica).
 */
export function GrillaDiasHorario({ vigente, suave = 'text-muted-foreground' }: { vigente: HorarioVersion; suave?: string }) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {DIAS_SEMANA.map((ds) => {
        const d = vigente.dias[ds];
        const parcial = d && vigente.cicloSemanas > 1 && d.semanas.length < vigente.cicloSemanas;
        const rotativo = d && vigente.cicloSemanas > 1 && d.porSemana && Object.keys(d.porSemana).length > 0;
        const horasSem = (n: number) => d?.porSemana?.[n] ?? d;
        return (
          <div
            key={ds}
            title={d ? (rotativo ? `${DIAS_SEMANA_LARGO[ds]} ${d.semanas.map((n) => `S${n + 1} ${horasSem(n)!.entrada}–${horasSem(n)!.salida}`).join(', ')}` : `${DIAS_SEMANA_LARGO[ds]} ${d.entrada}–${d.salida}${parcial ? ` (semanas ${d.semanas.map((n) => n + 1).join(', ')})` : ''}`) : `${DIAS_SEMANA_LARGO[ds]}: no laborable`}
            className={cn(
              'flex flex-col items-center rounded-md border px-0.5 py-1.5 text-center',
              d ? 'border-primary/40 bg-primary/10 text-foreground' : cn('border-dashed border-border opacity-60', suave),
            )}
          >
            <span className="text-xs font-bold">{DIAS_SEMANA_CORTO[ds]}</span>
            {d && rotativo ? (
              d.semanas.map((n) => (
                <span key={n} className="text-[9px] tabular-nums leading-tight">S{n + 1} {horasSem(n)!.entrada}–{horasSem(n)!.salida}</span>
              ))
            ) : d ? (
              <>
                <span className="text-[10px] tabular-nums">{d.entrada}</span>
                <span className="text-[10px] tabular-nums">{d.salida}</span>
                {parcial && <span className={cn('text-[9px]', suave)}>S{d.semanas.map((n) => n + 1).join('/')}</span>}
              </>
            ) : (
              <span className="text-[10px]">—</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
