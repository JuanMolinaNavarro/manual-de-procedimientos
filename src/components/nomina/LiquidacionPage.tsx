'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRight, Download, Lock, Unlock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { csvLiquidacion, fechaHora, money, periodLabel } from '@/lib/nomina-calc';
import type { LiquidacionData, LiquidacionView } from '@/lib/nomina';
import { descargar, mensajeError, nominaFetch } from './api';
import { useNomina, useNominaData } from './NominaContext';
import { Banner, EmpleadoCell, Empty, Estado, FlagRow, PageTitle, StatCard } from './ui';
import DetalleDialog from './DetalleDialog';

export function LiqCard({ l, onClick }: { l: LiquidacionView; onClick: () => void }) {
  const hasErr = l.flags.some((f) => f.tipo === 'error'), hasWarn = l.flags.some((f) => f.tipo === 'warn');
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent',
        hasErr ? 'border-red-500/60' : hasWarn ? 'border-amber-500/60' : 'border-border',
      )}
    >
      <EmpleadoCell empleado={{ id: l.empId, nombre: l.nombre, foto_archivo: l.foto_archivo }} sub={l.rol} />
      <div className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Bruto remunerativo</span><span className="tabular-nums">{money(l.totalRem)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Deducciones</span><span className="tabular-nums text-red-600 dark:text-red-400">− {money(l.totalDed)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">No remunerativo</span><span className="tabular-nums text-emerald-600 dark:text-emerald-400">+ {money(l.totalNoRem)}</span></div>
        <div className="flex justify-between border-t border-border pt-1 font-bold"><span>NETO</span><span className="tabular-nums">{money(l.neto)}</span></div>
      </div>
      <div className={cn('mt-2 font-mono text-[11px] uppercase', hasErr ? 'text-red-600' : hasWarn ? 'text-amber-600' : 'text-emerald-600')}>
        {l.flags.length ? `${hasErr ? '⛔' : '⚠'} ${l.flags.length} observación(es) — clic para ver` : '✓ sin observaciones · clic para detalle'}
        {l.constancia && <span className="ml-2 text-muted-foreground">· firmado</span>}
      </div>
    </button>
  );
}

