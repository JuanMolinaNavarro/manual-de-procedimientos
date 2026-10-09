'use client';

/**
 * Perfil de una persona del reloj (`/admin/asistencia/personas/[id]`): su mes visto desde la
 * liquidación. Los cuatro números que importan (horas trabajadas, llegadas tarde y cuántas
 * compensó, horas extra, faltas) y el día por día; cada día se despliega con las marcas del reloj
 * y cómo se calculó, en palabras. Todo sale del mismo `evaluarDia` del calendario.
 */

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CalendarClock, Check, ChevronDown, Info, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Banner, Empty } from '@/components/comunes/ui';
import { cn } from '@/lib/utils';
import { fmtHoraCorta, hoyLocal, tipoMarcaLabel } from '@/lib/asistencia-datos';
import { DIAS_SEMANA_LARGO, describirHorario, fmtHorasMin, fmtMes, mesAnterior, mesSiguiente, versionVigente, type CeldaDia, type DiaCalendario } from '@/lib/asistencia-calendario';
import { compensada, explicarDia, fmtMinutos, horasExtraDia, plural, resumenMesPersona, tardanza, type ResumenMesPersona } from '@/lib/asistencia-tablero-calc';
import { asistFetch, mensajeError, type MarcaReloj, type PerfilPersona } from './api';
import EmpleadoPicker from './EmpleadoPicker';
import { useAsistencia, useAsistenciaData } from './AsistenciaContext';
import HorarioDialog from './HorarioDialog';
import { Foto } from './PerfilPiezas';
import { BarraHoras, Etiqueta, NavPeriodo } from './piezas';

