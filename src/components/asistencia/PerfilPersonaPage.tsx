'use client';

/**
 * Perfil de una persona del reloj (`/admin/asistencia/personas/[id]`): la ficha
 * vista desde la liquidación de sueldos. Foto y datos de la ficha, legajo del
 * reloj, horario vigente con su historial, y el mes elegido con ausencias,
 * llegadas tarde, horas trabajadas contra esperadas, horas extra de control y
 * el detalle día por día. Todo sale del mismo `evaluarDia` del calendario.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Clock, History, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Banner, Empty, StatCard } from '@/components/comunes/ui';
import { fotoUrl, iniciales } from '@/components/organigrama/foto';
import { cn } from '@/lib/utils';
import { fmtFechaDia, fmtFechaHora, fmtHoraCorta, fmtRelativo, hoyLocal } from '@/lib/asistencia-datos';
import {
  CICLO_LABELS,
  DIAS_SEMANA,
  DIAS_SEMANA_CORTO,
  DIAS_SEMANA_LARGO,
  ESTADOS_DIA,
  describirHorario,
  fmtHorasMin,
  fmtMes,
  mesAnterior,
  mesSiguiente,
  ultimaVersion,
  versionVigente,
  type CeldaDia,
  type EstadoDia,
  type HorarioVersion,
} from '@/lib/asistencia-calendario';
import type { PerfilPersona, Persona } from './api';
import { useAsistencia, useAsistenciaData } from './AsistenciaContext';
import HorarioDialog from './HorarioDialog';

const TONO: Partial<Record<EstadoDia, string>> = {
  a_horario: 'border-emerald-500/50 text-emerald-700 dark:text-emerald-400',
  tarde: 'border-amber-500/60 text-amber-700 dark:text-amber-400',
  tarde_grave: 'border-orange-600/70 text-orange-700 dark:text-orange-400',
  ausente: 'border-red-500/60 text-red-700 dark:text-red-400',
  trabajo_no_laborable: 'border-sky-500/60 text-sky-700 dark:text-sky-400',
};

const ddmm = (f: string) => fmtFechaDia(f).slice(0, 5);

export default function PerfilPersonaPage({ personaId }: { personaId: number }) {
  const { f, set, personas, personasError, empleadoPorId, horariosPorEmpleado } = useAsistencia();
  const router = useRouter();
  const [hoy] = useState(() => hoyLocal());
  const [editando, setEditando] = useState(false);
  const mes = f.mes;

  const persona = personas?.find((p) => p.id === personaId) ?? null;
  const emp = persona?.empleadoId != null ? empleadoPorId.get(persona.empleadoId) : undefined;
  const { data, error, loading } = useAsistenciaData<PerfilPersona>(`/api/admin/asistencia/personas/${personaId}/perfil?mes=${mes}`);
  const versiones = data?.versiones ?? (persona?.empleadoId != null ? horariosPorEmpleado.get(persona.empleadoId) ?? [] : []);
  const vigente = versionVigente(versiones, hoy);
  const r = data?.resumen ?? null;
  const sinHorario = !!data && !data.fila?.tieneHorario;

  if (personasError) return <Banner variant="warn">{personasError}</Banner>;
  if (personas && !persona) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <Volver />
        <Empty title="Persona no encontrada">Puede que se haya borrado o que el enlace esté mal.</Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <Volver />

      {/* Cabecera: foto, ficha y acciones */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-5 p-5">
          <Foto persona={persona} emp={emp} />
          <div className="min-w-0 flex-1 space-y-1">
            {persona ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold text-foreground">{persona.nombre}</h2>
                  {!persona.activa && <Badge variant="secondary">inactiva</Badge>}
                  {!persona.empleado && <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">sin vincular</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {persona.empleado ? `${persona.empleado.rol} · ${persona.empleado.area}` : 'Sin ficha del organigrama: no tiene horario y solo se ven sus marcas.'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {vigente ? (
                    <>Horario: <span className="font-medium text-foreground">{describirHorario(vigente)}</span>{vigente.toleranciaMin != null ? ` · tolerancia ${vigente.toleranciaMin} min` : ''}</>
                  ) : persona.empleado ? (
                    <span className="text-amber-600 dark:text-amber-400">Sin horario vigente.</span>
                  ) : null}
                </p>
              </>
            ) : (
              <>
                <Skeleton className="h-7 w-64" />
                <Skeleton className="h-4 w-48" />
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {persona?.empleado && (
              <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
                <CalendarClock className="h-4 w-4" /> Editar horario
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => router.push(`/admin/asistencia?tab=calendario&mes=${mes}`)}>
              <CalendarDays className="h-4 w-4" /> Calendario
            </Button>
            {persona && (
              <Button variant="outline" size="sm" onClick={() => router.push(`/admin/asistencia?tab=fichadas&persona=${encodeURIComponent(persona.userId)}`)}>
                <ListChecks className="h-4 w-4" /> Fichadas
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Mes */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Mes anterior" onClick={() => set({ mes: mesAnterior(mes) })}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-40 text-center text-base font-semibold">{fmtMes(mes)}</span>
            <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Mes siguiente" onClick={() => set({ mes: mesSiguiente(mes) })}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {mes !== hoy.slice(0, 7) && (
              <Button variant="ghost" size="sm" className="h-9" onClick={() => set({ mes: hoy.slice(0, 7) })}>Hoy</Button>
            )}
          </div>

          {error && <Banner variant="warn">{error}</Banner>}

          {!data ? (
            loading ? <Skeleton className="h-80 w-full" /> : null
          ) : (
            <div className={cn('space-y-4', loading && 'opacity-60')}>
              {sinHorario ? (
                <Banner variant="info">
                  Sin horario vigente en {fmtMes(mes).toLowerCase()}: no se calculan ausencias, tardanzas ni horas esperadas.
                  {persona?.empleado ? ' Cargalo con «Editar horario».' : ' Vinculá la ficha del organigrama desde Personas y cargale un horario.'}
                </Banner>
              ) : (
                r && <Resumen r={r} hoyEnMes={data.hoy >= data.desde && data.hoy <= data.hasta} />
              )}
              <Detalle celdas={data.fila?.celdas ?? []} dias={data.dias} />
            </div>
          )}
        </div>

        {/* Lateral: horario y reloj */}
        <div className="space-y-4">
          <HorarioCard versiones={versiones} vigente={vigente} hoy={hoy} vinculada={!!persona?.empleado} cargando={!persona} />
          <RelojCard persona={persona} empNombre={emp?.nombre ?? persona?.empleado?.nombre ?? null} />
        </div>
      </div>

      {persona?.empleado && editando && (
        <HorarioDialog
          empleado={{ id: persona.empleado.id, nombre: persona.empleado.nombre }}
          versiones={versiones}
          open
          onOpenChange={(o) => { if (!o) setEditando(false); }}
        />
      )}
    </div>
  );
}