export default function LiquidacionPage() {
  const { organigramaId, periodo, listo, refrescar } = useNomina();
  const q = organigramaId != null ? `organigramaId=${organigramaId}&periodo=${periodo}` : null;
  const liq = useNominaData<LiquidacionData>(q ? `/api/admin/nomina/liquidacion?${q}` : null);
  const [detalle, setDetalle] = useState<number | null>(null);
  const [confirmar, setConfirmar] = useState<'cerrar' | 'reabrir' | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const d = liq.data;
  const estado = <Estado loading={liq.loading} error={liq.error} sinOrg={listo && organigramaId == null} />;
  if (!d || organigramaId == null) return <><PageTitle title={`Liquidación · ${periodLabel(periodo)}`} />{estado}</>;

  const t = d.totales;
  const errores = d.liquidaciones.flatMap((l) => l.flags.filter((f) => f.tipo === 'error').map((f) => ({ n: l.nombre, m: f.msg })));
  const warns = d.liquidaciones.flatMap((l) => l.flags.filter((f) => f.tipo === 'warn').map((f) => ({ n: l.nombre, m: f.msg })));
  const firmados = d.liquidaciones.filter((l) => l.constancia).length;

  async function cerrar() {
    setOcupado(true);
    try {
      await nominaFetch('/api/admin/nomina/liquidacion/cerrar', { method: 'POST', body: JSON.stringify({ organigramaId, periodo }) });
      toast.success(`Liquidación de ${periodLabel(periodo)} cerrada`);
      refrescar();
    } catch (e) { toast.error(mensajeError(e)); } finally { setOcupado(false); }
  }
  async function reabrir() {
    setOcupado(true);
    try {
      await nominaFetch('/api/admin/nomina/liquidacion/reabrir', { method: 'POST', body: JSON.stringify({ organigramaId, periodo }) });
      toast.success(`Período ${periodLabel(periodo)} reabierto`);
      refrescar();
    } catch (e) { toast.error(mensajeError(e)); } finally { setOcupado(false); }
  }
  function exportCSV() {
    if (!d?.liquidaciones.length) { toast.error('Nada para exportar'); return; }
    descargar(`liquidacion_${periodo}.csv`, csvLiquidacion(periodo, d.liquidaciones, Object.fromEntries(d.liquidaciones.map((l) => [l.empId, l.cuil]))), 'text/csv');
    toast.success('CSV exportado para el contador');
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title={`${d.cerrado ? 'Liquidación cerrada' : 'Pre-liquidación'} · ${periodLabel(periodo)}`}
        sub={d.cerrado ? 'Versión congelada e inmutable de este período.' : 'Cálculo en vivo a partir del Maestro + Novedades + Parámetros. Nada queda fijo hasta cerrar.'}
        right={d.cerrado ? <Badge className="bg-violet-600 text-white hover:bg-violet-600">Cerrado</Badge> : <Badge variant="secondary">En curso</Badge>}
      />
      {d.cerrado && <Banner variant="locked">Período cerrado el <b>{fechaHora(d.fechaCierre)}</b>. Los montos no cambian aunque modifiques parámetros o el maestro.</Banner>}

      {!d.liquidaciones.length ? (
        <Empty title="Nada para liquidar">Incluí empleados en el Maestro y cargales el sueldo básico.</Empty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Bruto total" value={money(t.bruto)} />
            <StatCard label="Deducciones" value={`− ${money(t.deducciones)}`} tone="red" />
            <StatCard label="Neto a pagar" value={money(t.neto)} tone="violet" detail={`+ ${money(t.noRem)} no remunerativo incluido`} />
            <StatCard label="Costo empresa" value={money(t.costo)} />
          </div>

          <Card>
            <CardHeader><CardTitle>Validaciones</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {errores.map((x, i) => <FlagRow key={'e' + i} tipo="error"><b>{x.n}:</b> {x.m}</FlagRow>)}
              {warns.map((x, i) => <FlagRow key={'w' + i} tipo="warn"><b>{x.n}:</b> {x.m}</FlagRow>)}
              {!errores.length && !warns.length && <FlagRow tipo="ok">Todas las validaciones pasan. La liquidación está lista para cerrar.</FlagRow>}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {d.liquidaciones.map((l) => <LiqCard key={l.empId} l={l} onClick={() => setDetalle(l.empId)} />)}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={exportCSV}><Download className="mr-1 h-4 w-4" /> Exportar CSV (contador)</Button>
            <div className="flex-1" />
            {d.cerrado ? (
              <>
                <span className="text-xs text-muted-foreground">{firmados}/{d.liquidaciones.length} firmados</span>
                <Button asChild><Link href="/admin/gestion-recibos">Ir a Gestión de recibos <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
                <Button variant="destructive" onClick={() => setConfirmar('reabrir')} disabled={ocupado}><Unlock className="mr-1 h-4 w-4" /> Reabrir período</Button>
              </>
            ) : (
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={!!errores.length || ocupado}
                title={errores.length ? 'Hay errores que bloquean el cierre' : undefined}
                onClick={() => setConfirmar('cerrar')}
              >
                <Lock className="mr-1 h-4 w-4" /> Cerrar liquidación de {periodLabel(periodo)}
              </Button>
            )}
          </div>
        </>
      )}

      <DetalleDialog organigramaId={organigramaId} periodo={periodo} empleadoId={detalle} onClose={() => setDetalle(null)} />

      <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmar === 'cerrar' ? `Cerrar la liquidación de ${periodLabel(periodo)}` : `Reabrir ${periodLabel(periodo)}`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar === 'cerrar'
                ? `${d.liquidaciones.length} empleado(s) · neto total ${money(t.neto)}. El período quedará congelado e inmutable (auditable). ¿Confirmás el cierre?`
                : `ATENCIÓN: reabrir elimina el cierre congelado (los datos del maestro y novedades se conservan, pero el snapshot auditable se pierde). Las firmas de los recibos de Finnegans no dependen de este cierre y no se tocan. ¿Reabrir de todos modos?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const c = confirmar; setConfirmar(null); if (c === 'cerrar') cerrar(); else reabrir(); }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
