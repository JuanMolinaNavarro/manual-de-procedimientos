'use client';

/**
 * Piezas del perfil de asistencia de una persona, compartidas entre el perfil
 * que ve quien liquida (`PerfilPersonaPage`) y la vista personal
 * (`MiAsistenciaPage`): foto, tarjeta del horario vigente con historial,
 * resumen del mes en tarjetas y detalle día por día. Ninguna usa el contexto
 * del módulo: reciben todo por props.
 */

import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard } from '@/components/comunes/ui';
import { fotoUrl, iniciales } from '@/components/organigrama/foto';
import { cn } from '@/lib/utils';
import { fmtFechaDia, fmtHoraCorta } from '@/lib/asistencia-datos';
import {
  CICLO_LABELS,
  DIAS_SEMANA,
  DIAS_SEMANA_CORTO,
  DIAS_SEMANA_LARGO,
  ESTADOS_DIA,
  describirHorario,
  fmtHorasMin,
  ultimaVersion,
  type CeldaDia,
  type DiaCalendario,
  type EstadoDia,
  type HorarioVersion,
  type ResumenLiquidacion,
} from '@/lib/asistencia-calendario';

export const TONO: Partial<Record<EstadoDia, string>> = {
  a_horario: 'border-emerald-500/50 text-emerald-700 dark:text-emerald-400',
  tarde: 'border-amber-500/60 text-amber-700 dark:text-amber-400',
  tarde_grave: 'border-orange-600/70 text-orange-700 dark:text-orange-400',
  ausente: 'border-red-500/60 text-red-700 dark:text-red-400',
  trabajo_no_laborable: 'border-sky-500/60 text-sky-700 dark:text-sky-400',
  feriado: 'border-violet-500/50 text-violet-700 dark:text-violet-400',
};

export const ddmm = (f: string) => fmtFechaDia(f).slice(0, 5);

export function Foto({ nombre, emp }: { nombre: string | null; emp?: { id: number; foto_archivo: string | null } }) {
  const url = emp ? fotoUrl(emp) : null;
  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-semibold text-muted-foreground">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : nombre ? iniciales(nombre) : ''}
    </div>
  );
}

/**
 * Horario vigente de la ficha. A propósito NO muestra la tolerancia (parámetro
 * interno de RRHH, se ve solo en el editor) ni el historial de versiones: en
 * el perfil y en Mi asistencia interesa el horario de hoy, nada más.
 */
