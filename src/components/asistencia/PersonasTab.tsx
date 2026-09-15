'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Search, X, ListChecks, Archive, CalendarClock, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Banner, ColHelp, Empty, EmpleadoCell } from '@/components/comunes/ui';
import { usePaginaLocal } from '@/hooks/usePaginaLocal';
import { cn } from '@/lib/utils';
import { DIAS_SILENCIO_DEFAULT, FILAS_POR_PAGINA, fmtFechaDia, fmtFechaHora, fmtRelativo, hoyLocal, sumarDias } from '@/lib/asistencia-datos';
import { describirHorario, versionVigente, type HorarioVersion } from '@/lib/asistencia-calendario';
import { asistFetch, mensajeError, type Persona, type ResultadoMigracionLegacy } from './api';
import { useAsistencia } from './AsistenciaContext';
import EmpleadoPicker from './EmpleadoPicker';
import { Chip, Paginacion } from './piezas';
import HorarioDialog from './HorarioDialog';

type Filtro = 'todas' | 'sinVincular' | 'vinculadas' | 'sinHorario';

const AYUDA_HORARIO =
  'Días y horas en que se espera que la persona fiche. Se edita por versiones: cambiarlo "aplica desde" una fecha y ' +
  'los días anteriores se siguen evaluando con el horario que tenían. Solo se puede cargar a quien está vinculado a una ficha.';

const AYUDA_ACTIVA =
  'Si la persona está vinculada, manda el estado de su ficha en el organigrama y el switch lo cambia ahí. ' +
  'Si no está vinculada, es un estado propio de Asistencia. Una persona inactiva conserva todo su historial ' +
  'y, si no está vinculada, se reactiva sola con la próxima fichada.';

