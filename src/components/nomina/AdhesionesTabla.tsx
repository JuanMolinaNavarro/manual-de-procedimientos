'use client';

/**
 * Gestión de recibos › pestaña "Adhesiones": quién adhirió al recibo digital. La adhesión es
 * presencial (email + PIN que tipea el trabajador), se imprime el acta, se firma en papel y se
 * sube escaneada; sin acta queda pendiente y no firma. Es de la persona (no del organigrama) y
 * nombra al EMPLEADOR que le liquidaba al adherir: si Finnegans pasa a liquidarlo otra empresa,
 * figura «Renovar» (sus recibos nuevos no se pueden firmar con esa acta). Cada fila muestra la
 * acción que toca (Adherir / Subir acta) y el resto va en el menú.
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

type Filtro = 'todas' | 'sin' | 'pendiente' | 'completa' | 'renovar';

const estadoDe = (a: AdhesionView | null): Exclude<Filtro, 'todas' | 'renovar'> => (!a ? 'sin' : a.completa ? 'completa' : 'pendiente');

/** Adherido con una empresa que ya no es la que le liquida (según Finnegans): hay que renovar. */
const aRenovar = (x: AdhesionRow) => !!x.adhesion && !!x.empleadorActual && x.empleadorActual.cuit !== x.adhesion.empleador.cuit;

function BadgeAdhesion({ a }: { a: AdhesionView | null }) {
  if (!a) return <Badge variant="outline" className="text-muted-foreground">Sin adhesión</Badge>;
  if (!a.completa) return <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">Falta el acta</Badge>;
  return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Adherido</Badge>;
}

