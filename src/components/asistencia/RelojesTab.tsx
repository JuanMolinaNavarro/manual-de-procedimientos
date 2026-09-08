'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  MoreVertical, Plus, Upload, RefreshCw, Loader2, Wifi, Trash2, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Banner, ColHelp, Empty, FlagRow } from '@/components/comunes/ui';
import { cn } from '@/lib/utils';
import { fmtRelativo, fmtFechaHora } from '@/lib/asistencia-datos';
import { asistFetch, mensajeError, type Reloj, type ResultadoSync } from './api';
import { useAsistencia } from './AsistenciaContext';

type Accion = 'probar' | 'nuevos' | 'todos';

const AYUDA_LIMPIAR =
  'Después de bajar los registros, le borra al reloj la marca de "nuevos" (comando 0x4E). ' +
  'Dejalo apagado mientras CrossChex siga descargando de este reloj: si la marca la borramos ' +
  'nosotros, CrossChex deja de ver esos registros. Encendelo recién cuando CrossChex se retire.';

export default function RelojesTab() {
  const { relojes, relojesError, refrescar } = useAsistencia();
  const [ocupado, setOcupado] = useState<Record<number, Accion | undefined>>({});
  const [syncTodos, setSyncTodos] = useState(false);

  const trabajando = (id: number) => ocupado[id];
  const marcar = (id: number, a: Accion | undefined) => setOcupado((o) => ({ ...o, [id]: a }));

  async function patch(r: Reloj, data: Partial<Reloj>) {
    try {
      await asistFetch(`/api/admin/asistencia/relojes/${r.id}`, { method: 'PATCH', body: JSON.stringify(data) });
      refrescar();
    } catch (e) {
      toast.error(mensajeError(e));
      refrescar();
    }
  }

  async function probar(r: Reloj) {
    marcar(r.id, 'probar');
    try {
      const res = await asistFetch<{ firmware: string | null; contadores: { registrosTotales: number; usuarios: number; registrosNuevos: number } }>(
        `/api/admin/asistencia/relojes/${r.id}/probar`,
        { method: 'POST' },
      );
      toast.success(`${r.nombre}: conexión OK · ${res.contadores.usuarios} usuarios · ${res.contadores.registrosTotales} registros (${res.contadores.registrosNuevos} nuevos)`);
      refrescar();
    } catch (e) {
      toast.error(`${r.nombre}: ${mensajeError(e)}`);
      refrescar();
    } finally {
      marcar(r.id, undefined);
    }
  }

  async function sync(r: Reloj, modo: 'nuevos' | 'todos') {
    marcar(r.id, modo);
    try {
      const { resultado } = await asistFetch<{ resultado: ResultadoSync }>(
        `/api/admin/asistencia/relojes/${r.id}/sync`,
        { method: 'POST', body: JSON.stringify({ modo }) },
      );
      if (resultado.error) toast.error(`${resultado.nombre}: ${resultado.error}`);
      else toast.success(`${resultado.nombre}: ${resultado.guardados} fichadas nuevas (de ${resultado.bajados} bajadas)`);
      refrescar();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      marcar(r.id, undefined);
    }
  }

  async function sincronizarTodos() {
    setSyncTodos(true);
    try {
      const { resultados } = await asistFetch<{ resultados: ResultadoSync[] }>('/api/admin/asistencia/sync', {
        method: 'POST',
        body: JSON.stringify({ modo: 'nuevos' }),
      });
      const guardados = resultados.reduce((a, r) => a + r.guardados, 0);
      const conError = resultados.filter((r) => r.error).length;
      if (conError) toast.warning(`${guardados} fichadas nuevas · ${conError} reloj(es) con error`);
      else toast.success(`${guardados} fichadas nuevas de ${resultados.length} reloj(es).`);
      refrescar();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setSyncTodos(false);
    }
  }

  const activos = relojes?.filter((r) => r.activo).length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={sincronizarTodos} disabled={syncTodos}>
          {syncTodos ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {syncTodos ? 'Sincronizando…' : 'Sincronizar todos (nuevos)'}
        </Button>
        <span className="text-sm text-muted-foreground">
          {activos} de {relojes?.length ?? 0} activos · se sincronizan solos cada 10 minutos.
        </span>
        <div className="ml-auto flex items-center gap-2">
          <DialogAgregar onListo={refrescar} />
          <DialogImportar onListo={refrescar} />
        </div>
      </div>

      {relojesError && <Banner variant="warn">{relojesError}</Banner>}

      {relojes != null && relojes.length > 0 && activos === 0 && (
        <Banner variant="locked">
          Ningún reloj está activo, así que la sincronización automática no baja nada. Activá los que ya respondan por
          la red con el switch <strong>Activo</strong> de cada tarjeta.
        </Banner>
      )}

      {relojes == null ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 w-full" />)}
        </div>
      ) : relojes.length === 0 ? (
        <Empty title="Sin relojes">
          <span>Agregá uno con su IP y device ID, o importá la base de CrossChex para dar de alta los que ya existen.</span>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {relojes.map((r) => (
            <RelojCard
              key={r.id}
              reloj={r}
              accion={trabajando(r.id)}
              onProbar={() => probar(r)}
              onSync={(modo) => sync(r, modo)}
              onPatch={(d) => patch(r, d)}
              onBorrado={refrescar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RelojCard({
  reloj: r, accion, onProbar, onSync, onPatch, onBorrado,
}: {
  reloj: Reloj;
  accion: Accion | undefined;
  onProbar: () => void;
  onSync: (modo: 'nuevos' | 'todos') => void;
  onPatch: (d: Partial<Reloj>) => void;
  onBorrado: () => void;
}) {
  const ocupado = accion != null;

  return (
    <Card className={cn('gap-0 py-4', !r.activo && 'opacity-70')}>
      <CardHeader className="flex-row items-start justify-between gap-2 px-4 pb-3">
        <div className="min-w-0">
          <CardTitle className="truncate text-base">{r.nombre}</CardTitle>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{r.ip}:{r.puerto} · ID {r.device_id}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <EstadoBadge reloj={r} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={ocupado} aria-label={`Acciones de ${r.nombre}`}>
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onProbar}><Wifi className="h-4 w-4" />Probar conexión</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSync('nuevos')}><RefreshCw className="h-4 w-4" />Sincronizar nuevos</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSync('todos')}><Download className="h-4 w-4" />Descarga completa</DropdownMenuItem>
              <DropdownMenuSeparator />
              <BorrarReloj reloj={r} onBorrado={onBorrado} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Registros</span>
          <span className="font-mono tabular-nums">
            {r.reg_total?.toLocaleString('es-AR') ?? '—'}
            {r.reg_nuevos ? <span className="ml-1 text-amber-600 dark:text-amber-400">+{r.reg_nuevos}</span> : null}
          </span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Último sync</span>
          <span className="tabular-nums" title={r.ultimo_sync ? fmtFechaHora(r.ultimo_sync) : undefined}>
            {r.ultimo_sync ? fmtRelativo(r.ultimo_sync) : 'nunca'}
          </span>
        </div>

        {/* El error se escribe: antes vivía solo en el `title` del badge y era
            invisible en touch y para lectores de pantalla. */}
        {r.ultimo_error && (
          <FlagRow tipo="error">
            <span className="break-words">{r.ultimo_error}</span>
          </FlagRow>
        )}

        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`activo-${r.id}`} className="text-sm font-normal">Activo</Label>
            <Switch id={`activo-${r.id}`} checked={r.activo} onCheckedChange={(v) => onPatch({ activo: v })} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-foreground">
              <ColHelp label="Limpiar nuevos" desc={AYUDA_LIMPIAR} />
            </span>
            <Switch
              aria-label="Limpiar la marca de nuevos en el reloj"
              checked={r.limpiar_nuevos}
              onCheckedChange={(v) => onPatch({ limpiar_nuevos: v })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EstadoBadge({ reloj: r }: { reloj: Reloj }) {
  if (!r.activo) return <Badge variant="secondary">inactivo</Badge>;
  if (r.ultimo_error) return <Badge variant="outline" className="border-red-500 text-red-600 dark:text-red-400">error</Badge>;
  if (!r.ultimo_sync) return <Badge variant="secondary">sin sync</Badge>;
  return <Badge variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400">ok</Badge>;
}

/** Borrar arrastra las fichadas del reloj (Cascade): hay que decir cuántas. */
function BorrarReloj({ reloj: r, onBorrado }: { reloj: Reloj; onBorrado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [fichadas, setFichadas] = useState<number | null>(null);
  const [borrando, setBorrando] = useState(false);

  async function abrir() {
    setAbierto(true);
    setFichadas(null);
    try {
      const r2 = await asistFetch<{ total: number }>(
        `/api/admin/asistencia/fichadas?relojId=${r.id}&desde=2000-01-01&hasta=2100-01-01&page=1`,
      );
      setFichadas(r2.total);
    } catch {
      setFichadas(null);
    }
  }

  async function borrar() {
    setBorrando(true);
    try {
      await asistFetch(`/api/admin/asistencia/relojes/${r.id}`, { method: 'DELETE' });
      toast.success(`Reloj "${r.nombre}" borrado.`);
      setAbierto(false);
      onBorrado();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setBorrando(false);
    }
  }

  return (
    <>
      <DropdownMenuItem
        variant="destructive"
        onSelect={(e) => { e.preventDefault(); abrir(); }}
      >
        <Trash2 className="h-4 w-4" />
        Borrar reloj
      </DropdownMenuItem>

      <AlertDialog open={abierto} onOpenChange={setAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar el reloj &quot;{r.nombre}&quot;?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p><span className="font-mono">{r.ip}:{r.puerto}</span> · device ID {r.device_id}</p>
                <p>
                  Se borran también{' '}
                  {fichadas == null
                    ? <span className="text-muted-foreground">(contando…)</span>
                    : <strong>{fichadas.toLocaleString('es-AR')} fichadas</strong>}{' '}
                  de este reloj. No se puede deshacer.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={borrando}
              onClick={(e) => { e.preventDefault(); borrar(); }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {borrando ? 'Borrando…' : 'Borrar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DialogAgregar({ onListo }: { onListo: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: '', ip: '', device_id: '' });
  const [guardando, setGuardando] = useState(false);

  async function crear() {
    if (!nuevo.nombre.trim() || !nuevo.ip.trim() || !nuevo.device_id) {
      toast.error('Completá nombre, IP y device ID.');
      return;
    }
    setGuardando(true);
    try {
      await asistFetch('/api/admin/asistencia/relojes', {
        method: 'POST',
        body: JSON.stringify({ ...nuevo, device_id: Number(nuevo.device_id) }),
      });
      toast.success('Reloj agregado.');
      setNuevo({ nombre: '', ip: '', device_id: '' });
      setAbierto(false);
      onListo();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-9"><Plus className="h-4 w-4" />Agregar reloj</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar reloj</DialogTitle>
          <DialogDescription>
            El device ID es el ClientNumber que muestra CrossChex; va en la cabecera de cada trama del protocolo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nuevo-nombre">Nombre</Label>
            <Input id="nuevo-nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Planta baja" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nuevo-ip">IP</Label>
              <Input id="nuevo-ip" value={nuevo.ip} onChange={(e) => setNuevo({ ...nuevo, ip: e.target.value })} placeholder="10.0.112.12" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nuevo-device">Device ID</Label>
              <Input id="nuevo-device" type="number" value={nuevo.device_id} onChange={(e) => setNuevo({ ...nuevo, device_id: e.target.value })} placeholder="1" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
          <Button onClick={crear} disabled={guardando}>{guardando ? 'Agregando…' : 'Agregar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogImportar({ onListo }: { onListo: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function importar() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error('Elegí un archivo .mdb.');
      return;
    }
    setImportando(true);
    setResultado(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const r = await asistFetch<{ relojes: number; personas: number; fichadas: number; fichadasNuevas: number }>(
        '/api/admin/asistencia/importar-mdb',
        { method: 'POST', body },
      );
      setResultado(`${r.fichadasNuevas.toLocaleString('es-AR')} fichadas nuevas (de ${r.fichadas.toLocaleString('es-AR')} en el archivo), ${r.personas} personas y ${r.relojes} relojes.`);
      toast.success('Base importada.');
      if (fileRef.current) fileRef.current.value = '';
      onListo();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setImportando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => { setAbierto(o); if (!o) setResultado(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-9"><Upload className="h-4 w-4" />Importar .mdb</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar base de CrossChex</DialogTitle>
          <DialogDescription>
            Respaldo e histórico. Las fichadas se deduplican, así que volver a importar el mismo archivo no repite nada.
            Los relojes que aparezcan se dan de alta inactivos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input ref={fileRef} type="file" accept=".mdb,.accdb" />
          {resultado && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">Importado: {resultado}</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>Cerrar</Button>
          <Button onClick={importar} disabled={importando}>{importando ? 'Importando…' : 'Importar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
