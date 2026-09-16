'use client';

/**
 * Perfil de una persona: el mes visto desde la liquidación de sueldos.
 * Ausencias, llegadas tarde y horas trabajadas contra las esperadas, más el
 * detalle día por día. Todo sale del mismo `evaluarDia` del calendario.
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarClock, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Banner, StatCard } from '@/components/comunes/ui';
import { cn } from '@/lib/utils';
import { fmtFechaDia, fmtHoraCorta, hoyLocal } from '@/lib/asistencia-datos';
import {
  DIAS_SEMANA_CORTO,
  ESTADOS_DIA,
  describirHorario,
  fmtHorasMin,
  fmtMes,
  mesAnterior,
  mesSiguiente,
  versionVigente,
  type CeldaDia,
  type EstadoDia,
} from '@/lib/asistencia-calendario';
import type { PerfilPersona, Persona } from './api';
import { useAsistencia, useAsistenciaData } from './AsistenciaContext';

const TONO: Partial<Record<EstadoDia, string>> = {
  a_horario: 'border-emerald-500/50 text-emerald-700 dark:text-emerald-400',
  tarde: 'border-amber-500/60 text-amber-700 dark:text-amber-400',
  tarde_grave: 'border-orange-600/70 text-orange-700 dark:text-orange-400',
  ausente: 'border-red-500/60 text-red-700 dark:text-red-400',
  trabajo_no_laborable: 'border-sky-500/60 text-sky-700 dark:text-sky-400',
};

const ddmm = (f: string) => fmtFechaDia(f).slice(0, 5);

export default function PerfilPersonaDialog({
  persona, open, onOpenChange, onEditarHorario,
}: {
  persona: Persona;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEditarHorario?: () => void;
}) {
  const { set } = useAsistencia();
  const [hoy] = useState(() => hoyLocal());
  const [mes, setMes] = useState(() => hoy.slice(0, 7));
  const { data, error, loading } = useAsistenciaData<PerfilPersona>(open ? `/api/admin/asistencia/personas/${persona.id}/perfil?mes=${mes}` : null);

  const vigente = data ? versionVigente(data.versiones, hoy) : null;
  const r = data?.resumen ?? null;
  const sinHorario = !!data && !data.fila?.tieneHorario;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{persona.nombre}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span>Legajo del reloj <span className="font-medium text-foreground">{persona.userId}</span></span>
              {persona.empleado ? (
                <span>{persona.empleado.rol} · {persona.empleado.area}</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">Sin ficha vinculada: sin horario, solo se ven sus marcas.</span>
              )}
              {vigente && (
                <span>
                  Horario: <span className="font-medium text-foreground">{describirHorario(vigente)}</span>
                  {vigente.toleranciaMin != null ? ` · tolerancia ${vigente.toleranciaMin} min` : ''}
                </span>
              )}
              {!persona.activa && <Badge variant="secondary">inactiva</Badge>}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Mes anterior" onClick={() => setMes(mesAnterior(mes))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-36 text-center text-sm font-semibold">{fmtMes(mes)}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Mes siguiente" onClick={() => setMes(mesSiguiente(mes))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {mes !== hoy.slice(0, 7) && (
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setMes(hoy.slice(0, 7))}>Hoy</Button>
          )}
        </div>

        {error && <Banner variant="warn">{error}</Banner>}

        {!data ? (
          loading ? <Skeleton className="h-64 w-full" /> : null
        ) : (
          <div className={cn('space-y-4', loading && 'opacity-60')}>
            {sinHorario ? (
              <Banner variant="info">
                Sin horario vigente en {fmtMes(mes).toLowerCase()}: no se calculan ausencias, tardanzas ni horas esperadas.
                {persona.empleado ? ' Cargalo con «Editar horario».' : ' Vinculá la ficha del organigrama y cargale un horario.'}
              </Banner>
            ) : (
              r && <Resumen r={r} hoyEnMes={data.hoy >= data.desde && data.hoy <= data.hasta} />
            )}

            <Detalle celdas={data.fila?.celdas ?? []} dias={data.dias} />
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => { onOpenChange(false); set({ tab: 'calendario', mes }); }}>
            <CalendarDays className="h-4 w-4" /> Ver en el calendario
          </Button>
          <div className="flex gap-2">
            {onEditarHorario && (
              <Button variant="outline" size="sm" onClick={onEditarHorario}>
                <CalendarClock className="h-4 w-4" /> Editar horario
              </Button>
            )}
            <Button size="sm" onClick={() => onOpenChange(false)}>Cerrar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Resumen({ r, hoyEnMes }: { r: NonNullable<PerfilPersona['resumen']>; hoyEnMes: boolean }) {
  const esperadas = hoyEnMes ? r.minutosEsperadosHastaHoy : r.minutosEsperadosMes;
  const pct = esperadas > 0 ? Math.min(100, Math.round((r.minutosTrabajados / esperadas) * 100)) : 0;
  const lista = (fechas: string[]) => (fechas.length ? fechas.map(ddmm).join(', ') : undefined);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard label="Ausencias" value={r.ausentes.length} tone={r.ausentes.length ? 'red' : 'green'} detail={lista(r.ausentes) ?? `Sin ausencias en ${r.laborables} día(s) laborable(s).`} />
      <StatCard
        label="Llegadas tarde"
        value={r.tardes.length}
        tone={r.tardes.some((t) => t.grave) ? 'orange' : r.tardes.length ? 'violet' : 'green'}
        detail={
          r.tardes.length
            ? `${r.tardes.filter((t) => t.grave).length} grave(s) · ${fmtHorasMin(r.minutosTarde)} de atraso acumulado`
            : 'Siempre dentro de la tolerancia.'
        }
      />
      <StatCard label={hoyEnMes ? 'Horas trabajadas (hasta hoy)' : 'Horas trabajadas'} value={fmtHorasMin(r.minutosTrabajados)} tone={pct >= 95 ? 'green' : pct >= 80 ? 'orange' : 'red'}>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full', pct >= 95 ? 'bg-emerald-500' : pct >= 80 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">
          {pct}% de {fmtHorasMin(esperadas)} esperadas{hoyEnMes ? ` · ${fmtHorasMin(r.minutosEsperadosMes)} en el mes` : ''}
          {r.diasComputados < r.laborables + r.trabajoNoLaborable.length ? ` · ${r.diasComputados} día(s) con entrada y salida` : ''}
        </p>
      </StatCard>
      <StatCard
        label="No computable"
        value={r.sinSalida.length}
        tone={r.sinSalida.length ? 'orange' : undefined}
        detail={
          r.sinSalida.length
            ? `Sin marca de salida: ${lista(r.sinSalida)}. Esas horas no se cuentan.`
            : r.trabajoNoLaborable.length
              ? `Trabajó en día no laborable: ${lista(r.trabajoNoLaborable)}.`
              : 'Todos los días con entrada tienen salida.'
        }
      />
      <StatCard
        label="Horas extra (control)"
        value={r.horasExtra50 + r.horasExtra100 ? `${r.horasExtra50 + r.horasExtra100} h` : '0 h'}
        tone={r.horasExtra50 + r.horasExtra100 ? 'violet' : undefined}
        detail={
          r.diasConExtra.length
            ? `${r.horasExtra50} h al 50 % · ${r.horasExtra100} h al 100 % · ${r.diasConExtra.length} día(s). Solo salida tardía, horas enteras; para contrastar con el Excel del área.`
            : 'Sin salidas tardías de una hora o más.'
        }
      />
      {r.sinSalida.length > 0 && r.trabajoNoLaborable.length > 0 && (
        <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-5">Trabajó en día no laborable: {lista(r.trabajoNoLaborable)}.</p>
      )}
    </div>
  );
}

/** Día por día, sin los que no aportan nada (futuro, no laborable sin marcas). */
function Detalle({ celdas, dias }: { celdas: CeldaDia[]; dias: PerfilPersona['dias'] }) {
  const filas = celdas
    .map((c, i) => ({ c, d: dias[i] }))
    .filter(({ c }) => c.estado !== 'futuro' && !(c.estado === 'no_laborable' && c.marcas === 0) && !(c.estado === 'sin_horario' && c.marcas === 0));
  if (filas.length === 0) return <p className="text-sm text-muted-foreground">Sin días para mostrar en este mes.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Día</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Horario</TableHead>
            <TableHead>Entrada</TableHead>
            <TableHead>Salida</TableHead>
            <TableHead className="text-right">Horas</TableHead>
            <TableHead className="text-right">Tarde</TableHead>
            <TableHead className="text-right">Extra</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map(({ c, d }) => (
            <TableRow key={c.fecha} className={cn(d.finDeSemana && 'bg-muted/30')}>
              <TableCell className="whitespace-nowrap text-sm tabular-nums">
                <span className="mr-1.5 text-muted-foreground">{DIAS_SEMANA_CORTO[d.diaSemana]}</span>{ddmm(c.fecha)}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={cn('font-normal', TONO[c.estado])}>{ESTADOS_DIA[c.estado].label}</Badge>
                {c.sinSalida && <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-400">sin salida</span>}
              </TableCell>
              <TableCell className="text-sm tabular-nums text-muted-foreground">{c.jornada ? `${c.jornada.entrada}–${c.jornada.salida}` : '—'}</TableCell>
              <TableCell className="text-sm tabular-nums">
                {c.entrada ? fmtHoraCorta(c.entrada) : '—'}
                {c.entradaInferida && <span className="ml-1 text-xs text-amber-600 dark:text-amber-400" title="No hubo marca de tipo Entrada">*</span>}
              </TableCell>
              <TableCell className="text-sm tabular-nums">{c.salida ? fmtHoraCorta(c.salida) : '—'}</TableCell>
              <TableCell className="text-right text-sm tabular-nums">{c.minutosTrabajados != null ? fmtHorasMin(c.minutosTrabajados) : '—'}</TableCell>
              <TableCell className={cn('text-right text-sm tabular-nums', c.minutosTarde ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
                {c.minutosTarde ? `${c.minutosTarde} min` : '—'}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {c.extra && (c.extra.horas50 || c.extra.horas100) ? (
                  <span className="text-violet-700 dark:text-violet-400" title={`${c.extra.minutos50 + c.extra.minutos100} min de exceso`}>
                    {c.extra.horas50 ? `${c.extra.horas50} h 50 %` : ''}{c.extra.horas50 && c.extra.horas100 ? ' + ' : ''}{c.extra.horas100 ? `${c.extra.horas100} h 100 %` : ''}
                  </span>
                ) : c.extra && c.extra.minutos50 + c.extra.minutos100 > 0 ? (
                  <span className="text-muted-foreground" title="Menos de una hora completa: no cuenta">{c.extra.minutos50 + c.extra.minutos100} min</span>
                ) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
