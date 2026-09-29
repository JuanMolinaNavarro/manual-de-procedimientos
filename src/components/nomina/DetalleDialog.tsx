'use client';

/**
 * Detalle de una liquidación del motor propio: recibo Anexo III calculado, hash e
 * impresión. Es simulación y control: el recibo legal (y el que se firma) es el PDF
 * de Finnegans (Nómina › Recibos).
 */

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { periodLabel } from '@/lib/nomina-calc';
import type { ReciboVista } from '@/lib/nomina';
import { useNominaData } from './NominaContext';
import ReciboAnexoIII from './ReciboAnexoIII';
import { FlagRow } from './ui';

export default function DetalleDialog({ organigramaId, periodo, empleadoId, onClose }: {
  organigramaId: number;
  periodo: string;
  empleadoId: number | null;
  onClose: () => void;
}) {
  const url = empleadoId != null ? `/api/admin/nomina/recibos/vista?organigramaId=${organigramaId}&periodo=${periodo}&empleadoId=${empleadoId}` : null;
  const vista = useNominaData<ReciboVista>(url);
  const v = vista.data;
  const imprimir = `/admin/nomina/imprimir?organigramaId=${organigramaId}&periodo=${periodo}&empleadoId=${empleadoId}`;

  return (
    <Dialog open={empleadoId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{v?.liquidacion.nombre ?? 'Recibo'}</DialogTitle>
          <DialogDescription className="font-mono text-xs uppercase">
            {v ? `${v.liquidacion.rol} · ${periodLabel(periodo)} · ${v.cerrado ? 'cerrado' : 'pre-liquidación'}` : ' '}
            {v && <span className="text-muted-foreground"> · simulación (el recibo legal es el de Finnegans)</span>}
          </DialogDescription>
        </DialogHeader>
        {vista.error && <FlagRow tipo="error">{vista.error}</FlagRow>}
        {!v && !vista.error && <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>}
        {v && (
          <div className="space-y-3">
            {v.liquidacion.flags.map((f, i) => <FlagRow key={i} tipo={f.tipo}>{f.msg}</FlagRow>)}
            <ReciboAnexoIII liquidacion={v.liquidacion} meta={v.meta} noFlags />
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                {v.cerrado && v.hash ? `hash ${v.hash}` : 'Pre-liquidación (sin cerrar).'}
              </span>
              <Button variant="outline" asChild><a href={imprimir} target="_blank" rel="noopener"><Printer className="mr-1 h-4 w-4" /> Imprimir recibo</a></Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