function Volver() {
  return (
    <Link href="/admin/asistencia?tab=personas" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> Personas
    </Link>
  );
}

function Foto({ persona, emp }: { persona: Persona | null; emp?: { id: number; foto_archivo: string | null } }) {
  const url = emp ? fotoUrl(emp) : null;
  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-semibold text-muted-foreground">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : persona ? iniciales(persona.nombre) : ''}
    </div>
  );
}

function HorarioCard({ versiones, vigente, hoy, vinculada, cargando }: { versiones: HorarioVersion[]; vigente: HorarioVersion | null; hoy: string; vinculada: boolean; cargando: boolean }) {
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
                return (
                  <div
                    key={ds}
                    title={d ? `${DIAS_SEMANA_LARGO[ds]} ${d.entrada}–${d.salida}${parcial ? ` (semanas ${d.semanas.map((n) => n + 1).join(', ')})` : ''}` : `${DIAS_SEMANA_LARGO[ds]}: no laborable`}
                    className={cn(
                      'flex flex-col items-center rounded-md border px-0.5 py-1.5 text-center',
                      d ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-dashed border-border text-muted-foreground opacity-60',
                    )}
                  >
                    <span className="text-xs font-bold">{DIAS_SEMANA_CORTO[ds]}</span>
                    {d ? (
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
              <dt className="text-muted-foreground">Tolerancia</dt>
              <dd>{vigente.toleranciaMin != null ? `${vigente.toleranciaMin} min (propia)` : 'general'}</dd>
              <dt className="text-muted-foreground">Vigente</dt>
              <dd>desde el {fmtFechaDia(vigente.vigenteDesde)}{vigente.vigenteHasta ? ` hasta el ${fmtFechaDia(vigente.vigenteHasta)}` : ''}</dd>
            </dl>
          </>
        )}

        {versiones.length > 1 && (
          <div className="border-t border-border pt-3">
            <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><History className="h-3.5 w-3.5" /> Historial</p>
            <ul className="space-y-1 text-xs">
              {versiones.map((v) => (
                <li key={v.id} className={cn(v.id === vigente?.id ? 'text-foreground' : 'text-muted-foreground')}>
                  <span className="tabular-nums">{fmtFechaDia(v.vigenteDesde)} → {v.vigenteHasta ? fmtFechaDia(v.vigenteHasta) : 'abierta'}</span>: {describirHorario(v)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RelojCard({ persona, empNombre }: { persona: Persona | null; empNombre: string | null }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Reloj</CardTitle>
      </CardHeader>
      <CardContent>
        {!persona ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Legajo</dt>
            <dd className="tabular-nums">{persona.userId}</dd>
            <dt className="text-muted-foreground">Nombre en el reloj</dt>
            <dd>{persona.nombreReloj || '—'}</dd>
            <dt className="text-muted-foreground">Última fichada</dt>
            <dd title={persona.ultimaFichada ? fmtFechaHora(persona.ultimaFichada) : undefined}>{persona.ultimaFichada ? fmtRelativo(persona.ultimaFichada) : 'nunca'}</dd>
            <dt className="text-muted-foreground">Ficha</dt>
            <dd>{empNombre ?? <span className="text-amber-600 dark:text-amber-400">sin vincular</span>}</dd>
            <dt className="text-muted-foreground">Estado</dt>
            <dd>{persona.activa ? 'activa' : 'inactiva'}</dd>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function Resumen({ r, hoyEnMes }: { r: NonNullable<PerfilPersona['resumen']>; hoyEnMes: boolean }) {
  const esperadas = hoyEnMes ? r.minutosEsperadosHastaHoy : r.minutosEsperadosMes;
  const pct = esperadas > 0 ? Math.min(100, Math.round((r.minutosTrabajados / esperadas) * 100)) : 0;
  const lista = (fechas: string[]) => (fechas.length ? fechas.map(ddmm).join(', ') : undefined);
  const extraTotal = r.horasExtra50 + r.horasExtra100;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard label="Ausencias" value={r.ausentes.length} tone={r.ausentes.length ? 'red' : 'green'} detail={lista(r.ausentes) ?? `Sin ausencias en ${r.laborables} día(s) laborable(s).`} />
      <StatCard
        label="Llegadas tarde"
        value={r.tardes.length}
        tone={r.tardes.some((t) => t.grave) ? 'orange' : r.tardes.length ? 'violet' : 'green'}
        detail={r.tardes.length ? `${r.tardes.filter((t) => t.grave).length} grave(s) · ${fmtHorasMin(r.minutosTarde)} de atraso acumulado` : 'Siempre dentro de la tolerancia.'}
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
        label="Horas extra (control)"
        value={`${extraTotal} h`}
        tone={extraTotal ? 'violet' : undefined}
        detail={
          r.diasConExtra.length
            ? `${r.horasExtra50} h al 50 % · ${r.horasExtra100} h al 100 % · ${r.diasConExtra.length} día(s). Solo salida tardía y horas enteras; para contrastar con el Excel del área.`
            : 'Sin salidas tardías de una hora o más.'
        }
      />
      <StatCard
        label="Sin marca de salida"
        value={r.sinSalida.length}
        tone={r.sinSalida.length ? 'orange' : undefined}
        detail={r.sinSalida.length ? `${lista(r.sinSalida)}. Esas horas no se cuentan.` : 'Todos los días con entrada tienen salida.'}
      />
      <StatCard
        label="Día no laborable trabajado"
        value={r.trabajoNoLaborable.length}
        tone={r.trabajoNoLaborable.length ? 'violet' : undefined}
        detail={lista(r.trabajoNoLaborable) ?? 'Ninguno.'}
      />
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