export default function PerfilPersonaPage({ personaId }: { personaId: number }) {
  const { f, set, personas, personasError, empleados, empleadoPorId, horariosPorEmpleado, refrescar } = useAsistencia();
  const [vinculando, setVinculando] = useState(false);
  const [hoy] = useState(() => hoyLocal());
  const [editando, setEditando] = useState(false);
  const mes = f.mes;

  const persona = personas?.find((p) => p.id === personaId) ?? null;
  // Para vincular solo se ofrecen las fichas que ninguna persona del reloj tiene todavía.
  const empleadosLibres = useMemo(() => {
    const ocupados = new Set((personas ?? []).map((p) => p.empleadoId).filter((id): id is number => id != null));
    return empleados.filter((e) => !ocupados.has(e.id));
  }, [empleados, personas]);
  const emp = persona?.empleadoId != null ? empleadoPorId.get(persona.empleadoId) : undefined;
  const { data, error, loading } = useAsistenciaData<PerfilPersona>(`/api/admin/asistencia/personas/${personaId}/perfil?mes=${mes}`);
  const versiones = data?.versiones ?? (persona?.empleadoId != null ? horariosPorEmpleado.get(persona.empleadoId) ?? [] : []);
  const vigente = versionVigente(versiones, hoy);
  const resumen = data?.resumen ? resumenMesPersona(data.resumen, data.hoy >= data.desde && data.hoy <= data.hasta) : null;
  const sinHorario = !!data && !data.fila?.tieneHorario;

  async function vincular(empleadoId: number | null) {
    if (!persona) return;
    setVinculando(true);
    try {
      await asistFetch(`/api/admin/asistencia/personas/${persona.id}`, { method: 'PATCH', body: JSON.stringify({ empleadoId }) });
      const e = empleadoId != null ? empleadoPorId.get(empleadoId) : undefined;
      toast.success(e ? `${persona.userId} vinculada a ${e.nombre}.` : `${persona.userId} quedó sin vincular.`);
      refrescar();
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setVinculando(false);
    }
  }

  if (personasError) return <Banner variant="warn">{personasError}</Banner>;
  if (personas && !persona) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <Volver mes={mes} />
        <Empty title="Persona no encontrada">Puede que se haya borrado o que el enlace esté mal.</Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 text-base">
      <Volver mes={mes} />

      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          <Foto nombre={persona?.nombre ?? null} emp={emp} className="size-16 text-xl" />
          {persona ? (
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold">{persona.nombre}</h2>
                {!persona.activa && <Badge variant="secondary">Inactiva</Badge>}
              </div>
              <p className="text-muted-foreground">
                {persona.empleado ? `${persona.empleado.area} · ` : ''}legajo <span className="font-mono">{persona.userId}</span>
              </p>
              {vigente?.incluir ? (
                <p className="flex items-center gap-1.5"><CalendarClock className="size-4 text-muted-foreground" /> {describirHorario(vigente)}</p>
              ) : persona.empleado ? (
                <p className="text-amber-700 dark:text-amber-400">Sin horario vigente.</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2"><Skeleton className="h-7 w-64" /><Skeleton className="h-4 w-48" /></div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {persona?.empleado && (
            <Button variant="outline" className="h-11 text-base" onClick={() => setEditando(true)}>
              <CalendarClock className="size-4" /> Editar horario
            </Button>
          )}
          {persona && (
            <Button variant="outline" className="h-11 text-base" asChild>
              <Link href={`/admin/asistencia?tab=fichadas&persona=${encodeURIComponent(persona.userId)}`}><ListChecks className="size-4" /> Todas sus marcas</Link>
            </Button>
          )}
        </div>
      </div>

      {persona && !persona.empleado && (
        <div className="space-y-2 rounded-xl border border-amber-500 bg-amber-400/10 p-4">
          <p>Este legajo del reloj no está vinculado a una ficha del organigrama: no tiene horario y solo se ven sus marcas. Elegí su ficha para poder cargarle el horario.</p>
          <EmpleadoPicker empleados={empleadosLibres} valor={null} disabled={vinculando} onCambio={vincular} className="w-full sm:w-96" />
        </div>
      )}

      <div className="sm:max-w-md">
        <NavPeriodo unidad="Mes" label={fmtMes(mes)} onAnterior={() => set({ mes: mesAnterior(mes) })} onSiguiente={() => set({ mes: mesSiguiente(mes) })} sinSiguiente={mes >= hoy.slice(0, 7)} />
      </div>

      {error && <Banner variant="warn">{error}</Banner>}

      {!data ? (
        loading && <Skeleton className="h-96 w-full rounded-xl" />
      ) : (
        <div className={cn('space-y-5', loading && 'opacity-60')}>
          {sinHorario ? (
            <Banner variant="info">
              Sin horario en {fmtMes(mes).toLowerCase()}: no se calculan faltas, llegadas tarde ni horas esperadas.
              {persona?.empleado ? ' Cargalo con «Editar horario».' : ''}
            </Banner>
          ) : (
            resumen && <Numeros r={resumen} />
          )}
          <DiaPorDia celdas={data.fila?.celdas ?? []} dias={data.dias} marcas={data.marcas} />
        </div>
      )}

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

function Volver({ mes }: { mes: string }) {
  return (
    <Link href={`/admin/asistencia?tab=mes&mes=${mes}`} className="inline-flex min-h-11 items-center gap-2 font-medium text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-5" /> Volver al mes
    </Link>
  );
}

function Tarjeta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** Los cuatro números del mes, los mismos de la vista Mes. */
function Numeros({ r }: { r: ResumenMesPersona }) {
  const grande = 'text-3xl font-semibold';
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tarjeta label="Horas trabajadas">
          <span className={grande}><span className="font-mono">{Math.floor(r.minutosTrabajados / 60)}</span> h</span>
          <span className="text-sm">de {Math.floor(r.minutosEsperados / 60)} h esperadas</span>
          <BarraHoras r={r} className="mt-1.5" />
        </Tarjeta>
        <Tarjeta label="Llegadas tarde">
          <span className={cn(grande, 'font-mono', r.tardes && 'text-amber-700 dark:text-amber-400')}>{r.tardes}</span>
          {r.tardes > 0 && <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{plural(r.compensadas, 'compensada', 'compensadas')}</span>}
          {r.tardes > 0 && <span className="text-sm text-muted-foreground">{fmtMinutos(r.minutosTarde)} en total</span>}
        </Tarjeta>
        <Tarjeta label="Horas extra">
          <span className={cn(grande, r.extra50 + r.extra100 > 0 && 'text-sky-700 dark:text-sky-300')}><span className="font-mono">{r.extra50 + r.extra100}</span> h</span>
          <span className="text-sm">{r.extra50} h al 50 %</span>
          <span className="text-sm text-muted-foreground">{r.extra100} h al 100 %</span>
        </Tarjeta>
        <Tarjeta label="Faltas">
          <span className={cn(grande, 'font-mono', r.faltas && 'text-red-700 dark:text-red-400')}>{r.faltas}</span>
          {r.sinMarca > 0 && <span className="text-sm font-medium text-amber-700 dark:text-amber-400">{plural(r.sinMarca, 'día con una marca faltante', 'días con una marca faltante')}</span>}
        </Tarjeta>
      </div>
      {r.tardes > 0 && (
        <p className="flex gap-2.5 rounded-lg border border-border p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span><strong className="font-semibold">Compensada</strong> quiere decir que llegó tarde pero ese mismo día se quedó después de hora el mismo tiempo o más.</span>
        </p>
      )}
    </div>
  );
}

const conNovedad = (c: CeldaDia) =>
  tardanza(c) > 0 || c.sinSalida || horasExtraDia(c) > 0 || c.estado === 'ausente' || c.estado === 'sin_entrada' || c.estado === 'trabajo_no_laborable';

/** Etiquetas de un día: siempre con palabra, el color acompaña. */
function Etiquetas({ c }: { c: CeldaDia }) {
  const t = tardanza(c);
  const h = horasExtraDia(c);
  const estado: Partial<Record<CeldaDia['estado'], React.ReactNode>> = {
    a_horario: <Etiqueta tono="ok">A horario</Etiqueta>,
    ausente: <Etiqueta tono="bad">Faltó</Etiqueta>,
    sin_entrada: <Etiqueta tono="warn">Sin entrada</Etiqueta>,
    feriado: <Etiqueta tono="neutro">Feriado</Etiqueta>,
    pendiente: <Etiqueta tono="neutro">Todavía no fichó</Etiqueta>,
    trabajo_no_laborable: <Etiqueta tono="info">Vino en su franco</Etiqueta>,
    sin_horario: <Etiqueta tono="neutro">Sin horario</Etiqueta>,
  };
  return (
    <>
      {t > 0 ? (
        <Etiqueta tono={c.estado === 'tarde_grave' ? 'grave' : 'warn'}>
          {c.estado === 'tarde_grave' && <AlertTriangle aria-hidden />}Tarde {fmtMinutos(t)}
        </Etiqueta>
      ) : estado[c.estado]}
      {compensada(c) && <Etiqueta tono="comp"><Check aria-hidden />Compensada</Etiqueta>}
      {c.sinSalida && <Etiqueta tono="warn">Sin salida</Etiqueta>}
      {h > 0 && <Etiqueta tono="info">Extra <span className="font-mono">{h}</span> h</Etiqueta>}
    </>
  );
}

function DiaPorDia({ celdas, dias, marcas }: { celdas: CeldaDia[]; dias: DiaCalendario[]; marcas: MarcaReloj[] }) {
  const [soloNovedad, setSoloNovedad] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  // Los francos sin marcas no dicen nada; los feriados sí (explican por qué no hay falta).
  const todos = celdas
    .map((c, i) => ({ c, d: dias[i] }))
    .filter(({ c }) => c.estado !== 'futuro' && !((c.estado === 'no_laborable' || c.estado === 'sin_horario') && c.marcas === 0));
  const novedades = todos.filter(({ c }) => conNovedad(c)).length;
  const filas = soloNovedad ? todos.filter(({ c }) => conNovedad(c)) : todos;

  return (
    <section aria-label="Día por día" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Día por día</h3>
        <div role="group" aria-label="Qué días mostrar" className="grid grid-cols-2 gap-1 rounded-[10px] bg-muted p-1">
          {[false, true].map((v) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={soloNovedad === v}
              onClick={() => setSoloNovedad(v)}
              className={cn('h-10 rounded-lg px-4 font-medium transition-colors', soloNovedad === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {v ? `Con novedad (${novedades})` : 'Todos'}
            </button>
          ))}
        </div>
      </div>
      {filas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">{soloNovedad ? 'Ningún día con novedad.' : 'Sin días para mostrar en este mes.'}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {filas.map(({ c, d }) => (
            <Dia
              key={c.fecha}
              c={c}
              d={d}
              marcas={marcas.filter((m) => m.fecha === c.fecha)}
              abierto={abierto === c.fecha}
              onAlternar={() => setAbierto(abierto === c.fecha ? null : c.fecha)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Dia({ c, d, marcas, abierto, onAlternar }: { c: CeldaDia; d: DiaCalendario; marcas: MarcaReloj[]; abierto: boolean; onAlternar: () => void }) {
  const idPanel = `dia-${c.fecha}`;
  const horas = c.entrada || c.salida
    ? `${c.entrada ? fmtHoraCorta(c.entrada) : '—'} → ${c.salida ? fmtHoraCorta(c.salida) : c.sinSalida ? 'sin salida' : '—'}`
    : c.jornada ? `Debía entrar a las ${c.jornada.entrada}` : 'Sin marcas';
  const sub = c.minutosTrabajados != null ? `Trabajó ${fmtHorasMin(c.minutosTrabajados)}` : c.sinSalida ? 'No se cuentan las horas' : c.jornada ? `Horario de ${c.jornada.entrada} a ${c.jornada.salida}` : '';
  return (
    <li className={cn(abierto && 'bg-muted/40')}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="w-11 shrink-0 text-center leading-tight">
          <div className="text-sm text-muted-foreground">{DIAS_SEMANA_LARGO[d.diaSemana].slice(0, 3)}</div>
          <div className="text-2xl font-semibold">{d.dia}</div>
        </div>
        <div className="min-w-36 flex-1">
          <div className="font-mono">{horas}</div>
          {sub && <div className="text-sm text-muted-foreground">{sub}</div>}
        </div>
        <div className="flex flex-wrap gap-1.5"><Etiquetas c={c} /></div>
        <Button variant="outline" className="h-11 text-base" aria-expanded={abierto} aria-controls={idPanel} onClick={onAlternar}>
          Detalle <ChevronDown className={cn('size-4 transition-transform', abierto && 'rotate-180')} />
        </Button>
      </div>
      {abierto && (
        <div id={idPanel} className="grid grid-cols-1 gap-5 border-t border-border px-4 py-4 sm:grid-cols-2 sm:pl-[76px]">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Registros del reloj</p>
            {marcas.length === 0 ? (
              <p>Ninguna marca este día.</p>
            ) : (
              <ol className="space-y-1.5">
                {marcas.map((m, i) => (
                  <li key={`${m.fechaHora}-${i}`} className="flex flex-wrap items-baseline gap-x-3">
                    <span className="w-14 font-mono text-lg font-semibold">{fmtHoraCorta(m.fechaHora)}</span>
                    <span>{tipoMarcaLabel(m.tipo)}</span>
                    <span className="text-sm text-muted-foreground">{m.reloj}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Cómo se calculó</p>
            <ul className="list-disc space-y-1 pl-5">
              {explicarDia(c).map((frase) => <li key={frase}>{frase}</li>)}
            </ul>
          </div>
        </div>
      )}
    </li>
  );
}
