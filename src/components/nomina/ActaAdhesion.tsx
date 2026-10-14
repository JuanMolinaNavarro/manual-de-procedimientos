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
import { DIAS_PARA_FIRMAR } from '@/lib/recibos-finnegans-calc';
import { useNominaData } from './NominaContext';

export const ACTA_VERSION = 'acta-v6';

const EMPLEADOR_GENERICO = '(empresa que paga el sueldo)';

function clausulas(empresa: { razonSocial: string; cuit: string }, email: string | null): string[] {
  const empleador = empresa.razonSocial
    ? `${empresa.razonSocial}${empresa.cuit ? `, CUIT ${empresa.cuit}` : ''}`
    : EMPLEADOR_GENERICO;
  return [
    'Que acepta recibir sus recibos de haberes en formato digital, conforme lo habilita el art. 139 de la Ley de Contrato de Trabajo (texto según Ley 27.802). Esta adhesión es voluntaria: no adherir no tiene consecuencia alguna en la relación laboral y, en ese caso, recibirá sus recibos en papel.',
    'Que la constancia de entrega de cada recibo se instrumentará mediante firma electrónica (Ley 25.506, art. 5), que consiste en ingresar al portal de la empresa con su usuario personal, desde cualquier dispositivo, y confirmar con un PIN personal y secreto elegido por el trabajador, sobre el recibo identificado por su hash SHA-256. Reconoce ese procedimiento como medio válido para expresar su firma a los fines de dejar constancia de la entrega (art. 139 LCT), y acepta que toda firma realizada con su usuario y su PIN le sea atribuida, salvo que antes hubiera avisado a Recursos Humanos que su PIN pudo ser conocido por otra persona.',
    'Que fue informado de que, por cada firma, el sistema registra la fecha y hora, la dirección IP y el dispositivo utilizados, la huella SHA-256 del recibo firmado, si dejó observaciones y un encadenamiento con la firma anterior del mismo empleador que permite detectar cualquier alteración; que esos registros integran la constancia de entrega y que podrá consultarlos en el portal o pedir copia en cualquier momento.',
    `Que declara como dirección de correo electrónico para recibir los avisos de recibos disponibles la siguiente: ${email || '________________________________'}. Los avisos no incluyen los recibos ni sus importes. Se obliga a informar a Recursos Humanos cualquier cambio de esa dirección. Si la dirección declarada fuera una casilla provista por el empleador, reconoce que su titularidad y administración corresponden a este; que los avisos recibidos quedarán almacenados en ella; y que, extinguida la relación laboral por cualquier causa, dejará de tener acceso a dicha casilla y a su contenido, lo que acepta expresamente, sin perjuicio de su derecho a requerir al empleador copia de sus recibos y constancias. En tal supuesto podrá declarar, en cualquier momento, una dirección personal para continuar recibiendo los avisos.`,
    'Que se obliga a no divulgar su PIN, que es personal e intransferible. Puede cambiarlo cuando lo desee desde el portal de la empresa, ingresando su PIN actual; Recursos Humanos no puede cambiarlo ni conocerlo. Si lo olvida o cree que otra persona pudo conocerlo, deberá avisar a Recursos Humanos y renovar esta adhesión en forma presencial, con una nueva acta.',
    'Que su firma de cada recibo constituye constancia de su recepción (arts. 138 a 140 LCT) y no implica conformidad con su contenido ni renuncia a derecho alguno (arts. 12 y 260 LCT). Si tuviera observaciones sobre un recibo, podrá comunicarlas a Recursos Humanos desde el mismo portal al firmarlo, donde quedarán registradas con fecha.',
    `Que sus recibos quedan a su disposición en el portal de la empresa desde su publicación, lo que se le avisará al correo declarado. El empleador conservará constancia del aviso, del acceso al recibo y de la acreditación del pago. Si no lo firma dentro de los ${DIAS_PARA_FIRMAR} días del aviso, Recursos Humanos podrá requerirle la firma por otro medio o entregárselo en papel para su firma. Su silencio no implica conformidad (art. 58 LCT).`,
    'Que podrá ver, descargar e imprimir sus recibos y constancias en cualquier momento, y que el empleador los conservará por los plazos legales (art. 143 LCT). A su pedido, y también al extinguirse la relación laboral, el empleador le entregará sin cargo copia de sus recibos y constancias.',
    `Que fue informado de que sus datos personales y de remuneración son tratados por ${empleador}, en su carácter de responsable, con la finalidad de liquidar, entregar y conservar sus recibos; que no se comunican a terceros salvo obligación legal; y que puede ejercer sus derechos de acceso, rectificación y supresión ante el empleador (Ley 25.326, art. 6), en el domicilio indicado en esta acta.`,
    'Que podrá revocar esta adhesión comunicándolo por escrito al empleador. Desde entonces recibirá sus recibos en papel. La revocación no afecta la validez de las firmas realizadas mientras la adhesión estuvo vigente.',
    'Que esta adhesión vale solo para los recibos que emita el empleador indicado en esta acta. Si pasara a liquidarle el sueldo otra empresa, deberá firmar una nueva acta.',
    'Que se firman dos ejemplares de un mismo tenor y a un solo efecto, y que recibe uno en este acto.',
  ];
}

