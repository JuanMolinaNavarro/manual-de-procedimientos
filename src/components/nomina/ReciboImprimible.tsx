'use client';

/**
 * Vista de impresión A4 del recibo (modelo Anexo III) con la constancia de
 * firma estampada si existe, o las líneas de firma en papel si no. Abre el
 * diálogo de impresión al cargar.
 */

import './nomina.css';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { periodLabel } from '@/lib/nomina-calc';
import type { ReciboVista } from '@/lib/nomina';
import { useNominaData } from './NominaContext';
import ReciboAnexoIII from './ReciboAnexoIII';
import ConstanciaCard from './ConstanciaCard';

export default function ReciboImprimible() {
  const sp = useSearchParams();
  const organigramaId = sp.get('organigramaId'), periodo = sp.get('periodo'), empleadoId = sp.get('empleadoId');
  const url = organigramaId && periodo && empleadoId
    ? `/api/admin/nomina/recibos/vista?organigramaId=${organigramaId}&periodo=${periodo}&empleadoId=${empleadoId}`
    : null;
  const vista = useNominaData<ReciboVista>(url);
  const v = vista.data;
  const impreso = useRef(false);
  // `auto=0` muestra la vista sin abrir el diálogo de impresión (previsualizar).
  const auto = sp.get('auto') !== '0';

  useEffect(() => {
    if (!v || !auto || impreso.current) return;
    impreso.current = true;
    const id = setTimeout(() => window.print(), 300);
    return () => clearTimeout(id);
  }, [v, auto]);

  if (!url) return <p className="text-sm text-muted-foreground">Faltan parámetros (organigramaId, periodo, empleadoId).</p>;
  if (vista.error) return <p className="text-sm text-destructive">{vista.error}</p>;
  if (!v) return <p className="text-sm text-muted-foreground">Cargando recibo…</p>;

  return (
    <div className="mx-auto max-w-[820px] bg-white p-6 text-[#1a1917] print:p-0">
      <div className="no-print mb-4 flex justify-end">
        <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" /> Imprimir</Button>
      </div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-[#6e6a61]">
        Recibo de haberes · modelo Anexo III Decreto 407/2026 · {v.cerrado ? 'liquidación cerrada' : 'pre-liquidación (no válido como recibo)'}
      </div>
      <h2 className="mb-3 text-[17px] font-bold uppercase">{v.meta.empresa.razonSocial || 'Empleador'} — {periodLabel(v.periodo)}</h2>
      <ReciboAnexoIII liquidacion={v.liquidacion} meta={v.meta} noFlags />
      {v.constancia ? (
        <div className="mt-4"><ConstanciaCard constancia={v.constancia} /></div>
      ) : (
        <div className="nomina-rc"><div className="firma"><div>Firma del empleador</div><div>Firma del trabajador</div></div></div>
      )}
      {v.cerrado && v.hash && <div className="nomina-rc"><div className="sign-hash">hash SHA-256 del recibo: {v.hash}</div></div>}
    </div>
  );
}
