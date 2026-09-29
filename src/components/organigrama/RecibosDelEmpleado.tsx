'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { fechaHora, money, periodLabel } from '@/lib/nomina-calc';
import type { ReciboDeEmpleado } from '@/lib/nomina';

export interface EstadoRecibosEmpleado {
  /** null mientras carga. */
  recibos: ReciboDeEmpleado[] | null;
  error: string;
}

/**
 * Recibos de sueldo de una persona: los PDF oficiales de Finnegans con su estado de
 * firma. Vive en el modal y no en la pestaña porque el resultado decide si la
 * pestaña se muestra.
 */
export function useRecibosDeEmpleado(empleadoId: number | null, activo: boolean): EstadoRecibosEmpleado {
  const [cache, setCache] = useState<{ id: number; datos: ReciboDeEmpleado[] } | null>(null);
  const [fallo, setFallo] = useState<{ id: number; msg: string } | null>(null);

  useEffect(() => {
    if (!activo || !empleadoId) return;
    let vigente = true;
    fetch(`/api/admin/organigrama/empleados/${empleadoId}/recibos`)
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudieron cargar los recibos');
        return (await res.json()) as ReciboDeEmpleado[];
      })
      .then((datos) => { if (vigente) setCache({ id: empleadoId, datos }); })
      .catch((e) => { if (vigente) setFallo({ id: empleadoId, msg: e instanceof Error ? e.message : 'Error al cargar' }); });
    return () => { vigente = false; };
  }, [empleadoId, activo]);

  if (!empleadoId) return { recibos: [], error: '' };
  return {
    recibos: cache?.id === empleadoId ? cache.datos : null,
    error: fallo?.id === empleadoId ? fallo.msg : '',
  };
}

export default function RecibosDelEmpleado({ recibos, error }: EstadoRecibosEmpleado & { empleadoId: number }) {
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (recibos === null) return <p className="text-sm text-muted-foreground">Cargando recibos…</p>;
  if (recibos.length === 0) return <p className="text-sm text-muted-foreground">Sin recibos publicados todavía.</p>;

  return (
    <div className="max-h-[350px] space-y-2 overflow-y-auto pr-1.5">
      {recibos.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
          <div className="min-w-0">
            <a
              href={`/api/admin/nomina/firma/recibos/${r.id}/pdf`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 font-medium hover:underline"
            >
              {periodLabel(r.periodo)}
              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
            </a>
            <p className="font-mono text-[11px] text-muted-foreground">
              {r.organigramaNombre} · {r.tipoLiquidacion}
              {r.constancia ? ` · firmado ${fechaHora(r.constancia.fecha)}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="font-mono text-sm tabular-nums">{money(r.neto)}</span>
            {r.constancia
              ? <Badge className={r.constancia.conformidad === 'conforme' ? 'bg-emerald-600 text-white hover:bg-emerald-600' : 'bg-amber-600 text-white hover:bg-amber-600'}>{r.constancia.conformidad === 'conforme' ? 'Conforme' : 'Disconforme'}</Badge>
              : r.estado === 'papel'
                ? <Badge className="bg-sky-700 text-white hover:bg-sky-700">En papel</Badge>
                : <Badge variant="outline">Sin firmar</Badge>}
          </div>
        </div>
      ))}
    </div>
  );
}
