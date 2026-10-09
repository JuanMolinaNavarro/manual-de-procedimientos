'use client';

/**
 * Documentos de vacaciones para imprimir y firmar en papel:
 * - `tipo=notificacion`: la comunicación escrita de la fecha de inicio (art. 154 LCT, 30 días o
 *   más de anticipación) con la constancia de recepción.
 * - `tipo=fraccionamiento`: el acuerdo de partes para partirlas en tramos de 7 días o más.
 * `auto=0` lo muestra sin abrir el diálogo de impresión.
 *
 * ⚠️ TEXTO SUJETO A REVISIÓN DEL ASESOR LABORAL.
 */

import '@/components/nomina/nomina.css';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mensajeError, nominaFetch } from '@/components/nomina/api';
import { sumarDias } from '@/lib/asistencia-datos';
import { formatoCuit } from '@/lib/recibos-finnegans-calc';
import { fmtD, noReprog, type Tramo } from '@/lib/vacaciones-calc';
import type { VistaRespuesta } from '@/lib/vacaciones';

function TablaTramos({ tramos }: { tramos: Tramo[] }) {
  return (
    <table className="my-4 w-full border-collapse text-sm">
      <thead>
        <tr>{['Desde', 'Hasta', 'Días corridos', 'Reintegro'].map((h) => <th key={h} className="border border-neutral-400 px-2 py-1 text-left">{h}</th>)}</tr>
      </thead>
      <tbody>
        {tramos.map((t) => (
          <tr key={t.desde}>
            <td className="border border-neutral-400 px-2 py-1">{fmtD(t.desde)}</td>
            <td className="border border-neutral-400 px-2 py-1">{fmtD(t.hasta)}</td>
            <td className="border border-neutral-400 px-2 py-1">{t.dias}{t.fueraTemp ? ' *' : ''}</td>
            <td className="border border-neutral-400 px-2 py-1">{fmtD(sumarDias(t.hasta, 1))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function DocumentoVacaciones({ modo }: { modo: 'portal' | 'rrhh' }) {
  const sp = useSearchParams();
  const tipo = sp.get('tipo') === 'fraccionamiento' ? 'fraccionamiento' : 'notificacion';
  const empleadoId = sp.get('empleadoId');
  const url = modo === 'portal' ? '/api/admin/mis-vacaciones' : empleadoId ? `/api/admin/vacaciones/seleccion/${empleadoId}` : null;
  const auto = sp.get('auto') !== '0';
  const [v, setV] = useState<VistaRespuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const impreso = useRef(false);

  useEffect(() => {
    if (!url) return;
    nominaFetch<VistaRespuesta>(url).then(setV).catch((e: unknown) => setError(mensajeError(e)));
  }, [url]);

  useEffect(() => {
    if (!v || !auto || impreso.current) return;
    impreso.current = true;
    const id = setTimeout(() => window.print(), 300);
    return () => clearTimeout(id);
  }, [v, auto]);

  if (!url) return <p className="text-sm text-muted-foreground">Falta el parámetro empleadoId.</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!v) return <p className="text-sm text-muted-foreground">Cargando documento…</p>;

  const s = v.sol, e = v.empleado;
  const empresa = v.empleador?.nombre ?? 'la empresa';
  const convenio = v.convenio.codigo !== 'LCT' ? ` y al ${v.convenio.nombre}` : '';
  const fecha = tipo === 'notificacion' ? (s.notificacion?.fecha ?? v.hoy) : (s.acuerdoFracc?.fecha ?? v.hoy);
  // La notificación lleva los tramos elegidos y los cierres colectivos. Las reprogramaciones por
  // interrupción (art. 154) van aparte: se agregan después de la notificación original.
  const tramos = tipo === 'notificacion'
    ? [...noReprog(s), ...v.cierres].sort((a, b) => a.desde.localeCompare(b.desde))
    : noReprog(s);
  const reprogramados = tipo === 'notificacion' ? s.tramos.filter((t) => t.reprog && t.estadoTramo === 'aprobado') : [];
  const fueraTemp = tramos.some((t) => t.fueraTemp);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="no-print flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Imprimilo en dos copias: una para la persona y otra, firmada, para el legajo.</p>
        <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir</Button>
      </div>

      <article className="rounded-md border border-neutral-300 bg-white p-8 text-[14px] leading-relaxed text-neutral-900 print:border-0 print:p-0">
        <h1 className="text-lg font-bold">{tipo === 'notificacion' ? 'Notificación de vacaciones anuales' : 'Acuerdo de fraccionamiento de vacaciones'}</h1>
        <p className="mb-5 font-mono text-xs text-neutral-500">
          {empresa}{v.empleador ? ` · CUIT ${formatoCuit(v.empleador.cuit)}` : ''} · {fmtD(fecha)} · ejercicio {v.ejercicio}
        </p>

        {tipo === 'notificacion' ? (
          <>
            <p>
              Se notifica a <b>{e.nombre}</b> ({e.rol}, {e.area}) que gozará de sus vacaciones anuales correspondientes al ejercicio{' '}
              {v.ejercicio} ({v.dias.total} días corridos) en los siguientes períodos:
            </p>
            <TablaTramos tramos={tramos} />
            {fueraTemp && <p className="text-sm">* Período fuera del 1° de octubre al 30 de abril, acordado de mutuo acuerdo (art. 154 LCT).</p>}
            <p className="mt-3">
              La presente se comunica por escrito con una antelación no menor a {v.avisoDias} días respecto del inicio, conforme al art. 154 de
              la Ley de Contrato de Trabajo (texto según Ley 27.802){convenio}. La retribución correspondiente se abonará al comienzo del
              período (art. 155 LCT).
            </p>
            {s.acuerdoFracc && <p className="mt-3">El fraccionamiento en tramos fue acordado por las partes el {fmtD(s.acuerdoFracc.fecha)}.</p>}
            {reprogramados.length > 0 && (
              <>
                <p className="mt-3">
                  Los días no gozados por la interrupción de las vacaciones ({s.interrupciones.map((i) => `${fmtD(i.desde)} al ${fmtD(i.hasta)}`).join('; ')}) se
                  reprograman, conforme al art. 154 LCT, en:
                </p>
                <TablaTramos tramos={reprogramados} />
              </>
            )}
          </>
        ) : (
          <>
            <p>
              Entre <b>{empresa}</b> y <b>{e.nombre}</b> se conviene, en los términos del art. 154 de la Ley de Contrato de Trabajo (texto
              según Ley 27.802), fraccionar las vacaciones del ejercicio {v.ejercicio} ({v.dias.total} días corridos) en los siguientes tramos,
              ninguno inferior a siete (7) días:
            </p>
            <TablaTramos tramos={tramos} />
            <p>
              El trabajador presta su conformidad libre y expresamente. Cada fecha de inicio se le notificará por escrito con la anticipación
              legal. Cualquier modificación posterior de los tramos requiere un nuevo acuerdo.
            </p>
          </>
        )}

        <div className="mt-16 flex gap-10 text-center text-xs">
          <div className="flex-1 border-t border-neutral-800 pt-1.5">Por la empresa · firma y aclaración</div>
          <div className="flex-1 border-t border-neutral-800 pt-1.5">{e.nombre} · firma, aclaración y fecha</div>
        </div>
      </article>
    </div>
  );
}
