'use client';

/**
 * Calendario mensual: una fila por persona, una celda por día con el estado
 * derivado (a horario / tarde / tarde grave / ausente / …). Grilla a mano
 * (como `ActividadPorDia` del Resumen): no hay librería de calendario en el
 * repo y las fechas son strings yyyy-mm-dd.
 */

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Search, Settings2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Banner, Empty, EmpleadoCell } from '@/components/comunes/ui';
import { cn } from '@/lib/utils';
import { fmtFechaDia, fmtHoraCorta, tipoMarcaLabel } from '@/lib/asistencia-datos';
import { DIAS_SEMANA_CORTO, ESTADOS_DIA, fmtMes, mesAnterior, mesSiguiente, validarConfigInput, type EstadoDia } from '@/lib/asistencia-calendario';
import { asistFetch, mensajeError, type CalendarioMes, type CeldaDia, type ConfigAsistencia, type FichadaDetalle, type FilaCalendarioMes } from './api';
import { useAsistencia, useAsistenciaData } from './AsistenciaContext';
import { Campo, Chip, LinkPerfil } from './piezas';

/** Color + marcador de texto por estado (el color solo no alcanza para leerlo). */
const ESTILO: Record<EstadoDia, { celda: string; marca?: string }> = {
  futuro: { celda: 'bg-transparent' },
  pendiente: { celda: 'bg-muted/60 text-muted-foreground', marca: '·' },
  sin_horario: { celda: 'border border-dashed border-border bg-transparent text-muted-foreground' },
  no_laborable: { celda: 'bg-muted/50' },
  trabajo_no_laborable: { celda: 'bg-sky-400/70 text-sky-950 dark:bg-sky-500/60 dark:text-sky-50', marca: '+' },
  a_horario: { celda: 'bg-emerald-500/70 dark:bg-emerald-500/60' },
  tarde: { celda: 'bg-amber-400/80 text-amber-950 dark:bg-amber-500/70 dark:text-amber-50', marca: 'T' },
  tarde_grave: { celda: 'bg-orange-600/85 text-white dark:bg-orange-500/80', marca: '!' },
  ausente: { celda: 'bg-red-500/65 text-white dark:bg-red-500/60', marca: 'A' },
  feriado: { celda: 'bg-violet-500/25 text-violet-800 dark:bg-violet-500/30 dark:text-violet-200', marca: 'F' },
};

const LEYENDA: EstadoDia[] = ['a_horario', 'tarde', 'tarde_grave', 'ausente', 'trabajo_no_laborable', 'no_laborable', 'feriado', 'sin_horario', 'pendiente'];

export default function CalendarioTab() {
  const { f, set } = useAsistencia();
  const [q, setQ] = useState('');
  const url = `/api/admin/asistencia/calendario?mes=${f.mes}${f.sinHorario ? '&sinHorario=1' : ''}`;
  const { data, error, loading } = useAsistenciaData<CalendarioMes>(url);

  const filas = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.filas ?? []).filter((r) => !needle || r.nombre.toLowerCase().includes(needle) || (r.area ?? '').toLowerCase().includes(needle));
  }, [data, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Mes anterior" onClick={() => set({ mes: mesAnterior(f.mes) })}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-40 text-center text-sm font-semibold">{fmtMes(f.mes)}</span>
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Mes siguiente" onClick={() => set({ mes: mesSiguiente(f.mes) })}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {data && f.mes !== data.hoy.slice(0, 7) && (
            <Button variant="ghost" size="sm" className="h-9" onClick={() => set({ mes: data.hoy.slice(0, 7) })}>Hoy</Button>
          )}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} placeholder="Buscar por nombre o área" onChange={(e) => setQ(e.target.value)} className="h-9 w-56 pl-8 pr-8" />
          {q && (
            <button type="button" aria-label="Limpiar búsqueda" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Chip activo={f.sinHorario} onClick={() => set({ sinHorario: !f.sinHorario })}>
          {f.sinHorario ? 'Ocultar sin horario' : `Mostrar sin horario${data ? ` (${data.sinHorario})` : ''}`}
        </Chip>

        <div className="ml-auto">
          {data && <ConfigDialog config={data.config} />}
        </div>
      </div>

      {error && <Banner variant="warn">{error}</Banner>}
      {data?.truncado && (
        <Banner variant="locked">Hay más fichadas de las que se pueden agrupar en un mes; algunos días pueden verse incompletos.</Banner>
      )}

      {!data ? (
        loading ? <Skeleton className="h-96 w-full" /> : null
      ) : filas.length === 0 ? (
        <Empty title={q ? `Nadie coincide con «${q}»` : 'Nadie tiene horario cargado'}>
          {q ? 'Probá con otro nombre o área.' : 'Cargá el horario de cada persona desde la pestaña Personas (botón «Horario»). Podés ver a quienes no tienen horario con «Mostrar sin horario».'}
        </Empty>
      ) : (
        <div className={cn('space-y-3', loading && 'opacity-60')}>
          <Grilla data={data} filas={filas} />
          <Leyenda />
        </div>
      )}
    </div>
  );
}

