'use client';

/**
 * Disconformidades: cada firma en disconformidad abre un caso para RR.HH. (reunión con el
 * trabajador, ajuste en la próxima liquidación, etc.). La constancia firmada nunca se
 * modifica: la resolución se anota en el caso. Los resueltos se consultan aparte y sus notas ya
 * no se editan (son el registro de cómo se resolvió).
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { fechaHora, periodLabel } from '@/lib/nomina-calc';
import type { CasoView } from '@/lib/recibos-finnegans';
import { cn } from '@/lib/utils';
import { mensajeError, nominaFetch } from './api';
import { useNominaData } from './NominaContext';
import { Empty, ErrorCarga } from './ui';

function Encabezado({ c }: { c: CasoView }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-semibold text-foreground">{c.nombre}</span>
        <span className="text-sm text-muted-foreground">{c.empresa} · {periodLabel(c.periodo)} · {c.tipoLiquidacion}</span>
        <span className="ml-auto text-xs text-muted-foreground">firmó {fechaHora(c.firmadoEn)}</span>
      </div>
      <blockquote className="border-l-4 border-amber-500 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
        {c.observaciones}
      </blockquote>
    </>
  );
}

function Resueltos({ filtros }: { filtros: string }) {
  const q = useNominaData<CasoView[]>(`/api/admin/nomina/firma/casos?estado=resuelto${filtros ? `&${filtros}` : ''}`);
  if (q.error && !q.data) return <ErrorCarga error={q.error} onReintentar={q.reload} />;
  if (!q.data) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!q.data.length) return <Empty title="Todavía no hay casos resueltos" />;
  return (
    <div className="space-y-3">
      {q.data.map((c) => (
        <div key={c.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
          <Encabezado c={c} />
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Resuelto{c.resueltoEn ? ` el ${fechaHora(c.resueltoEn)}` : ''}{c.resueltoPor ? ` por ${c.resueltoPor}` : ''}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-foreground">{c.notas}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** `filtros`: query string con los filtros de la página (empleador, lugar), para los resueltos. */
export default function CasosDisconformidad({ casos, filtros, onCambio }: { casos: CasoView[] | null; filtros: string; onCambio: () => void }) {
  const [notas, setNotas] = useState<Record<number, string>>({});
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [vista, setVista] = useState<'abiertos' | 'resueltos'>('abiertos');

  async function guardar(c: CasoView, resolver: boolean) {
    setOcupado(c.id);
    try {
      await nominaFetch(`/api/admin/nomina/firma/casos/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ notas: notas[c.id] ?? c.notas, resolver }),
      });
      toast.success(resolver ? 'Caso resuelto' : 'Notas guardadas');
      onCambio();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setOcupado(null);
    }
  }

  const selector = (
    <div className="flex gap-1.5" role="tablist" aria-label="Estado de los casos">
      {(['abiertos', 'resueltos'] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={vista === v}
          onClick={() => setVista(v)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            vista === v ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground',
          )}
        >
          {v === 'abiertos' ? `Abiertos${casos ? ` (${casos.length})` : ''}` : 'Resueltos'}
        </button>
      ))}
    </div>
  );

  if (vista === 'resueltos') {
    return <div className="space-y-3">{selector}<Resueltos filtros={filtros} /></div>;
  }
  if (!casos) return <div className="space-y-3">{selector}</div>;
  if (!casos.length) {
    return (
      <div className="space-y-3">
        {selector}
        <Empty title="No hay disconformidades abiertas">
          Cuando alguien firme un recibo en disconformidad, su caso aparece acá para coordinar la revisión.
        </Empty>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {selector}
      <p className="text-sm text-muted-foreground">
        Firmar en disconformidad no es negarse a recibir: la entrega está cumplida. Coordiná la revisión con el trabajador y anotá
        cómo se resolvió. La constancia firmada no se modifica.
      </p>
      {casos.map((c) => (
        <div key={c.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
          <Encabezado c={c} />
          <div className="space-y-1.5">
            <Label htmlFor={`notas-${c.id}`} className="text-xs text-muted-foreground">Notas de RR.HH.</Label>
            <Textarea
              id={`notas-${c.id}`}
              value={notas[c.id] ?? c.notas}
              onChange={(e) => setNotas((n) => ({ ...n, [c.id]: e.target.value }))}
              placeholder="Reunión, respuesta, ajuste…"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" disabled={ocupado === c.id} onClick={() => guardar(c, false)}>Guardar notas</Button>
            <Button size="sm" disabled={ocupado === c.id} onClick={() => guardar(c, true)}>Marcar resuelto</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