export function HorarioCard({ versiones, vigente, hoy, vinculada, cargando }: { versiones: HorarioVersion[]; vigente: HorarioVersion | null; hoy: string; vinculada: boolean; cargando: boolean }) {
  const ultima = ultimaVersion(versiones);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="inline-flex items-center gap-2 text-base"><Clock className="h-4 w-4" /> Horario</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {cargando ? (
          <Skeleton className="h-16 w-full" />
        ) : !vinculada ? (
          <p className="text-sm text-muted-foreground">Sin ficha vinculada: el horario se carga sobre la ficha del organigrama.</p>
        ) : !vigente ? (
          <p className="text-sm text-muted-foreground">
            {versiones.length === 0
              ? 'Todavía no tiene horario cargado.'
              : ultima && ultima.vigenteDesde > hoy
                ? `Sin horario vigente hoy; hay uno que empieza el ${fmtFechaDia(ultima.vigenteDesde)}.`
                : 'Sin horario vigente hoy.'}
          </p>
        ) : !vigente.incluir ? (
          <p className="text-sm text-muted-foreground">No incluido en el control desde el {fmtFechaDia(vigente.vigenteDesde)}.</p>
        ) : (
          <>
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
                      d ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-dashed border-border text-muted-foreground opacity-60',
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
                        {parcial && <span className="text-[9px] text-muted-foreground">S{d.semanas.map((n) => n + 1).join('/')}</span>}
                      </>
                    ) : (
                      <span className="text-[10px]">—</span>
                    )}
                  </div>
                );
              })}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              {vigente.cicloSemanas > 1 && (
                <>
                  <dt className="text-muted-foreground">Ciclo</dt>
                  <dd>{CICLO_LABELS[vigente.cicloSemanas]} · semana 1 desde el {fmtFechaDia(vigente.cicloAncla)}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Vigente</dt>
              <dd>desde el {fmtFechaDia(vigente.vigenteDesde)}{vigente.vigenteHasta ? ` hasta el ${fmtFechaDia(vigente.vigenteHasta)}` : ''}</dd>
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function Resumen({ r, hoyEnMes }: { r: ResumenLiquidacion; hoyEnMes: boolean }) {
  const esperadas = hoyEnMes ? r.minutosEsperadosHastaHoy : r.minutosEsperadosMes;
  const pct = esperadas > 0 ? Math.min(100, Math.round((r.minutosTrabajados / esperadas) * 100)) : 0;
  const lista = (fechas: string[]) => (fechas.length ? fechas.map(ddmm).join(', ') : undefined);
  const extraTotal = r.horasExtra50 + r.horasExtra100;
  return (
    // Tres columnas (dos filas) quedan a la altura de Horario + Reloj al costado.
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        label="Ausencias"
        value={r.ausentes.length}
        tone={r.ausentes.length ? 'red' : 'green'}
        detail={(lista(r.ausentes) ?? `Sin ausencias en ${r.laborables} día(s) laborable(s).`) + (r.feriados.length ? ` Feriado(s) detectado(s): ${lista(r.feriados)}.` : '')}
      />
      <StatCard
        label="Llegadas tarde"
        value={r.tardes.length}
        tone={r.tardes.some((t) => t.grave) ? 'orange' : r.tardes.length ? 'violet' : 'green'}
        detail={r.tardes.length ? `${r.tardes.filter((t) => t.grave).length} graves` : 'Sin llegadas tarde.'}
      />
      <StatCard label={hoyEnMes ? 'Horas trabajadas' : 'Horas trabajadas'} value={fmtHorasMin(r.minutosTrabajados)} tone={pct >= 95 ? 'green' : pct >= 80 ? 'orange' : 'red'}>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full', pct >= 95 ? 'bg-emerald-500' : pct >= 80 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">
          {pct}% de {fmtHorasMin(esperadas)} esperadas{hoyEnMes}
          {r.diasComputados < r.laborables + r.trabajoNoLaborable.length ? ` · ${r.diasComputados} día(s) con entrada y salida` : ''}
        </p>
      </StatCard>
      <StatCard
        label="Horas extra"
        value={`${extraTotal} h`}
        tone={extraTotal ? 'violet' : undefined}
        detail={
          (r.diasConExtra.length
            ? `${r.horasExtra50} h al 50 % · ${r.horasExtra100} h al 100 % · ${r.diasConExtra.length} día(s).`
            : 'Sin salidas tardías netas de una hora o más.')
        }
      />
      <StatCard
        label="Sin marca de salida"
        value={r.sinSalida.length}
        tone={r.sinSalida.length ? 'orange' : undefined}
      />
      <StatCard
        label="Días no laborables trabajados"
        value={r.trabajoNoLaborable.length}
        tone={r.trabajoNoLaborable.length ? 'violet' : undefined}
        detail={lista(r.trabajoNoLaborable) ?? 'Ninguno.'}
      />
    </div>
  );
}

/** Día por día, sin los que no aportan nada (futuro, no laborable sin marcas). */
/** Minutos después de la hora de salida (bruto: incluye lo que compensó la llegada tarde). Null sin marca de salida. */
const extraBruto = (c: CeldaDia): number | null => (c.extra ? c.extra.compensado + c.extra.minutos50 + c.extra.minutos100 : null);

const fmtMin = (min: number) => (min >= 60 ? fmtHorasMin(min) : `${min} min`);

/** Diferencia con signo y color: positiva = se quedó más de lo que llegó tarde. */
function DiferenciaTexto({ extra, tarde, className }: { extra: number; tarde: number; className?: string }) {
  const diff = extra - tarde;
  return (
    <span
      title={`${fmtMin(extra)} después de la salida − ${fmtMin(tarde)} de llegada tarde`}
      className={cn(diff > 0 ? 'text-emerald-700 dark:text-emerald-400' : diff < 0 ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground', className)}
    >
      {diff > 0 ? '+' : diff < 0 ? '−' : ''}{fmtMin(Math.abs(diff))}
    </span>
  );
}

/**
 * Diferencia del día: tiempo después de la hora de salida menos minutos de
 * llegada tarde. Sin marca de salida no se sabe cuánto se quedó, así que no se
 * calcula (y ese día tampoco entra en el total).
 */
function Diferencia({ celda: c }: { celda: CeldaDia }) {
  const extra = extraBruto(c);
  const tarde = c.minutosTarde ?? 0;
  if (extra == null || (extra === 0 && tarde === 0)) return <span className="text-muted-foreground">—</span>;
  return <DiferenciaTexto extra={extra} tarde={tarde} />;
}

/**
 * Día por día. En la columna Extra, con horas enteras va el desglose 50/100;
 * si no, el tiempo que la persona se quedó después de su hora de salida
 * (aunque solo haya compensado la llegada tarde: el "compensa X min" no se
 * muestra, es lectura interna del cálculo).
 */
export function Detalle({ celdas, dias, conTotal = false }: { celdas: CeldaDia[]; dias: DiaCalendario[]; /** Fila Total al pie (solo en el perfil de RRHH). */ conTotal?: boolean }) {
  const filas = celdas
    .map((c, i) => ({ c, d: dias[i] }))
    .filter(({ c }) => c.estado !== 'futuro' && !(c.estado === 'no_laborable' && c.marcas === 0) && !(c.estado === 'sin_horario' && c.marcas === 0));
  // Los feriados detectados se muestran aunque no haya marcas: explican por qué no hay ausencia.
  if (filas.length === 0) return <p className="text-sm text-muted-foreground">Sin días para mostrar en este mes.</p>;
  // Totales del mes: horas trabajadas (días con las dos marcas), llegada tarde,
  // tiempo después de la salida y su diferencia (solo días con salida, como la celda).
  const tot = filas.reduce(
    (t, { c }) => {
      t.horas += c.minutosTrabajados ?? 0;
      t.tarde += c.minutosTarde ?? 0;
      const e = extraBruto(c);
      if (e != null) { t.extra += e; t.tardeConSalida += c.minutosTarde ?? 0; }
      return t;
    },
    { horas: 0, tarde: 0, extra: 0, tardeConSalida: 0 },
  );
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
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
            <TableHead className="text-right">Diferencia</TableHead>
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
                ) : c.extra && c.extra.compensado + c.extra.minutos50 + c.extra.minutos100 > 0 ? (
                  <span className="text-muted-foreground" title="Tiempo después de la hora de salida">{c.extra.compensado + c.extra.minutos50 + c.extra.minutos100} min</span>
                ) : '—'}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                <Diferencia celda={c} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        {conTotal && (
        <TableFooter>
          <TableRow className="font-semibold">
            <TableCell colSpan={5}>Total</TableCell>
            <TableCell className="text-right text-sm tabular-nums">{tot.horas ? fmtHorasMin(tot.horas) : '—'}</TableCell>
            <TableCell className={cn('text-right text-sm tabular-nums', tot.tarde ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>{tot.tarde ? fmtMin(tot.tarde) : '—'}</TableCell>
            <TableCell className="text-right text-sm tabular-nums" title="Tiempo total después de la hora de salida">{tot.extra ? fmtMin(tot.extra) : '—'}</TableCell>
            <TableCell className="text-right text-sm tabular-nums">
              {tot.extra || tot.tardeConSalida ? <DiferenciaTexto extra={tot.extra} tarde={tot.tardeConSalida} /> : <span className="text-muted-foreground">—</span>}
            </TableCell>
          </TableRow>
        </TableFooter>
        )}
      </Table>
    </div>
  );
}