export default function ActaAdhesion() {
  const sp = useSearchParams();
  const empleadoId = sp.get('empleadoId');
  const url = empleadoId ? `/api/admin/nomina/acta-datos?empleadoId=${empleadoId}` : null;
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

  if (!url) return <p className="text-sm text-muted-foreground">Falta el parámetro empleadoId.</p>;
  if (datos.error) return <p className="text-sm text-destructive">{datos.error}</p>;
  if (!d) return <p className="text-sm text-muted-foreground">Cargando acta…</p>;

  const raya = '____________________';
  const cuil = d.trabajador.cuil.replace(/\D/g, '');
  const dni = cuil.length === 11 ? String(Number(cuil.slice(2, 10))) : '';
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
                  LCT arts. 59, 138, 139, 140 y 143 (texto según Ley 27.802) · Ley 25.506, art. 5 · CCyCN arts. 287, 288, 314 y 319 · Res. 346/2019 · Ley 25.326
                </small>
              </h1>
              <dl className="shrink-0 space-y-1 text-right text-[11px] text-[#555] [&_dt]:text-[9.5px] [&_dt]:font-bold [&_dt]:uppercase [&_dt]:tracking-widest">
                <dt>Código de adhesión</dt>
                <dd className="font-mono text-[13px] font-bold text-[#111]">{d.adhesion?.codigo ?? 'ADH-__________'}</dd>
                <dt>Registrada</dt>
                <dd>{d.adhesion ? `${fechaHora(d.adhesion.creadaEn)} por ${d.adhesion.creadaPor ?? '—'}` : 'Sin adhesión registrada'}</dd>
                <dt>Ejemplar</dt>
                <dd>{copia} · {ACTA_VERSION}</dd>
              </dl>
            </div>
            <div className="my-4 border-y border-[#999] py-2">
              <b>Empleador:</b> {d.empresa.razonSocial || EMPLEADOR_GENERICO} · CUIT {d.empresa.cuit || '____________'} · {d.empresa.domicilio || raya}<br />
              <b>Trabajador:</b> {d.trabajador.nombre} · CUIL {d.trabajador.cuil || '____________'} · DNI {dni || '__________'} · Legajo {d.trabajador.legajo || '______'} · Categoría {d.trabajador.categoria || '__________'}
            </div>
            <p>En {d.empresa.domicilio || '________________'}, a los ____ días del mes de __________ de ______, quien suscribe manifiesta, en forma libre y voluntaria:</p>
            <ol className="my-3 list-decimal space-y-1.5 pl-5">
              {clausulas(d.empresa, d.adhesion?.email ?? null).map((c) => <li key={c}>{c}</li>)}
            </ol>
            <p className="text-[11px] text-[#555]">
              El código {d.adhesion?.codigo ?? 'de adhesión'} identifica este acto en el sistema. El PIN no figura en este documento ni se
              guarda: el sistema solo conserva un resumen criptográfico que permite verificarlo.
            </p>
            <p className="mt-2 text-[10.5px] text-[#555]">
              LA AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la
              atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por
              incumplimiento de las normas vigentes en materia de protección de datos personales.
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
            <p className="mt-6 text-[10px] uppercase tracking-widest text-[#999]">{ACTA_VERSION} · texto propuesto, sujeto a revisión del asesor laboral</p>
          </section>
        </Fragment>
      ))}
    </div>
  );
}
