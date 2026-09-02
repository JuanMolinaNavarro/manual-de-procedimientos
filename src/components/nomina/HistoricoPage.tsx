'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Download, Eye, FileSignature, Unlock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { csvLiquidacion, fechaHora, money, periodLabel } from '@/lib/nomina-calc';
import type { HistoricoRow, LiquidacionData } from '@/lib/nomina';
import { descargar, mensajeError, nominaFetch } from './api';
import { useNomina, useNominaData } from './NominaContext';
import { Empty, Estado, PageTitle } from './ui';

export default function HistoricoPage() {
  const { organigramaId, listo, setPeriodo, refrescar } = useNomina();
  const router = useRouter();
  const q = organigramaId != null ? `organigramaId=${organigramaId}` : null;
  const hist = useNominaData<HistoricoRow[]>(q ? `/api/admin/nomina/historico?${q}` : null);
  const [reabrir, setReabrir] = useState<HistoricoRow | null>(null);

  const estado = <Estado loading={hist.loading} error={hist.error} sinOrg={listo && organigramaId == null} />;
  if (!hist.data || organigramaId == null) return <><PageTitle title="Histórico de liquidaciones" />{estado}</>;

  function ir(p: string, href: string) { setPeriodo(p); router.push(href); }
  async function csv(p: string) {
    try {
      const d = await nominaFetch<LiquidacionData>(`/api/admin/nomina/liquidacion?organigramaId=${organigramaId}&periodo=${p}`);
      descargar(`liquidacion_${p}.csv`, csvLiquidacion(p, d.liquidaciones, Object.fromEntries(d.liquidaciones.map((l) => [l.empId, l.cuil]))), 'text/csv');
    } catch (e) { toast.error(mensajeError(e)); }
  }
  async function confirmarReabrir(r: HistoricoRow) {
    try {
      await nominaFetch('/api/admin/nomina/liquidacion/reabrir', { method: 'POST', body: JSON.stringify({ organigramaId, periodo: r.periodo }) });
      toast.success(`Período ${periodLabel(r.periodo)} reabierto`);
      refrescar();
    } catch (e) { toast.error(mensajeError(e)); }
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Histórico de liquidaciones" sub="Cada período cerrado es un snapshot inmutable: guarda montos y también los parámetros vigentes al momento del cierre." />
      {!hist.data.length ? (
        <Empty title="Sin liquidaciones cerradas">Cuando cierres un período, queda congelado acá para consulta y auditoría.</Empty>
      ) : (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2">Períodos cerrados <Badge variant="secondary">{hist.data.length}</Badge></CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Empleados</TableHead>
                    <TableHead className="text-right">Firmados</TableHead>
                    <TableHead className="text-right">Neto total</TableHead>
                    <TableHead className="text-right">Costo empresa</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hist.data.map((r) => (
                    <TableRow key={r.periodo}>
                      <TableCell><b>{periodLabel(r.periodo)}</b><div className="font-mono text-[11px] text-muted-foreground">cerrado el {fechaHora(r.fechaCierre)}</div></TableCell>
                      <TableCell className="text-right tabular-nums">{r.empleados}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{r.firmados}/{r.empleados}</TableCell>
                      <TableCell className="text-right font-mono font-semibold tabular-nums text-violet-600 dark:text-violet-400">{money(r.neto)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{money(r.costo)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button size="sm" variant="secondary" onClick={() => ir(r.periodo, '/admin/nomina/liquidacion')}><Eye className="mr-1 h-3.5 w-3.5" /> Ver detalle</Button>{' '}
                        <Button size="sm" variant="ghost" onClick={() => csv(r.periodo)}><Download className="mr-1 h-3.5 w-3.5" /> CSV</Button>{' '}
                        <Button size="sm" variant="ghost" onClick={() => ir(r.periodo, '/admin/nomina/recibos')}><FileSignature className="mr-1 h-3.5 w-3.5" /> Firmas</Button>{' '}
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setReabrir(r)}><Unlock className="mr-1 h-3.5 w-3.5" /> Reabrir</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!reabrir} onOpenChange={(o) => !o && setReabrir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir {reabrir ? periodLabel(reabrir.periodo) : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              ATENCIÓN: reabrir elimina el cierre congelado (los datos del maestro y novedades se conservan, pero el snapshot auditable se pierde).
              {reabrir?.firmados ? ` Hay ${reabrir.firmados} recibo(s) FIRMADOS en este período: las constancias se conservan, pero el hash ya no va a coincidir y se marcarán como no verificables.` : ''} ¿Reabrir de todos modos?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const r = reabrir; setReabrir(null); if (r) confirmarReabrir(r); }}>Reabrir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
