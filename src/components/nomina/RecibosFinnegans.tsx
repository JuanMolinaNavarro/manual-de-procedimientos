'use client';

/**
 * Paso 1 de Nómina › Recibos: traer los recibos oficiales (PDF) de Finnegans. La tarjeta
 * resume cuántas liquidaciones del período hay y cuántas se importaron; el detalle y las
 * acciones viven en un diálogo.
 *
 * Buscar = 1 llamada PAGA a Finnegans (RESUMENLIQ, trae todas las empresas).
 * Importar = 1 llamada PAGA por liquidación (la sábana), salvo que ya esté bajada.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { CloudDownload, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { periodLabel } from '@/lib/nomina-calc';
import type { LiquidacionFinnView, ConsumoMes, ResultadoBusqueda, ResultadoImportacion } from '@/lib/recibos-finnegans';
import { mensajeError, nominaFetch } from './api';
import { useNomina, useNominaData } from './NominaContext';
import { PasoCard, type EstadoPaso } from './PasoCard';
import { Banner } from './ui';

interface Listado {
  liquidaciones: LiquidacionFinnView[];
  sinOrganigrama: number;
  consumo: ConsumoMes;
}

const ESTADO: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendiente: { label: 'Sin importar', variant: 'outline' },
  importada: { label: 'Importada', variant: 'secondary' },
  con_diferencias: { label: 'Con diferencias', variant: 'destructive' },
};

function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}` : '—';
}

export default function PasoImportar({ onCambio }: { onCambio: () => void }) {
  const { organigramaId, periodo } = useNomina();
  const url = organigramaId != null ? `/api/admin/nomina/finnegans/liquidaciones?organigramaId=${organigramaId}&periodo=${periodo}` : null;
  const lst = useNominaData<Listado>(url);
  const [abierto, setAbierto] = useState(false);
  const [confirmarBuscar, setConfirmarBuscar] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [diferencias, setDiferencias] = useState<{ nro: number; items: string[] } | null>(null);

  const d = lst.data;
  const consumo = d?.consumo;
  const liqs = d?.liquidaciones ?? [];
  const importadas = liqs.filter((l) => l.estado === 'importada');
  const recibos = importadas.reduce((s, l) => s + l.recibos, 0);
  const conDif = liqs.some((l) => l.estado === 'con_diferencias');

  async function buscar() {
    setOcupado('buscar');
    try {
      const r = await nominaFetch<ResultadoBusqueda>('/api/admin/nomina/finnegans/liquidaciones/buscar', {
        method: 'POST',
        body: JSON.stringify({ periodo }),
      });
      toast.success(`${r.liquidaciones} liquidación(es) en Finnegans para ${periodLabel(periodo)} (${r.nuevas} nueva(s))`);
      if (r.sinOrganigrama.length > 0) {
        toast.warning(`Sin organigrama vinculado por CUIT: ${r.sinOrganigrama.map((s) => s.empresa).join(', ')}`);
      }
      lst.reload();
      setAbierto(true);
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setOcupado(null);
    }
  }

  async function importar(l: LiquidacionFinnView) {
    setOcupado(String(l.transaccionId));
    try {
      const r = await nominaFetch<ResultadoImportacion>(
        `/api/admin/nomina/finnegans/liquidaciones/${l.transaccionId}/importar`,
        { method: 'POST' },
      );
      if (r.ok) {
        toast.success(r.yaImportada ? 'La liquidación ya estaba importada' : `${r.recibos} recibo(s) publicados`);
        setDiferencias(null);
      } else {
        toast.error('La liquidación tiene diferencias: no se publicó ningún recibo');
        setDiferencias({ nro: l.nroLiquidacion, items: r.diferencias });
      }
      lst.reload();
      onCambio();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setOcupado(null);
    }
  }

  const estado: EstadoPaso = !liqs.length ? 'pendiente'
    : conDif ? 'atencion'
    : importadas.length === liqs.length ? 'hecho'
    : 'pendiente';

  return (
    <>
      <PasoCard
        n={1}
        titulo="Importar de Finnegans"
        estado={estado}
        accion={liqs.length ? (
          <Button size="sm" variant={estado === 'hecho' ? 'outline' : 'default'} onClick={() => setAbierto(true)}>
            {estado === 'hecho' ? 'Ver liquidaciones' : 'Importar'}
          </Button>
        ) : (
          <Button size="sm" disabled={ocupado != null || !d} onClick={() => setConfirmarBuscar(true)}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> {ocupado === 'buscar' ? 'Buscando…' : 'Buscar en Finnegans'}
          </Button>
        )}
      >
        {!d ? <p>Cargando…</p>
          : !liqs.length ? <p>Todavía no hay liquidaciones de {periodLabel(periodo)} para esta empresa. No todas liquidan todos los meses.</p>
          : (
            <>
              <p><b className="text-foreground">{importadas.length} de {liqs.length}</b> liquidaciones importadas</p>
              <p>{recibos} recibo(s) publicados{conDif && ' · hay diferencias para revisar'}</p>
            </>
          )}
      </PasoCard>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Liquidaciones de {periodLabel(periodo)} en Finnegans</DialogTitle>
            <DialogDescription>
              Bloqueá la liquidación en Finnegans antes de importarla: lo que se publica es lo que cada empleado ve y firma. Si
              algo no coincide (páginas, CUIL o netos) no se publica nada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {d && d.sinOrganigrama > 0 && (
              <Banner>
                Hay {d.sinOrganigrama} liquidación(es) de empresas sin organigrama vinculado. El vínculo es por CUIT: cargalo en
                Nómina › Parámetros → Datos del empleador.
              </Banner>
            )}
            {diferencias && (
              <Banner variant="warn">
                <b>Liquidación {diferencias.nro}: no se publicó nada.</b>
                <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5">
                  {diferencias.items.map((x) => <li key={x}>{x}</li>)}
                </ul>
              </Banner>
            )}
            <ul className="divide-y divide-border rounded-lg border border-border">
              {liqs.map((l) => {
                const e = ESTADO[l.estado] ?? { label: l.estado, variant: 'outline' as const };
                return (
                  <li key={l.transaccionId} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{l.tipoLiquidacion}</p>
                      <p className="text-xs text-muted-foreground">
                        N.º {l.nroLiquidacion} · pago {fechaCorta(l.fechaPago)} · {l.legajos} legajo(s)
                        {l.estado === 'importada' && ` · ${l.recibos} recibo(s)`}
                      </p>
                    </div>
                    <Badge variant={e.variant}>{e.label}</Badge>
                    {l.estado === 'con_diferencias' && l.diferencias.length > 0 && (
                      <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setDiferencias({ nro: l.nroLiquidacion, items: l.diferencias })}>
                        ver diferencias
                      </button>
                    )}
                    {l.estado !== 'importada' && (
                      <Button size="sm" disabled={ocupado != null} onClick={() => importar(l)}>
                        <CloudDownload className="mr-1.5 h-4 w-4" />
                        {ocupado === String(l.transaccionId) ? 'Importando…' : l.estado === 'con_diferencias' ? 'Reintentar' : 'Importar'}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {consumo && (
                <span className={`text-xs ${consumo.usadas >= consumo.tope ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {consumo.usadas} de {consumo.tope} consultas pagas a Finnegans este mes
                </span>
              )}
              <Button size="sm" variant="ghost" disabled={ocupado != null} onClick={() => setConfirmarBuscar(true)}>
                <RefreshCw className="mr-1.5 h-4 w-4" /> Buscar de nuevo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarBuscar} onOpenChange={setConfirmarBuscar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Consultar las liquidaciones de {periodLabel(periodo)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Es 1 consulta paga a Finnegans. Trae las liquidaciones de todas las empresas del período; las ya importadas no se
              modifican.{consumo && ` Este mes van ${consumo.usadas} de ${consumo.tope}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void buscar()}>Consultar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
