'use client';

/** Detalle de una liquidación: recibo Anexo III, estado de firma, hash e impresión. */

import { Printer, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fechaHora, periodLabel } from '@/lib/nomina-calc';
import type { ReciboVista } from '@/lib/nomina';
import { useNominaData } from './NominaContext';
import ReciboAnexoIII from './ReciboAnexoIII';
import { FlagRow } from './ui';

export default function DetalleDialog({ organigramaId, periodo, empleadoId, onClose, onFirmar }: {
  organigramaId: number;
  periodo: string;
  empleadoId: number | null;
  onClose: () => void;
  onFirmar?: (empleadoId: number) => void;
}) {
  const url = empleadoId != null ? `/api/admin/nomina/recibos/vista?organigramaId=${organigramaId}&periodo=${periodo}&empleadoId=${empleadoId}` : null;
  const vista = useNominaData<ReciboVista>(url);
  const v = vista.data;
  const imprimir = `/admin/nomina/recibos/imprimir?organigramaId=${organigramaId}&periodo=${periodo}&empleadoId=${empleadoId}`;

  return (
    <Dialog open={empleadoId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{v?.liquidacion.nombre ?? 'Recibo'}</DialogTitle>
          <DialogDescription className="font-mono text-xs uppercase">
            {v ? `${v.liquidacion.rol} · ${periodLabel(periodo)} · ${v.cerrado ? 'cerrado' : 'pre-liquidación'}` : ' '}
            {v?.constancia && <span className={v.constancia.conformidad === 'conforme' ? ' text-emerald-600' : ' text-amber-600'}> · firmado {v.constancia.conformidad === 'conforme' ? 'en conformidad' : 'en disconformidad'} · {fechaHora(v.constancia.fecha)}</span>}
            {v?.cerrado && !v.constancia && <span className="text-amber-600"> · sin firma del trabajador</span>}
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
                {v.cerrado && v.hash ? `hash ${v.hash}` : 'La firma se habilita al cerrar el período.'}
              </span>
              {v.cerrado && !v.constancia && v.adhesion && onFirmar && empleadoId != null && (
                <Button onClick={() => { onClose(); onFirmar(empleadoId); }}><PenLine className="mr-1 h-4 w-4" /> Firmar acá</Button>
              )}
              <Button variant="outline" asChild><a href={imprimir} target="_blank" rel="noopener"><Printer className="mr-1 h-4 w-4" /> Imprimir recibo</a></Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
