'use client';

/**
 * Nómina › Recibos › pestaña "Adhesiones": quién adhirió al recibo digital. La adhesión es
 * presencial (email + PIN que tipea el trabajador), se imprime el acta, se firma en papel y se
 * sube escaneada; sin acta queda pendiente y no firma. Cada fila muestra la acción que toca
 * (Adherir / Subir acta) y el resto va en el menú.
 */

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileText, MoreHorizontal, Printer, Trash2, Upload, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fechaHora, type EmpleadoNomina } from '@/lib/nomina-calc';
import type { AdhesionRow, AdhesionView } from '@/lib/nomina';
import { mensajeError, nominaFetch } from './api';
import AdhesionDialog from './AdhesionDialog';
import { useNomina } from './NominaContext';
import { BarraFiltros, coincide } from './PasoCard';
import { Banner, EmpleadoCell } from './ui';

type Filtro = 'todas' | 'sin' | 'pendiente' | 'completa';

const estadoDe = (a: AdhesionView | null): Exclude<Filtro, 'todas'> => (!a ? 'sin' : a.completa ? 'completa' : 'pendiente');

function BadgeAdhesion({ a }: { a: AdhesionView | null }) {
  if (!a) return <Badge variant="outline" className="text-muted-foreground">Sin adhesión</Badge>;
  if (!a.completa) return <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">Falta el acta</Badge>;
  return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Adherido</Badge>;
}