function Grilla({ data, filas }: { data: CalendarioMes; filas: FilaCalendarioMes[] }) {
  const cols = `240px repeat(${data.dias.length}, 28px)`;
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <div className="min-w-max" style={{ display: 'grid', gridTemplateColumns: cols }}>
        {/* Cabecera */}
        <div className="sticky left-0 z-20 border-b border-border bg-card px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Persona</div>
        {data.dias.map((d) => (
          <div
            key={d.fecha}
            className={cn('flex flex-col items-center justify-end border-b border-border py-1 text-[11px] tabular-nums', d.finDeSemana ? 'bg-muted/40 text-muted-foreground' : 'text-foreground', d.feriado && 'bg-violet-500/15 text-violet-700 dark:text-violet-300', d.esHoy && 'bg-primary/10 font-bold')}
            title={d.feriado ? `${fmtFechaDia(d.fecha)} · feriado detectado (fichó menos del 20 %)` : fmtFechaDia(d.fecha)}
          >
            <span className="text-[10px] text-muted-foreground">{DIAS_SEMANA_CORTO[d.diaSemana]}</span>
            <span>{d.dia}</span>
          </div>
        ))}

        {/* Filas */}
        {filas.map((r) => (
          <Fila key={r.clave} fila={r} data={data} />
        ))}
      </div>
    </div>
  );
}

