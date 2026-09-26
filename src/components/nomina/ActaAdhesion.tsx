'use client';

/**
 * Acta de adhesión al recibo digital, para imprimir y firmar en papel (dos copias:
 * trabajador y empresa). Es el acto único que respalda todas las firmas electrónicas
 * posteriores: el código de adhesión impreso la ata con el registro del sistema.
 * Una vez firmada se escanea y se sube en la fila del trabajador; recién ahí la
 * adhesión queda completa y habilita la firma desde el portal (usuario personal + PIN).
 *
 * ⚠️ TEXTO SUJETO A REVISIÓN DEL ASESOR LABORAL (`ACTA_VERSION`, `clausulas`).
 */

import './nomina.css';
import { Fragment, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ActaDatos } from '@/lib/nomina';
import { fechaHora } from '@/lib/nomina-calc';
import { DIAS_NO_RETIRADO } from '@/lib/recibos-finnegans-calc';
import { useNominaData } from './NominaContext';

export const ACTA_VERSION = 'acta-v4';

function clausulas(empresa: string, email: string | null): string[] {
  return [
    'Que acepta recibir sus recibos de haberes en formato digital, conforme lo habilita el art. 139 de la Ley de Contrato de Trabajo (texto según Ley 27.802).',
    'Que la constancia de entrega de cada recibo se instrumentará mediante firma electrónica (Ley 25.506, art. 5), que consiste en ingresar al portal de la empresa con su usuario personal, desde cualquier dispositivo, y confirmar con un PIN personal y secreto elegido por el trabajador, sobre el recibo identificado por su hash SHA-256.',
    `Que declara como dirección de correo electrónico para recibir los avisos de recibos disponibles la siguiente: ${email || '________________________________'}. Los avisos no incluyen los recibos ni sus importes. Se obliga a informar a Recursos Humanos cualquier cambio de esa dirección.`,
    'Que se obliga a no divulgar su PIN. Puede cambiarlo cuando lo desee desde el portal de la empresa, ingresando su PIN actual; Recursos Humanos no puede cambiarlo ni conocerlo. Si lo olvida o cree que otra persona pudo conocerlo, deberá avisar a Recursos Humanos y renovar esta adhesión en forma presencial, con una nueva acta.',
    'Que en cada oportunidad podrá firmar en conformidad o en disconformidad, dejando en este último caso sus observaciones. Firmar no implica renuncia a derecho alguno (arts. 12 y 260 LCT).',
    `Que sus recibos quedan a su disposición en el portal de la empresa desde su publicación, lo que se le avisará al correo declarado. Si no los firma dentro de los ${DIAS_NO_RETIRADO} días del aviso, se le entregarán en papel para su firma. Su silencio no implica conformidad (art. 58 LCT).`,
    'Que podrá ver, descargar e imprimir sus recibos y constancias en cualquier momento, y que el empleador los conservará por los plazos legales (art. 143 LCT).',
    `Que fue informado de que sus datos personales y de remuneración son tratados por ${empresa || 'el empleador'} con la finalidad de liquidar, entregar y conservar sus recibos; que no se comunican a terceros salvo obligación legal; y que puede ejercer sus derechos de acceso, rectificación y supresión ante el empleador (Ley 25.326, art. 6).`,
    'Que podrá revocar esta adhesión comunicándolo por escrito al empleador. Desde entonces recibirá sus recibos en papel.',
  ];
}

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
  const copias = ['Ejemplar para el trabajador', 'Ejemplar para la empresa'];
  return (
    <div className="mx-auto max-w-[760px] bg-white text-[12.5px] leading-relaxed text-[#111]">
      <div className="no-print mb-4 flex items-center justify-between gap-3 p-4">
        {!d.adhesion && <p className="text-sm text-amber-700">El trabajador todavía no adhirió: el acta sale sin código de adhesión.</p>}
        <Button variant="outline" className="ml-auto" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" /> Imprimir (2 copias)</Button>
      </div>
      {copias.map((copia, i) => (
        <Fragment key={copia}>
          <section className="p-10 print:p-0" style={i > 0 ? { breakBefore: 'page' } : undefined}>
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-lg font-bold uppercase">
                Acta de adhesión al recibo de haberes digital
                <small className="mt-1 block text-[11px] font-normal tracking-widest text-[#666]">
                  LCT arts. 139 y 140 (texto según Ley 27.802) · Ley 25.506, art. 5 · Ley 25.326
                </small>
              </h1>
              <div className="shrink-0 text-right text-[11px] text-[#555]">
                <div className="font-mono text-[13px] font-bold text-[#111]">{d.adhesion?.codigo ?? 'ADH-__________'}</div>
                <div>{d.adhesion ? `Adhesión registrada ${fechaHora(d.adhesion.creadaEn)}` : 'Sin adhesión registrada'}</div>
                <div>{copia} · {ACTA_VERSION}</div>
              </div>
            </div>
            <div className="my-4 border-y border-[#999] py-2">
              <b>Empleador:</b> {d.empresa.razonSocial || raya} · CUIT {d.empresa.cuit || '____________'} · {d.empresa.domicilio || raya}<br />
              <b>Trabajador:</b> {d.trabajador.nombre} · CUIL {d.trabajador.cuil || '____________'} · Categoría {d.trabajador.categoria || '—'}
            </div>
            <p>En {d.empresa.domicilio || '________________'}, a los ____ días del mes de __________ de ______, quien suscribe manifiesta:</p>
            <ol className="my-3 list-decimal space-y-1.5 pl-5">
              {clausulas(d.empresa.razonSocial, d.adhesion?.email ?? null).map((c) => <li key={c}>{c}</li>)}
            </ol>
            <p className="text-[11px] text-[#555]">
              El código {d.adhesion?.codigo ?? 'de adhesión'} identifica este acto en el sistema. El PIN no figura en este documento ni se
              guarda: el sistema solo conserva un resumen criptográfico que permite verificarlo.
            </p>
            <div className="mt-14 grid grid-cols-2 gap-10 text-[11px] text-[#555]">
              <div>
                <div className="border-t border-[#555] pt-1 text-center">Firma del trabajador</div>
                <div className="mt-6 border-t border-[#555] pt-1 text-center">Aclaración y DNI</div>
              </div>
              <div>
                <div className="border-t border-[#555] pt-1 text-center">Firma del representante del empleador</div>
                <div className="mt-6 border-t border-[#555] pt-1 text-center">Aclaración y cargo</div>
              </div>
            </div>
            <p className="no-print mt-6 text-[10px] uppercase tracking-widest text-[#999]">Texto sujeto a revisión del asesor laboral</p>
          </section>
        </Fragment>
      ))}
    </div>
  );
}