export default function AdhesionesTabla({ adhesiones, onCambio }: { adhesiones: AdhesionRow[]; onCambio: () => void }) {
  const { organigramaId, puedeGestionarPin } = useNomina();
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [adherir, setAdherir] = useState<EmpleadoNomina | null>(null);
  const [revocar, setRevocar] = useState<EmpleadoNomina | null>(null);
  const [motivo, setMotivo] = useState('');
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const actaPara = useRef<number | null>(null);

  if (organigramaId == null) return null;
  const actaUrl = (id: number) => `/api/admin/nomina/adhesiones/${id}/acta?organigramaId=${organigramaId}`;
  const imprimirActa = (id: number) => `/admin/gestion-recibos/acta?organigramaId=${organigramaId}&empleadoId=${id}`;

  async function confirmarRevocar(e: EmpleadoNomina) {
    try {
      await nominaFetch(`/api/admin/nomina/adhesiones/${e.id}?organigramaId=${organigramaId}`, {
        method: 'DELETE',
        body: JSON.stringify({ motivo }),
      });
      toast.success(`Adhesión de ${e.nombre} revocada (queda en el historial con su acta)`);
      setMotivo('');
      onCambio();
    } catch (er) { toast.error(mensajeError(er)); }
  }
  function elegirActa(empleadoId: number) {
    actaPara.current = empleadoId;
    fileRef.current?.click();
  }
  async function subirActa(file: File) {
    const id = actaPara.current;
    if (!id) return;
    setSubiendo(id);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      fd.append('organigramaId', String(organigramaId));
      await nominaFetch(`/api/admin/nomina/adhesiones/${id}/acta`, { method: 'POST', body: fd });
      toast.success('Acta guardada: ya puede firmar sus recibos');
      onCambio();
    } catch (e) { toast.error(mensajeError(e)); } finally { setSubiendo(null); }
  }
  async function quitarActa(id: number) {
    try {
      await nominaFetch(actaUrl(id), { method: 'DELETE' });
      toast.success('Acta quitada: la adhesión volvió a quedar pendiente');
      onCambio();
    } catch (e) { toast.error(mensajeError(e)); }
  }

  const cuenta = (f: Exclude<Filtro, 'todas'>) => adhesiones.filter((x) => estadoDe(x.adhesion) === f).length;
  const filtros = [
    { valor: 'todas' as const, label: 'Todas', cuenta: adhesiones.length },
    { valor: 'sin' as const, label: 'Sin adhesión', cuenta: cuenta('sin') },
    { valor: 'pendiente' as const, label: 'Falta el acta', cuenta: cuenta('pendiente') },
    { valor: 'completa' as const, label: 'Adheridos', cuenta: cuenta('completa') },
  ];
  const visibles = adhesiones.filter((x) => (filtro === 'todas' || estadoDe(x.adhesion) === filtro) && coincide(x.empleado.nombre, buscar));

  return (
    <div className="space-y-3">
      {!puedeGestionarPin && (
        <Banner>Como superadmin no podés adherir, revocar ni cargar actas: lo hace un admin de RR.HH. (quien gestiona usuarios no interviene en los PIN de firma).</Banner>
      )}
      <BarraFiltros buscar={buscar} onBuscar={setBuscar} filtros={filtros} activo={filtro} onFiltro={setFiltro} />
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {visibles.map(({ empleado: e, cuil, adhesion: a }) => (
          <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
            <EmpleadoCell
              empleado={e}
              sub={a ? (a.email ?? 'sin email: no recibe avisos') : `CUIL ${cuil || '—'}`}
              className="min-w-0 flex-1"
            />
            <div className="flex items-center gap-2">
              <BadgeAdhesion a={a} />
              {a?.bloqueadaHasta && <Badge variant="destructive" title={`Hasta ${fechaHora(a.bloqueadaHasta)}`}>PIN bloqueado</Badge>}
            </div>
            <div className="flex w-full items-center justify-end gap-1 sm:w-44">
              {!a && puedeGestionarPin && (
                <Button size="sm" variant="secondary" disabled={!cuil} title={cuil ? undefined : 'Falta el CUIL en el Maestro'} onClick={() => setAdherir(e)}>
                  Adherir
                </Button>
              )}
              {a && !a.acta && puedeGestionarPin && (
                <Button size="sm" disabled={subiendo === e.id} onClick={() => elegirActa(e.id)}>
                  <Upload className="mr-1 h-3.5 w-3.5" /> {subiendo === e.id ? 'Subiendo…' : 'Subir acta'}
                </Button>
              )}
              {a && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label={`Acciones de ${e.nombre}`}><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">{a.codigo ?? '—'}</div>
                    <DropdownMenuItem asChild>
                      <a href={imprimirActa(e.id)} target="_blank" rel="noopener"><Printer className="h-4 w-4" /> Imprimir acta</a>
                    </DropdownMenuItem>
                    {a.acta && (
                      <>
                        <DropdownMenuItem asChild>
                          <a href={actaUrl(e.id)} target="_blank" rel="noopener"><FileText className="h-4 w-4" /> Ver acta escaneada</a>
                        </DropdownMenuItem>
                        {puedeGestionarPin && (
                          <DropdownMenuItem onSelect={() => void quitarActa(e.id)}><Trash2 className="h-4 w-4" /> Quitar acta</DropdownMenuItem>
                        )}
                      </>
                    )}
                    {puedeGestionarPin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setRevocar(e)}><UserX className="h-4 w-4" /> Revocar adhesión…</DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </li>
        ))}
        {!visibles.length && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            {adhesiones.length ? 'Nadie coincide con el filtro.' : 'Este organigrama no tiene empleados.'}
          </li>
        )}
      </ul>
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) void subirActa(f); ev.target.value = ''; }} />

      <AdhesionDialog organigramaId={organigramaId} empleado={adherir} onClose={() => setAdherir(null)} onOk={onCambio} />

      <AlertDialog open={!!revocar} onOpenChange={(o) => !o && setRevocar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revocar la adhesión de {revocar?.nombre}</AlertDialogTitle>
            <AlertDialogDescription>
              Usalo si deja el recibo digital o si <b>olvidó su PIN</b> (RR.HH. no puede cambiarlo: después se hace una adhesión nueva,
              en persona y con acta nueva). Nada se borra: las firmas ya hechas y el acta quedan en el historial. Hasta que vuelva a
              adherir, sus recibos se entregan en papel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input placeholder="Motivo (ej.: olvidó su PIN)" value={motivo} onChange={(ev) => setMotivo(ev.target.value)} maxLength={500} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const e = revocar; setRevocar(null); if (e) void confirmarRevocar(e); }}>Revocar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
