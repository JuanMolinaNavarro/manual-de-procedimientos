'use client';

/**
 * Recibos (`/admin/mis-recibos`): los recibos de sueldo del usuario de la sesión (los PDF
 * oficiales que emite Finnegans), pensado para el celular. Arriba lo que falta firmar; cada
 * recibo abre `/admin/mis-recibos/[id]`, donde se ve y se firma con el PIN. Abajo, el PIN de
 * firma. La ficha sale de la sesión: nunca se pide un id.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Banner, Empty } from '@/components/comunes/ui';
import { fmtMes } from '@/lib/asistencia-calendario';
import type { MiAdhesionView } from '@/lib/nomina';
import type { MiReciboView } from '@/lib/recibos-finnegans';
import { cn } from '@/lib/utils';
import { nominaFetch, mensajeError } from './api';
import MiPinFirma from './MiPinFirma';

type Respuesta =
  | { vinculado: false; usuario: string }
  | { vinculado: true; empleado: { id: number; nombre: string }; recibos: MiReciboView[]; adhesion: MiAdhesionView };

const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const pendiente = (r: MiReciboView) => r.entrega === 'pendiente' || r.entrega === 'no_retirado';

function Estado({ r }: { r: MiReciboView }) {
  const [texto, clase] = r.entrega === 'firmado'
    ? [r.firma?.conformidad === 'disconforme' ? 'Firmado disconforme' : 'Firmado', 'text-emerald-600 dark:text-emerald-400']
    : r.entrega === 'papel' ? ['En papel', 'text-sky-700 dark:text-sky-400']
    : ['Para firmar', 'text-amber-600 dark:text-amber-400'];
  return <span className={cn('text-xs font-semibold', clase)}>{texto}</span>;
}

export default function MisRecibosPage() {
  const [data, setData] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    nominaFetch<Respuesta>('/api/admin/mis-recibos')
      .then((d) => setData(d))
      .catch((e: unknown) => setError(mensajeError(e)));
  }, [version]);

  const v = data?.vinculado ? data : null;
  const puedeFirmar = v?.adhesion.estado === 'completa';
  const porFirmar = v ? v.recibos.filter(pendiente) : [];
  const nombre = v?.empleado.nombre.split(/\s+/)[0];

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Inicio
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mis recibos</h1>
        {nombre && <p className="mt-1 text-sm text-muted-foreground">Hola, {nombre}. Acá están tus recibos de sueldo, tal como los emite la empresa.</p>}
      </div>

      {error && <Banner variant="warn">{error}</Banner>}

      {!data && !error && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      )}

      {data && !data.vinculado && (
        <Empty title="Tu usuario no está vinculado a una ficha">
          Para ver tus recibos, un administrador tiene que vincular la cuenta{' '}
          <span className="font-medium text-foreground">{data.usuario}</span> con tu ficha del organigrama.
        </Empty>
      )}

      {v && porFirmar.length > 0 && puedeFirmar && (
        <div className="flex items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <PenLine className="h-6 w-6 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">
              {porFirmar.length === 1 ? 'Tenés 1 recibo para firmar' : `Tenés ${porFirmar.length} recibos para firmar`}
            </p>
            <p className="text-sm text-muted-foreground">Leelo y firmalo con tu PIN. Te lleva un minuto.</p>
          </div>
          <Button asChild size="sm"><Link href={`/admin/mis-recibos/${porFirmar[0].id}`}>Firmar</Link></Button>
        </div>
      )}

      {v && porFirmar.length > 0 && !puedeFirmar && (
        <Banner>
          {v.adhesion.estado === 'sin_adhesion'
            ? 'Podés ver y descargar tus recibos. Para firmarlos desde acá primero tenés que adherir al recibo digital: acercate a RR.HH.'
            : 'Podés ver y descargar tus recibos. Vas a poder firmarlos cuando RR.HH. termine de cargar tu adhesión.'}
        </Banner>
      )}

      {v && v.recibos.length === 0 && (
        <Empty title="Todavía no tenés recibos">
          Cuando RR.HH. publique la liquidación, tu recibo aparece acá y te llega un aviso por mail.
        </Empty>
      )}

      {v && v.recibos.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {v.recibos.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/mis-recibos/${r.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold capitalize text-foreground">
                    {fmtMes(r.periodo)}
                    {!r.accedidoEn && <span className="h-2 w-2 rounded-full bg-primary" aria-label="Nuevo" />}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{r.tipoLiquidacion}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium tabular-nums text-foreground">{pesos.format(r.neto)}</p>
                  <Estado r={r} />
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Sin adhesión y con recibos, el aviso de arriba ya lo explica: no repetirlo. */}
      {v && (v.adhesion.estado !== 'sin_adhesion' || porFirmar.length === 0) && (
        <MiPinFirma adhesion={v.adhesion} onCambio={() => setVersion((n) => n + 1)} />
      )}
    </div>
  );
}
