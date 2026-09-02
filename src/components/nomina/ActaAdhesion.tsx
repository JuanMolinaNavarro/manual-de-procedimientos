'use client';

/**
 * Acta de adhesión al recibo digital, para imprimir y firmar en papel. Es el
 * acto único que respalda todas las firmas electrónicas posteriores; una vez
 * firmada se escanea y se sube en la fila del trabajador.
 */

import './nomina.css';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ActaDatos } from '@/lib/nomina';
import { useNominaData } from './NominaContext';

export default function ActaAdhesion() {
  const sp = useSearchParams();
  const organigramaId = sp.get('organigramaId'), empleadoId = sp.get('empleadoId');
  const url = organigramaId && empleadoId ? `/api/admin/nomina/acta-datos?organigramaId=${organigramaId}&empleadoId=${empleadoId}` : null;
  const datos = useNominaData<ActaDatos>(url);
  const d = datos.data;
  const impreso = useRef(false);
  // `auto=0` muestra el acta sin abrir el diálogo de impresión (previsualizar).
  const auto = sp.get('auto') !== '0';

  useEffect(() => {
    if (!d || !auto || impreso.current) return;
    impreso.current = true;
    const id = setTimeout(() => window.print(), 300);
    return () => clearTimeout(id);
  }, [d, auto]);

  if (!url) return <p className="text-sm text-muted-foreground">Faltan parámetros (organigramaId, empleadoId).</p>;
  if (datos.error) return <p className="text-sm text-destructive">{datos.error}</p>;
  if (!d) return <p className="text-sm text-muted-foreground">Cargando acta…</p>;

  const raya = '____________________';
  return (
    <div className="mx-auto max-w-[760px] bg-white p-10 text-[13px] leading-relaxed text-[#111] print:p-0">
      <div className="no-print mb-4 flex justify-end">
        <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" /> Imprimir</Button>
      </div>
      <h1 className="text-lg font-bold uppercase">
        Acta de adhesión al recibo de haberes digital
        <small className="mt-1 block text-[11px] font-normal tracking-widest text-[#666]">Ley de Contrato de Trabajo, arts. 139 y 140 (texto según Ley 27.802) · Ley 25.506 de Firma Digital</small>
      </h1>
      <div className="my-4 border-y border-[#999] py-2">
        <b>Empleador:</b> {d.empresa.razonSocial || raya} · CUIT {d.empresa.cuit || '____________'}<br />
        <b>Trabajador:</b> {d.trabajador.nombre} · CUIL {d.trabajador.cuil || '____________'} · Categoría {d.trabajador.categoria || '—'}
      </div>
      <p>En {d.empresa.domicilio || '________________'}, a los ____ días del mes de __________ de ______, quien suscribe manifiesta:</p>
      <ol className="my-3 list-decimal space-y-1.5 pl-5">
        <li>Que acepta recibir sus recibos de haberes en formato digital, en reemplazo del ejemplar en papel, conforme lo habilita el art. 139 de la LCT.</li>
        <li>Que la constancia de recepción de cada recibo se instrumentará mediante firma electrónica (Ley 25.506, art. 5), consistente en el ingreso de un PIN personal, secreto e intransferible que el trabajador define y custodia, sobre el recibo identificado por su hash SHA-256.</li>
        <li>Que en cada oportunidad podrá firmar en conformidad o en disconformidad, dejando en este último caso las observaciones que estime pertinentes, sin que ello implique renuncia a derecho alguno.</li>
        <li>Que podrá acceder, descargar e imprimir sus recibos y constancias en cualquier momento, y que el empleador los conservará en formato digital por los plazos legales (2 años laboral / 10 años previsional, art. 143 LCT).</li>
        <li>Que la firma electrónica del PIN tiene el mismo valor que su firma ológrafa a los fines del art. 138 de la LCT, y que podrá revocar esta adhesión comunicándolo por escrito al empleador.</li>
      </ol>
      <div className="mt-16 flex justify-between text-[11px] text-[#555]">
        <div className="w-[42%] border-t border-[#555] pt-1 text-center">Firma y aclaración del trabajador</div>
        <div className="w-[42%] border-t border-[#555] pt-1 text-center">Firma del empleador</div>
      </div>
    </div>
  );
}
