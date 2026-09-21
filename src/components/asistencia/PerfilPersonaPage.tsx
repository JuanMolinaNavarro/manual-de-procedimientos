'use client';

/**
 * Perfil de una persona del reloj (`/admin/asistencia/personas/[id]`): la ficha
 * vista desde la liquidación de sueldos. Foto y datos de la ficha, legajo del
 * reloj, horario vigente con su historial, y el mes elegido con ausencias,
 * llegadas tarde, horas trabajadas contra esperadas, horas extra de control y
 * el detalle día por día. Todo sale del mismo `evaluarDia` del calendario.
 */

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Banner, Empty } from '@/components/comunes/ui';
import { cn } from '@/lib/utils';
import { fmtFechaHora, fmtRelativo, hoyLocal } from '@/lib/asistencia-datos';
import { describirHorario, fmtMes, mesAnterior, mesSiguiente, versionVigente } from '@/lib/asistencia-calendario';
import { asistFetch, mensajeError, type PerfilPersona, type Persona } from './api';
import EmpleadoPicker from './EmpleadoPicker';
import { useAsistencia, useAsistenciaData } from './AsistenciaContext';
import HorarioDialog from './HorarioDialog';
import { Detalle, Foto, HorarioCard, Resumen } from './PerfilPiezas';

export default function PerfilPersonaPage({ personaId }: { personaId: number }) {
  const { f, set, personas, personasError, empleados, empleadoPorId, horariosPorEmpleado, refrescar } = useAsistencia();
  const [vinculando, setVinculando] = useState(false);
  const router = useRouter();
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
  const r = data?.resumen ?? null;
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
          <Foto nombre={persona?.nombre ?? null} emp={emp} />
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
                    <>Horario: <span className="font-medium text-foreground">{describirHorario(vigente)}</span></>
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

      {/* Mes */}
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

      {/* Resumen del mes a la izquierda; horario y reloj a la derecha */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className={cn(loading && 'opacity-60')}>
          {!data ? (
            loading ? <Skeleton className="h-64 w-full" /> : null
          ) : sinHorario ? (
            <Banner variant="info">
              Sin horario vigente en {fmtMes(mes).toLowerCase()}: no se calculan ausencias, tardanzas ni horas esperadas.
              {persona?.empleado ? ' Cargalo con «Editar horario».' : ' Vinculá la ficha del organigrama desde Personas y cargale un horario.'}
            </Banner>
          ) : (
            r && <Resumen r={r} hoyEnMes={data.hoy >= data.desde && data.hoy <= data.hasta} />
          )}
        </div>
        <div className="space-y-4">
          <HorarioCard versiones={versiones} vigente={vigente} hoy={hoy} vinculada={!!persona?.empleado} cargando={!persona} />
          <RelojCard persona={persona} empleados={empleadosLibres} vinculando={vinculando} onVincular={vincular} />
        </div>
      </div>

      {/* Día por día: último, a todo el ancho */}
      {data && (
        <div className={cn(loading && 'opacity-60')}>
          <Detalle celdas={data.fila?.celdas ?? []} dias={data.dias} conTotal />
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

function Volver() {
  return (
    <Link href="/admin/asistencia?tab=personas" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> Personas
    </Link>
  );
}

function RelojCard({
  persona, empleados, vinculando, onVincular,
}: {
  persona: Persona | null; empleados: Parameters<typeof EmpleadoPicker>[0]['empleados']; vinculando: boolean; onVincular: (id: number | null) => void;
}) {
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
            <dt className={cn('text-muted-foreground', !persona.empleado && 'pt-2')}>Ficha</dt>
            <dd>
              {persona.empleado ? (
                persona.empleado.nombre
              ) : (
                <>
                  {/* Solo se ofrece vincular cuando todavía no tiene ficha; cambiar o desvincular se hace desde Personas. */}
                  <EmpleadoPicker empleados={empleados} valor={null} disabled={vinculando} onCambio={onVincular} className="w-full" />
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Sin vincular: elegí la ficha del organigrama para poder cargarle horario. Solo se listan las fichas que no tienen legajo asignado.</p>
                </>
              )}
            </dd>
            <dt className="text-muted-foreground">Estado</dt>
            <dd>{persona.activa ? 'activa' : 'inactiva'}</dd>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