function Fila({ fila, data }: { fila: FilaCalendarioMes; data: CalendarioMes }) {
  const { personaPorUserId } = useAsistencia();
  // El perfil es por persona del reloj; un empleado sin legajo no tiene.
  const personaId = fila.userIds.length ? personaPorUserId.get(fila.userIds[0])?.id ?? null : null;
  const t = fila.totales;
  // Los totales no van en una columna: quedan como tooltip de la persona.
  const detalle = fila.tieneHorario
    ? `${t.laborables} laborables · ${t.aHorario} a horario · ${t.tarde} tarde · ${t.tardeGrave} tarde grave · ${t.ausente} ausente · ${t.trabajoNoLaborable} en día no laborable · ${t.sinSalida} sin salida · ${t.minutosTarde} min de atraso`
    : 'Sin horario: solo se muestran los días con marcas';
  return (
    <>
      <div className="sticky left-0 z-10 border-b border-border bg-card px-3 py-1.5" title={detalle}>
        <LinkPerfil personaId={personaId} nombre={fila.nombre}>
        <EmpleadoCell
          empleado={{ id: fila.empleadoId ?? -1, nombre: fila.nombre, foto_archivo: fila.fotoArchivo }}
          sub={
            <span className="flex items-center gap-1.5">
              {fila.area ?? 'sin vincular'}
              {!fila.tieneHorario && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">sin horario</Badge>}
              {fila.tieneHorario && fila.userIds.length === 0 && <Badge variant="outline" className="h-4 border-amber-500 px-1.5 text-[10px] text-amber-600 dark:text-amber-400">sin legajo</Badge>}
            </span>
          }
        />
        </LinkPerfil>
      </div>
      {fila.celdas.map((c, i) => (
        <div key={c.fecha} className={cn('flex items-center justify-center border-b border-border', (data.dias[i].finDeSemana || data.dias[i].feriado) && 'bg-muted/30', data.dias[i].esHoy && 'bg-primary/5')}>
          <Celda celda={c} fila={fila} />
        </div>
      ))}
    </>
  );
}

function Celda({ celda, fila }: { celda: CeldaDia; fila: FilaCalendarioMes }) {
  const [abierta, setAbierta] = useState(false);
  const e = ESTILO[celda.estado];
  const inerte = celda.estado === 'futuro' || ((celda.estado === 'sin_horario' || celda.estado === 'feriado') && celda.marcas === 0);
  // Día futuro con jornada: un contorno tenue muestra el plan (qué sábados le tocan).
  const futuroLaborable = celda.estado === 'futuro' && celda.jornada != null;
  const label = `${fmtFechaDia(celda.fecha)}: ${ESTADOS_DIA[celda.estado].label}${celda.jornada && celda.estado === 'futuro' ? ` (${celda.jornada.entrada}–${celda.jornada.salida})` : ''}${celda.minutosTarde ? `, ${celda.minutosTarde} min tarde` : ''}${celda.sinSalida ? ', sin salida' : ''}`;
  const boton = (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={inerte}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-[4px] text-[10px] font-bold leading-none transition-transform',
        e.celda,
        futuroLaborable && 'border border-border',
        celda.sinSalida && 'ring-2 ring-inset ring-foreground/60',
        !inerte && 'hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {celda.estado === 'sin_horario' && celda.marcas > 0 ? <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> : e.marca}
    </button>
  );
  if (inerte) return boton;
  return (
    <Popover open={abierta} onOpenChange={setAbierta}>
      <PopoverTrigger asChild>{boton}</PopoverTrigger>
      <PopoverContent align="center" className="w-80">
        {abierta && <DetalleCelda celda={celda} fila={fila} />}
      </PopoverContent>
    </Popover>
  );
}

function DetalleCelda({ celda, fila }: { celda: CeldaDia; fila: FilaCalendarioMes }) {
  const { set } = useAsistencia();
  // Sin legajo en el reloj no hay nada que pedir: arranca ya resuelto.
  const [marcas, setMarcas] = useState<FichadaDetalle[] | null>(() => (fila.userIds.length === 0 ? [] : null));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fila.userIds.length === 0) return;
    let vivo = true;
    Promise.all(
      fila.userIds.map((u) =>
        asistFetch<{ items: FichadaDetalle[] }>(`/api/admin/asistencia/fichadas?userId=${encodeURIComponent(u)}&desde=${celda.fecha}&hasta=${celda.fecha}&vista=detalle`).then((r) => r.items),
      ),
    )
      .then((r) => { if (vivo) setMarcas(r.flat().sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))); })
      .catch((e) => { if (vivo) setError(mensajeError(e)); });
    return () => { vivo = false; };
  }, [fila.userIds, celda.fecha]);

  const est = ESTADOS_DIA[celda.estado];
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{fmtFechaDia(celda.fecha)}</span>
        <Badge variant="secondary">{est.label}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{est.desc}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-muted-foreground">Horario</dt>
        <dd className="tabular-nums">{celda.jornada ? `${celda.jornada.entrada}–${celda.jornada.salida}` : celda.estado === 'sin_horario' ? 'sin horario' : 'no laborable'}</dd>
        <dt className="text-muted-foreground">Entrada</dt>
        <dd className="tabular-nums">{celda.entrada ? fmtHoraCorta(celda.entrada) : '—'}{celda.entradaInferida && <span className="ml-1 text-amber-600 dark:text-amber-400">(inferida)</span>}{celda.minutosTarde ? <span className="ml-1 text-muted-foreground">· {celda.minutosTarde} min tarde</span> : null}</dd>
        <dt className="text-muted-foreground">Salida</dt>
        <dd className="tabular-nums">{celda.salida ? fmtHoraCorta(celda.salida) : celda.sinSalida ? <span className="text-amber-600 dark:text-amber-400">sin marca</span> : '—'}</dd>
      </dl>
      <div className="border-t border-border pt-2">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fichadas ({celda.marcas})</p>
        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        ) : marcas == null ? (
          <p className="text-xs text-muted-foreground">Cargando…</p>
        ) : marcas.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ninguna.</p>
        ) : (
          <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs">
            {marcas.map((m) => (
              <li key={m.id} className="flex justify-between gap-2 tabular-nums">
                <span>{fmtHoraCorta(m.fechaHora)} · {tipoMarcaLabel(m.tipo)}</span>
                <span className="truncate text-muted-foreground">{m.reloj}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {fila.userIds.length > 0 && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => set({ tab: 'fichadas', userId: fila.userIds[0], desde: celda.fecha, hasta: celda.fecha, q: '' })}>
          Ver en Fichadas
        </Button>
      )}
    </div>
  );
}