export default function AdhesionesTabla({ adhesiones, onCambio }: { adhesiones: AdhesionRow[]; onCambio: () => void }) {
  const { puedeGestionarPin } = useNomina();
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [adherir, setAdherir] = useState<EmpleadoNomina | null>(null);
  const [revocar, setRevocar] = useState<EmpleadoNomina | null>(null);
  const [motivo, setMotivo] = useState('');
  const [quitar, setQuitar] = useState<EmpleadoNomina | null>(null);
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const actaPara = useRef<number | null>(null);

  const actaUrl = (id: number) => `/api/admin/nomina/adhesiones/${id}/acta`;
  const imprimirActa = (id: number) => `/admin/gestion-recibos/acta?empleadoId=${id}`;

  async function confirmarRevocar(e: EmpleadoNomina) {
    try {
      await nominaFetch(`/api/admin/nomina/adhesiones/${e.id}`, {
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

  const cumple = (x: AdhesionRow, f: Filtro) => f === 'todas' || (f === 'renovar' ? aRenovar(x) : estadoDe(x.adhesion) === f);
  const cuenta = (f: Filtro) => adhesiones.filter((x) => cumple(x, f)).length;
  const filtros = [
    { valor: 'todas' as const, label: 'Todas', cuenta: adhesiones.length },
    { valor: 'sin' as const, label: 'Sin adhesión', cuenta: cuenta('sin') },
    { valor: 'pendiente' as const, label: 'Falta el acta', cuenta: cuenta('pendiente') },
    { valor: 'completa' as const, label: 'Adheridos', cuenta: cuenta('completa') },
    { valor: 'renovar' as const, label: 'Renovar', cuenta: cuenta('renovar') },
  ].filter((f) => f.valor !== 'renovar' || f.cuenta > 0);
  const activo: Filtro = filtros.some((f) => f.valor === filtro) ? filtro : 'todas';
  const visibles = adhesiones.filter((x) => cumple(x, activo) && coincide(x.empleado.nombre, buscar));

  return (
    <div className="space-y-3">
      {!puedeGestionarPin && (
        <Banner>Como superadmin no podés adherir, revocar ni cargar actas: lo hace un admin de RR.HH. (quien gestiona usuarios no interviene en los PIN de firma).</Banner>
      )}
      <BarraFiltros buscar={buscar} onBuscar={setBuscar} filtros={filtros} activo={activo} onFiltro={setFiltro} />
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {visibles.map((x) => {
          const { empleado: e, cuil, adhesion: a, empleadorActual, lugar } = x;
          const empresa = a ? a.empleador.nombre : empleadorActual?.nombre ?? 'todavía no aparece en Finnegans';
          return (
          <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
            <EmpleadoCell
              empleado={e}
              sub={`${lugar} · ${empresa} · ${a ? (a.email ?? 'sin email: no recibe avisos') : `CUIL ${cuil || '—'}`}`}
              className="min-w-0 flex-1"
            />
            <div className="flex items-center gap-2">
              <BadgeAdhesion a={a} />
              {aRenovar(x) && (
                <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300" title={`El acta es con ${a?.empleador.nombre}: sus recibos nuevos no se pueden firmar hasta renovarla`}>
                  Renovar: ahora le paga {empleadorActual?.nombre}
                </Badge>
              )}
              {a?.bloqueadaHasta && <Badge variant="destructive" title={`Hasta ${fechaHora(a.bloqueadaHasta)}`}>PIN bloqueado</Badge>}
            </div>
            <div className="flex w-full items-center justify-end gap-1 sm:w-44">
              {!a && puedeGestionarPin && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!cuil || !empleadorActual}
                  title={!cuil ? 'Falta el CUIL en el Maestro' : !empleadorActual ? 'Todavía no aparece en ninguna liquidación de Finnegans: el acta tiene que nombrar a su empleador' : undefined}
                  onClick={() => setAdherir(e)}
                >
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
                    <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                      <span className="font-mono">{a.codigo ?? '—'}</span> · acta con {a.empleador.nombre}
                    </div>
                    <DropdownMenuItem asChild>
                      <a href={imprimirActa(e.id)} target="_blank" rel="noopener"><Printer className="h-4 w-4" /> Imprimir acta</a>
                    </DropdownMenuItem>
                    {a.acta && (
                      <>
                        <DropdownMenuItem asChild>
                          <a href={actaUrl(e.id)} target="_blank" rel="noopener"><FileText className="h-4 w-4" /> Ver acta escaneada</a>
                        </DropdownMenuItem>
                        {puedeGestionarPin && (
                          <DropdownMenuItem onSelect={() => setQuitar(e)}><Trash2 className="h-4 w-4" /> Quitar acta…</DropdownMenuItem>
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
          );
        })}
        {!visibles.length && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            {adhesiones.length ? 'Nadie coincide con el filtro.' : 'Nadie con CUIL cargado en el Maestro para estos filtros.'}
          </li>
        )}
      </ul>
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) void subirActa(f); ev.target.value = ''; }} />

      <AdhesionDialog empleado={adherir} onClose={() => setAdherir(null)} onOk={onCambio} />

      <AlertDialog open={!!quitar} onOpenChange={(o) => !o && setQuitar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar el acta de {quitar?.nombre}</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra el escaneo del acta y la adhesión vuelve a quedar <b>pendiente</b>: no va a poder firmar hasta que se suba
              de nuevo. Usalo solo si se subió un archivo equivocado (si ya firmó algún recibo, el acta no se puede quitar).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const e = quitar; setQuitar(null); if (e) void quitarActa(e.id); }}>Quitar acta</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!revocar} onOpenChange={(o) => { if (!o) { setRevocar(null); setMotivo(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revocar la adhesión de {revocar?.nombre}</AlertDialogTitle>
            <AlertDialogDescription>
              Usalo si deja el recibo digital, si <b>olvidó su PIN</b> (RR.HH. no puede cambiarlo) o si ahora le paga otra empresa:
              después se hace una adhesión nueva, en persona y con acta nueva. Nada se borra: las firmas ya hechas y el acta quedan en el historial. Hasta que vuelva a
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
