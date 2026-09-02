'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileText, KeyRound, PenLine, Printer, Trash2, Upload, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { fechaCorta, fechaHora, money, periodLabel, type EmpleadoNomina } from '@/lib/nomina-calc';
import type { ConstanciaView, RecibosData, ReciboRow } from '@/lib/nomina';
import { mensajeError, nominaFetch } from './api';
import { useNomina, useNominaData } from './NominaContext';
import { Banner, EmpleadoCell, Empty, Estado, PageTitle, StatCard } from './ui';
import AdhesionDialog from './AdhesionDialog';
import ConstanciaCard from './ConstanciaCard';
import KioscoOverlay from './KioscoOverlay';

export default function RecibosPage() {
  const { organigramaId, listo, refrescar, setPeriodo } = useNomina();
  const q = organigramaId != null ? `organigramaId=${organigramaId}` : null;
  const rec = useNominaData<RecibosData>(q ? `/api/admin/nomina/recibos?${q}` : null);
  const [adhesion, setAdhesion] = useState<{ empleado: EmpleadoNomina; modo: 'adherir' | 'pin' } | null>(null);
  const [revocar, setRevocar] = useState<EmpleadoNomina | null>(null);
  const [kiosco, setKiosco] = useState<{ periodo: string; empleadoId: number } | null>(null);
  const [constancia, setConstancia] = useState<{ periodo: string; row: ReciboRow } | null>(null);
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const actaPara = useRef<number | null>(null);

  const d = rec.data;
  const estado = <Estado loading={rec.loading} error={rec.error} sinOrg={listo && organigramaId == null} />;
  if (!d || organigramaId == null) return <><PageTitle title="Recibos digitales" />{estado}</>;

  async function confirmarRevocar(e: EmpleadoNomina) {
    try {
      await nominaFetch(`/api/admin/nomina/adhesiones/${e.id}?organigramaId=${organigramaId}`, { method: 'DELETE' });
      toast.success(`Adhesión de ${e.nombre} revocada`);
      refrescar();
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
      toast.success('Acta escaneada guardada');
      refrescar();
    } catch (e) { toast.error(mensajeError(e)); } finally { setSubiendo(null); }
  }
  async function quitarActa(id: number) {
    try {
      await nominaFetch(`/api/admin/nomina/adhesiones/${id}/acta?organigramaId=${organigramaId}`, { method: 'DELETE' });
      toast.success('Acta quitada');
      refrescar();
    } catch (e) { toast.error(mensajeError(e)); }
  }
  const actaUrl = (id: number) => `/api/admin/nomina/adhesiones/${id}/acta?organigramaId=${organigramaId}`;
  const imprimirActa = (id: number) => `/admin/nomina/recibos/acta?organigramaId=${organigramaId}&empleadoId=${id}`;
  const imprimirRecibo = (p: string, id: number) => `/admin/nomina/recibos/imprimir?organigramaId=${organigramaId}&periodo=${p}&empleadoId=${id}`;

  return (
    <div className="space-y-6">
      <PageTitle title="Recibos digitales" sub="Entrega del recibo y constancia de recepción con firma electrónica (art. 139/140 LCT, Ley 27.802). Solo se firman períodos cerrados: el trabajador firma exactamente el snapshot que quedó congelado." />
      {!d.empresaOk && <Banner variant="locked"><b>Faltan datos del empleador</b> (razón social y CUIT). El recibo no está completo sin ellos: cargalos en Parámetros → Datos del empleador.</Banner>}
      <Banner>
        <b>Cómo funciona.</b> Cada trabajador adhiere una sola vez al recibo digital y define un PIN personal (nadie más lo conoce). Se imprime el acta de adhesión, la firma en papel, se escanea y se sube como PDF en su fila: ese papel respalda todas las firmas electrónicas posteriores. Después, en cada período cerrado firma con su PIN en este dispositivo (<b>kiosco</b>), en conformidad o en disconformidad con observaciones. Cada firma guarda el hash SHA-256 del recibo y queda encadenada con la anterior.
      </Banner>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Adheridos" value={<>{d.adhesiones.filter((a) => a.adhesion).length}<span className="text-base text-muted-foreground">/{d.adhesiones.length}</span></>} detail="al régimen de recibo digital" />
        <StatCard label="Constancias" value={d.cadena.total} tone="violet" detail="firmas registradas en total" />
        <StatCard label="Cadena de hash" value={d.cadena.rotos ? `${d.cadena.rotos} rota(s)` : 'íntegra'} tone={d.cadena.rotos ? 'red' : 'green'} detail={d.cadena.total ? 'ninguna constancia fue alterada' : 'sin constancias aún'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Adhesión al recibo digital <Badge variant="secondary">{d.adhesiones.length}</Badge></CardTitle>
          <p className="text-sm text-muted-foreground">Acto único por persona. El PIN lo tipea el trabajador (dos veces) y solo se guarda su hash. El acta firmada se escanea y se adjunta en PDF.</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Trabajador</TableHead><TableHead>Estado</TableHead><TableHead>Adhesión</TableHead><TableHead>Acta escaneada</TableHead><TableHead /></TableRow>
              </TableHeader>
              <TableBody>
                {d.adhesiones.map(({ empleado: e, cuil, adhesion: a }) => (
                  <TableRow key={e.id}>
                    <TableCell><EmpleadoCell empleado={e} sub={`CUIL ${cuil || '—'}`} /></TableCell>
                    <TableCell>{a ? <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Adherido</Badge> : <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">Sin adhesión</Badge>}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{a ? `${fechaCorta(a.fecha)} · ${a.modo === 'papel' ? 'acta en papel' : 'aceptación electrónica'}` : '—'}</TableCell>
                    <TableCell>
                      {a?.acta ? (
                        <span className="inline-flex items-center gap-1">
                          <Button size="sm" variant="ghost" asChild><a href={actaUrl(e.id)} target="_blank" rel="noopener"><FileText className="mr-1 h-3.5 w-3.5" /> Ver PDF</a></Button>
                          <Button size="icon" variant="ghost" aria-label="Quitar acta" onClick={() => quitarActa(e.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </span>
                      ) : a ? (
                        <Button size="sm" variant="outline" disabled={subiendo === e.id} onClick={() => elegirActa(e.id)}><Upload className="mr-1 h-3.5 w-3.5" /> {subiendo === e.id ? 'Subiendo…' : 'Subir PDF'}</Button>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {a ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setAdhesion({ empleado: e, modo: 'pin' })}><KeyRound className="mr-1 h-3.5 w-3.5" /> Cambiar PIN</Button>{' '}
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRevocar(e)}><UserX className="mr-1 h-3.5 w-3.5" /> Revocar</Button>
                        </>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => setAdhesion({ empleado: e, modo: 'adherir' })}>Adherir</Button>
                      )}{' '}
                      <Button size="sm" variant="ghost" asChild><a href={imprimirActa(e.id)} target="_blank" rel="noopener"><Printer className="mr-1 h-3.5 w-3.5" /> Acta</a></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!d.adhesiones.length && <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Este organigrama no tiene empleados.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) subirActa(f); ev.target.value = ''; }} />
        </CardContent>
      </Card>

      {!d.periodos.length ? (
        <Empty title="Sin períodos cerrados">Cerrá una liquidación para habilitar la firma de sus recibos.</Empty>
      ) : d.periodos.map((p) => (
        <Card key={p.periodo}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {periodLabel(p.periodo)} <Badge variant="secondary">{p.firmados}/{p.rows.length} firmados</Badge>
              <Badge className="bg-violet-600 text-white hover:bg-violet-600">cerrado {fechaHora(p.fechaCierre)}</Badge>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setPeriodo(p.periodo)}>Usar este período</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Trabajador</TableHead><TableHead>Firma</TableHead><TableHead>Detalle</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {p.rows.map((r) => (
                    <TableRow key={r.empleado.id}>
                      <TableCell><EmpleadoCell empleado={r.empleado} sub={`neto ${money(r.neto)}`} /></TableCell>
                      <TableCell>
                        {r.constancia
                          ? <><Badge className={r.constancia.conformidad === 'conforme' ? 'bg-emerald-600 text-white hover:bg-emerald-600' : 'bg-amber-600 text-white hover:bg-amber-600'}>{r.constancia.conformidad === 'conforme' ? 'Conforme' : 'Disconforme'}</Badge>{r.hashOk === false && <Badge variant="destructive" className="ml-1">Hash no coincide</Badge>}</>
                          : <Badge variant="outline">Pendiente</Badge>}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{r.constancia ? `${fechaHora(r.constancia.fecha)} · ${r.constancia.canal}` : r.adherido ? 'sin firmar' : 'falta adhesión'}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {!r.constancia && r.adherido && <Button size="sm" onClick={() => setKiosco({ periodo: p.periodo, empleadoId: r.empleado.id })}><PenLine className="mr-1 h-3.5 w-3.5" /> Firmar acá</Button>}
                        {!r.constancia && !r.adherido && <Button size="sm" variant="ghost" onClick={() => setAdhesion({ empleado: r.empleado, modo: 'adherir' })}>Adherir</Button>}
                        {r.constancia && <Button size="sm" variant="ghost" onClick={() => setConstancia({ periodo: p.periodo, row: r })}>Ver constancia</Button>}{' '}
                        <Button size="sm" variant="ghost" asChild><a href={imprimirRecibo(p.periodo, r.empleado.id)} target="_blank" rel="noopener"><Printer className="mr-1 h-3.5 w-3.5" /> Imprimir</a></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}

      <AdhesionDialog organigramaId={organigramaId} empleado={adhesion?.empleado ?? null} modo={adhesion?.modo ?? 'adherir'} onClose={() => setAdhesion(null)} onOk={refrescar} />

      {kiosco && (
        <KioscoOverlay organigramaId={organigramaId} periodo={kiosco.periodo} empleadoId={kiosco.empleadoId} onClose={() => setKiosco(null)} onFirmado={() => { setKiosco(null); refrescar(); }} />
      )}

      <Dialog open={!!constancia} onOpenChange={(o) => !o && setConstancia(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Constancia · {constancia?.row.empleado.nombre}</DialogTitle>
            <DialogDescription className="font-mono text-xs uppercase">{constancia ? periodLabel(constancia.periodo) : ''}</DialogDescription>
          </DialogHeader>
          {constancia?.row.constancia && <ConstanciaCard constancia={constancia.row.constancia as ConstanciaView} hashOk={constancia.row.hashOk} />}
          {constancia && (
            <div className="flex justify-end">
              <Button variant="outline" asChild><a href={imprimirRecibo(constancia.periodo, constancia.row.empleado.id)} target="_blank" rel="noopener"><Printer className="mr-1 h-4 w-4" /> Imprimir recibo con constancia</a></Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revocar} onOpenChange={(o) => !o && setRevocar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revocar la adhesión de {revocar?.nombre}</AlertDialogTitle>
            <AlertDialogDescription>Las constancias ya firmadas se conservan. Si hay un acta escaneada, se elimina.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const e = revocar; setRevocar(null); if (e) confirmarRevocar(e); }}>Revocar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