function Leyenda() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-muted-foreground">
      {LEYENDA.map((e) => (
        <span key={e} className="inline-flex items-center gap-1.5">
          <span className={cn('inline-flex h-4 w-4 items-center justify-center rounded-[3px] text-[9px] font-bold', ESTILO[e].celda)}>{ESTILO[e].marca}</span>
          {ESTADOS_DIA[e].label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-4 w-4 rounded-[3px] bg-emerald-500/70 ring-2 ring-inset ring-foreground/60" />
        Sin fichaje de salida
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-4 w-4 rounded-[3px] border border-border" />
        Día laborable futuro
      </span>
    </div>
  );
}

/** Tolerancia general y umbral de "tarde grave". */
function ConfigDialog({ config }: { config: ConfigAsistencia }) {
  const { refrescar } = useAsistencia();
  const [abierto, setAbierto] = useState(false);
  const [tol, setTol] = useState(String(config.toleranciaMin));
  const [grave, setGrave] = useState(String(config.tardeGraveMin));
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) { setTol(String(config.toleranciaMin)); setGrave(String(config.tardeGraveMin)); }
  }, [abierto, config]);

  async function guardar() {
    let cfg: ConfigAsistencia;
    try {
      cfg = validarConfigInput({ toleranciaMin: Number(tol), tardeGraveMin: Number(grave) });
    } catch (e) {
      toast.error(mensajeError(e));
      return;
    }
    setGuardando(true);
    try {
      await asistFetch('/api/admin/asistencia/config', { method: 'PUT', body: JSON.stringify(cfg) });
      toast.success('Parámetros guardados.');
      refrescar();
      setAbierto(false);
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-9">
          <Settings2 className="h-4 w-4" /> Parámetros
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Parámetros del control</DialogTitle>
          <DialogDescription>
            La tolerancia se aplica a la hora de entrada; quien tiene tolerancia propia en su horario usa la suya.
            «Tarde grave» se mide desde la hora pactada, no desde el fin de la tolerancia.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-4">
          <Campo label="Tolerancia general (min)">
            <Input type="number" min={0} max={180} value={tol} onChange={(e) => setTol(e.target.value)} className="h-9 w-32" />
          </Campo>
          <Campo label="Tarde grave desde (min)">
            <Input type="number" min={1} max={600} value={grave} onChange={(e) => setGrave(e.target.value)} className="h-9 w-32" />
          </Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)} disabled={guardando}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