export default function PersonasTab() {
  const { personas, personasError, empleados, empleadoPorId, refrescar, set, horariosPorEmpleado, horarios } = useAsistencia();
  const [hoy] = useState(() => hoyLocal());
  const [editando, setEditando] = useState<{ id: number; nombre: string } | null>(null);
  const vigenteDe = useCallback(
    (empleadoId: number | null) => (empleadoId == null ? null : versionVigente(horariosPorEmpleado.get(empleadoId) ?? [], hoy)),
    [horariosPorEmpleado, hoy],
  );
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [verInactivas, setVerInactivas] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const [guardando, setGuardando] = useState<number | null>(null);
  // Fecha de corte del silencio, fijada al montar (el render no puede mirar el reloj).
  const [corte] = useState(() => sumarDias(hoyLocal(), -DIAS_SILENCIO_DEFAULT));

  // Las inactivas se esconden por defecto: son la cola larga de gente que ya no está.
  const visibles = useMemo(() => (personas ?? []).filter((p) => verInactivas || p.activa), [personas, verInactivas]);

  const filtradas = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return visibles.filter((p) => {
      if (filtro === 'sinVincular' && p.empleadoId != null) return false;
      if (filtro === 'vinculadas' && p.empleadoId == null) return false;
      if (filtro === 'sinHorario' && (p.empleadoId == null || vigenteDe(p.empleadoId)?.incluir)) return false;
      if (!needle) return true;
      return p.nombre.toLowerCase().includes(needle) || p.userId.toLowerCase().includes(needle);
    });
  }, [visibles, q, filtro, vigenteDe]);

  // La lista viene entera del server (son cientos de personas): se pagina acá.
  // La clave son los filtros aplicados; al cambiarlos se vuelve a la página 1.
  const pag = usePaginaLocal(filtradas, `${q.trim().toLowerCase()}|${filtro}|${verInactivas}`, FILAS_POR_PAGINA);

  async function vincular(p: Persona, empleadoId: number | null) {
    setGuardando(p.id);
    try {
      await asistFetch(`/api/admin/asistencia/personas/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ empleadoId }),
      });
      const emp = empleadoId != null ? empleadoPorId.get(empleadoId) : undefined;
      toast.success(emp ? `${p.userId} vinculada a ${emp.nombre}.` : `${p.userId} quedó sin vincular.`);
      // Se recarga desde el server en vez de pintar el cambio a mano: si el
      // PATCH falla, la tabla nunca llega a mostrar algo que no se guardó.
      refrescar();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setGuardando(null);
    }
  }

  async function cambiarActiva(p: Persona, activa: boolean) {
    setGuardando(p.id);
    try {
      await asistFetch(`/api/admin/asistencia/personas/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ activa }),
      });
      toast.success(
        activa
          ? `${p.nombre} vuelve a estar activa.`
          : p.empleadoId != null
            ? `${p.nombre} marcada inactiva en el organigrama.`
            : `${p.nombre} marcada inactiva.`,
      );
      refrescar();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setGuardando(null);
    }
  }

  async function vincularAuto() {
    setVinculando(true);
    try {
      const r = await asistFetch<{ vinculadas: number }>('/api/admin/asistencia/personas/vincular', { method: 'POST' });
      if (r.vinculadas > 0) toast.success(`${r.vinculadas} persona(s) vinculadas por CUIL.`);
      else toast.info('No se vinculó ninguna: o ya estaban vinculadas, o ningún CUIL del maestro de nómina coincide con un ID del reloj.');
      refrescar();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setVinculando(false);
    }
  }

  const activas = personas?.filter((p) => p.activa).length ?? 0;
  const inactivas = (personas?.length ?? 0) - activas;
  const vinculadas = visibles.filter((p) => p.empleadoId != null).length;
  const sinVincular = visibles.length - vinculadas;
  const sinHorario = visibles.filter((p) => p.empleadoId != null && !vigenteDe(p.empleadoId)?.incluir).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            placeholder="Buscar por nombre o legajo"
            onChange={(e) => setQ(e.target.value)}
            className="h-9 w-64 pl-8 pr-8"
          />
          {q && (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => setQ('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Chip activo={filtro === 'todas'} onClick={() => setFiltro('todas')}>Todas ({visibles.length})</Chip>
          <Chip activo={filtro === 'sinVincular'} onClick={() => setFiltro('sinVincular')}>Sin vincular ({sinVincular})</Chip>
          <Chip activo={filtro === 'vinculadas'} onClick={() => setFiltro('vinculadas')}>Vinculadas ({vinculadas})</Chip>
          <Chip activo={filtro === 'sinHorario'} onClick={() => setFiltro('sinHorario')}>Sin horario ({sinHorario})</Chip>
        </div>

        <Chip activo={verInactivas} onClick={() => setVerInactivas((v) => !v)}>
          {verInactivas ? 'Ocultar inactivas' : `Ver inactivas (${inactivas})`}
        </Chip>

        <div className="ml-auto flex items-center gap-2">
          <DialogMigrarLegacy onListo={refrescar} />
          <DialogArchivar onListo={refrescar} />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={vinculando} className="h-9">
                <ListChecks className="h-4 w-4" />
                {vinculando ? 'Vinculando…' : 'Vincular por CUIL'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Vincular automáticamente por CUIL</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2 text-sm">
                    <p>
                      Se compara el ID de cada persona en el reloj (que suele ser el DNI) con los dígitos 3 a 10 del
                      CUIL cargado en el maestro de nómina.
                    </p>
                    <p>
                      Solo se vinculan las personas que hoy no tienen vínculo y cuyo CUIL da una única coincidencia.
                      No pisa nada de lo ya vinculado.
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={vincularAuto}>Vincular</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {personasError && <Banner variant="warn">{personasError}</Banner>}

      {personas == null ? (
        <ListaSkeleton />
      ) : filtradas.length === 0 ? (
        <Empty title={q ? `Ninguna persona coincide con «${q}»` : 'Sin personas'}>
          {q
            ? 'Probá con otro nombre o número de legajo.'
            : inactivas > 0 && !verInactivas
              ? `Las ${inactivas} personas registradas están inactivas.`
              : 'Las personas aparecen solas cuando se bajan fichadas de un reloj o se importa la base de CrossChex.'}
        </Empty>
      ) : (
        <div className="space-y-3">
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Persona</TableHead>
                <TableHead className="hidden lg:table-cell">Nombre en el reloj</TableHead>
                <TableHead>Última fichada</TableHead>
                <TableHead>Empleado del organigrama</TableHead>
                <TableHead><ColHelp label="Horario" desc={AYUDA_HORARIO} /></TableHead>
                <TableHead className="text-center"><ColHelp label="Activa" desc={AYUDA_ACTIVA} /></TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pag.visibles.map((p) => {
                const emp = p.empleadoId != null ? empleadoPorId.get(p.empleadoId) : undefined;
                return (
                  <TableRow key={p.id} className={cn(!p.activa && 'opacity-60')}>
                    <TableCell>
                      <EmpleadoCell
                        empleado={emp ?? { id: -1, nombre: p.nombre, foto_archivo: null }}
                        sub={
                          <span className="flex items-center gap-1.5">
                            {emp ? p.userId : <span className="text-amber-600 dark:text-amber-400">{p.userId} · sin vincular</span>}
                            {!p.activa && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">inactiva</Badge>}
                          </span>
                        }
                      />
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{p.nombreReloj || '—'}</TableCell>
                    <TableCell><UltimaFichada iso={p.ultimaFichada} corte={corte} /></TableCell>
                    <TableCell>
                      <EmpleadoPicker
                        empleados={empleados}
                        valor={p.empleadoId}
                        disabled={guardando === p.id}
                        onCambio={(id) => vincular(p, id)}
                        className="w-64"
                      />
                    </TableCell>
                    <TableCell>
                      <HorarioCell
                        version={vigenteDe(p.empleadoId)}
                        versiones={p.empleadoId != null ? horariosPorEmpleado.get(p.empleadoId) ?? [] : []}
                        cargando={horarios == null}
                        vinculada={p.empleadoId != null}
                        onEditar={emp ? () => setEditando({ id: emp.id, nombre: emp.nombre }) : undefined}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        aria-label={`${p.nombre}: ${p.activa ? 'activa' : 'inactiva'}`}
                        checked={p.activa}
                        disabled={guardando === p.id}
                        onCheckedChange={(v) => cambiarActiva(p, v)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => set({ tab: 'fichadas', userId: p.userId, q: '' })}
                      >
                        Ver fichadas
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <Paginacion
          desdeFila={pag.desdeFila}
          hastaFila={pag.hastaFila}
          total={pag.total}
          page={pag.page}
          totalPaginas={pag.totalPaginas}
          unidad="personas"
          onPage={pag.onPage}
        />
        </div>
      )}

      {editando && (
        <HorarioDialog
          empleado={editando}
          versiones={horariosPorEmpleado.get(editando.id) ?? []}
          open
          onOpenChange={(o) => { if (!o) setEditando(null); }}
        />
      )}

      {personas != null && sinVincular > 0 && (
        <p className="text-xs text-muted-foreground">
          Hay <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">{sinVincular}</Badge>{' '}
          persona(s) activas sin vincular: sus fichadas se muestran con el nombre truncado que trae el reloj.
        </p>
      )}
    </div>
  );
}

/** Horario vigente hoy en una línea + botón para editarlo. */
function HorarioCell({
  version, versiones, cargando, vinculada, onEditar,
}: {
  version: HorarioVersion | null; versiones: HorarioVersion[]; cargando: boolean; vinculada: boolean; onEditar?: () => void;
}) {
  if (!vinculada) return <span className="text-xs text-muted-foreground">Vinculá la ficha primero</span>;
  if (cargando) return <Skeleton className="h-4 w-32" />;
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 text-sm">
        {version ? (
          version.incluir ? (
            <span className="tabular-nums" title={`Vigente desde el ${fmtFechaDia(version.vigenteDesde)}${version.toleranciaMin != null ? ` · tolerancia ${version.toleranciaMin} min` : ''}`}>{describirHorario(version)}</span>
          ) : (
            <Badge variant="secondary">No incluido</Badge>
          )
        ) : (
          <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">{versiones.length ? 'Sin horario vigente' : 'Sin horario'}</Badge>
        )}
      </span>
      {onEditar && (
        <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2" onClick={onEditar} aria-label="Editar horario">
          <CalendarClock className="h-3.5 w-3.5" /> {version ? 'Editar' : 'Cargar'}
        </Button>
      )}
    </div>
  );
}

/**
 * Release A: convierte los horarios viejos de la ficha (texto libre) en versiones.
 * Primero simula y muestra lo que no se pudo interpretar. Se saca en el Release B.
 */
function DialogMigrarLegacy({ onListo }: { onListo: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [sim, setSim] = useState<ResultadoMigracionLegacy | null>(null);
  const [corriendo, setCorriendo] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    asistFetch<ResultadoMigracionLegacy>('/api/admin/asistencia/horarios/migrar-legacy', { method: 'POST', body: JSON.stringify({ dryRun: true }) })
      .then((r) => { if (vivo) setSim(r); })
      .catch((e) => { if (vivo) toast.error(mensajeError(e)); });
    return () => { vivo = false; };
  }, [abierto]);

  async function migrar() {
    setCorriendo(true);
    try {
      const r = await asistFetch<ResultadoMigracionLegacy>('/api/admin/asistencia/horarios/migrar-legacy', { method: 'POST', body: JSON.stringify({ dryRun: false }) });
      toast.success(`${r.migrados} horario(s) migrados${r.noParseables.length ? `; ${r.noParseables.length} para cargar a mano` : ''}.`);
      setAbierto(false);
      onListo();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setCorriendo(false);
    }
  }

  return (
    <AlertDialog open={abierto} onOpenChange={(o) => { setAbierto(o); if (!o) setSim(null); }}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="h-9">
          <Wand2 className="h-4 w-4" />
          Migrar horarios viejos
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Migrar los horarios de la ficha</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                Convierte el horario en texto que tenía cada ficha del organigrama en una primera versión de horario.
                Solo toca a quien todavía no tiene ninguna versión; correrlo dos veces no duplica nada.
              </p>
              {sim == null ? (
                <p className="font-semibold">Revisando…</p>
              ) : (
                <>
                  <p className="font-semibold">
                    {sim.migrados === 0 && sim.noParseables.length === 0
                      ? 'No queda nada por migrar.'
                      : `${sim.migrados} se migran solos; ${sim.noParseables.length} no se pudieron interpretar.`}
                  </p>
                  {sim.noParseables.length > 0 && (
                    <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs">
                      {sim.noParseables.map((n) => (
                        <li key={n.empleadoId}><strong>{n.nombre}</strong>: {n.horario ?? JSON.stringify(n.horarios)}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={corriendo || !sim || sim.migrados === 0} onClick={(e) => { e.preventDefault(); migrar(); }}>
            {corriendo ? 'Migrando…' : 'Migrar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** "hace 3 días" en gris; más de un año (o nunca) en ámbar: es candidata a archivar. */
function UltimaFichada({ iso, corte }: { iso: string | null; corte: string }) {
  const silenciosa = !iso || iso.slice(0, 10) < corte;
  return (
    <span
      className={cn('text-sm tabular-nums', silenciosa ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}
      title={iso ? fmtFechaHora(iso) : undefined}
    >
      {iso ? fmtRelativo(iso) : 'nunca'}
    </span>
  );
}

/** Archivado en bloque por silencio. Primero cuenta (simula), después aplica. */
function DialogArchivar({ onListo }: { onListo: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [candidatas, setCandidatas] = useState<number | null>(null);
  const [archivando, setArchivando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    asistFetch<{ candidatas: number }>('/api/admin/asistencia/personas/archivar', {
      method: 'POST',
      body: JSON.stringify({ dias: DIAS_SILENCIO_DEFAULT, simular: true }),
    })
      .then((r) => { if (vivo) setCandidatas(r.candidatas); })
      .catch((e) => { if (vivo) toast.error(mensajeError(e)); });
    return () => { vivo = false; };
  }, [abierto]);

  async function archivar() {
    setArchivando(true);
    try {
      const r = await asistFetch<{ archivadas: number }>('/api/admin/asistencia/personas/archivar', {
        method: 'POST',
        body: JSON.stringify({ dias: DIAS_SILENCIO_DEFAULT }),
      });
      toast.success(`${r.archivadas} persona(s) archivadas.`);
      setAbierto(false);
      onListo();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setArchivando(false);
    }
  }

  return (
    <AlertDialog open={abierto} onOpenChange={(o) => { setAbierto(o); if (!o) setCandidatas(null); }}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="h-9">
          <Archive className="h-4 w-4" />
          Archivar sin actividad
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archivar personas sin actividad</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                Se marcan inactivas las personas <strong>sin vincular</strong> que llevan más de{' '}
                <strong>{DIAS_SILENCIO_DEFAULT} días</strong> sin fichar, o que nunca ficharon. Las vinculadas al
                organigrama no se tocan: su baja se hace ahí.
              </p>
              <p>
                No se borra nada. Si alguna vuelve a fichar, se reactiva sola. Esto además corre
                solo una vez por día: el botón sirve para aplicarlo ahora.
              </p>
              <p className="pt-1 font-semibold">
                {candidatas == null ? 'Contando…' : candidatas === 0 ? 'No hay nadie para archivar.' : `${candidatas} persona(s) quedarían inactivas.`}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={archivando || !candidatas}
            onClick={(e) => { e.preventDefault(); archivar(); }}
          >
            {archivando ? 'Archivando…' : 'Archivar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ListaSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="ml-auto h-9 w-64" />
        </div>
      ))}
    </div>
  );
}
