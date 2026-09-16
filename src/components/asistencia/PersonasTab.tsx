'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Search, X, ListChecks, CalendarClock } from 'lucide-react';
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
import { FILAS_POR_PAGINA, fmtFechaHora, fmtRelativo, hoyLocal } from '@/lib/asistencia-datos';
import { versionVigente } from '@/lib/asistencia-calendario';
import { asistFetch, mensajeError, type Persona } from './api';
import { useAsistencia } from './AsistenciaContext';
import EmpleadoPicker from './EmpleadoPicker';
import { Chip, Paginacion } from './piezas';
import HorarioDialog from './HorarioDialog';
import PerfilPersonaDialog from './PerfilPersonaDialog';

type Filtro = 'todas' | 'sinVincular' | 'vinculadas' | 'sinHorario';

const AYUDA_HORARIO =
  'Días y horas en que se espera que la persona fiche. Se edita por versiones: cambiarlo "aplica desde" una fecha y ' +
  'los días anteriores se siguen evaluando con el horario que tenían. Solo se puede cargar a quien está vinculado a una ficha.';

const AYUDA_ACTIVA =
  'Si la persona está vinculada, manda el estado de su ficha en el organigrama y el switch lo cambia ahí. ' +
  'Si no está vinculada, es un estado propio de Asistencia. El cambio es siempre manual: ninguna fichada ni ' +
  'proceso automático lo modifica. Una persona inactiva conserva todo su historial.';

export default function PersonasTab() {
  const { personas, personasError, empleados, empleadoPorId, refrescar, set, horariosPorEmpleado, horarios } = useAsistencia();
  const [hoy] = useState(() => hoyLocal());
  const [editando, setEditando] = useState<{ id: number; nombre: string } | null>(null);
  const [perfil, setPerfil] = useState<Persona | null>(null);
  const vigenteDe = useCallback(
    (empleadoId: number | null) => (empleadoId == null ? null : versionVigente(horariosPorEmpleado.get(empleadoId) ?? [], hoy)),
    [horariosPorEmpleado, hoy],
  );
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [verInactivas, setVerInactivas] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const [guardando, setGuardando] = useState<number | null>(null);

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
                      {/* El nombre abre el perfil (resumen del mes para liquidar). */}
                      <button
                        type="button"
                        onClick={() => setPerfil(p)}
                        className="rounded-md text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        aria-label={`Ver perfil de ${p.nombre}`}
                      >
                      <EmpleadoCell
                        empleado={emp ?? { id: -1, nombre: p.nombre, foto_archivo: null }}
                        sub={
                          <span className="flex items-center gap-1.5">
                            {emp ? p.userId : <span className="text-amber-600 dark:text-amber-400">{p.userId} · sin vincular</span>}
                            {!p.activa && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">inactiva</Badge>}
                          </span>
                        }
                      />
                      </button>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{p.nombreReloj || '—'}</TableCell>
                    <TableCell><UltimaFichada iso={p.ultimaFichada} /></TableCell>
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={!emp || horarios == null}
                        title={emp ? undefined : 'Vinculá la ficha del organigrama primero'}
                        onClick={() => emp && setEditando({ id: emp.id, nombre: emp.nombre })}
                        aria-label={`Editar horario de ${p.nombre}`}
                      >
                        <CalendarClock className="h-3.5 w-3.5" /> Editar
                      </Button>
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

      {perfil && (
        <PerfilPersonaDialog
          persona={perfil}
          open
          onOpenChange={(o) => { if (!o) setPerfil(null); }}
          onEditarHorario={perfil.empleado ? () => { setEditando({ id: perfil.empleado!.id, nombre: perfil.empleado!.nombre }); setPerfil(null); } : undefined}
        />
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

/** "hace 3 días" / "nunca", con la fecha completa al pasar el mouse. */
function UltimaFichada({ iso }: { iso: string | null }) {
  return (
    <span className="text-sm tabular-nums text-muted-foreground" title={iso ? fmtFechaHora(iso) : undefined}>
      {iso ? fmtRelativo(iso) : 'nunca'}
    </span>
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
