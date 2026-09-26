'use client';

/**
 * Disconformidades abiertas: cada firma en disconformidad abre un caso para RR.HH.
 * (reunión con el trabajador, ajuste en la próxima liquidación, etc.). La
 * constancia firmada nunca se modifica: la resolución se anota en el caso.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { fechaHora, periodLabel } from '@/lib/nomina-calc';
import type { CasoView } from '@/lib/recibos-finnegans';
import { mensajeError, nominaFetch } from './api';
import { Empty } from './ui';

export default function CasosDisconformidad({ casos, onCambio }: { casos: CasoView[] | null; onCambio: () => void }) {
  const [notas, setNotas] = useState<Record<number, string>>({});
  const [ocupado, setOcupado] = useState<number | null>(null);

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

  if (!casos) return null;
  if (!casos.length) {
    return (
      <Empty title="No hay disconformidades abiertas">
        Cuando alguien firme un recibo en disconformidad, su caso aparece acá para coordinar la revisión.
      </Empty>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Firmar en disconformidad no es negarse a recibir: la entrega está cumplida. Coordiná la revisión con el trabajador y anotá
        cómo se resolvió. La constancia firmada no se modifica.
      </p>
      {casos.map((c) => (
        <div key={c.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-semibold text-foreground">{c.nombre}</span>
            <span className="text-sm text-muted-foreground">{periodLabel(c.periodo)} · {c.tipoLiquidacion}</span>
            <span className="ml-auto text-xs text-muted-foreground">firmó {fechaHora(c.firmadoEn)}</span>
          </div>
          <blockquote className="border-l-4 border-amber-500 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
            {c.observaciones}
          </blockquote>
          <Textarea
            value={notas[c.id] ?? c.notas}
            onChange={(e) => setNotas((n) => ({ ...n, [c.id]: e.target.value }))}
            placeholder="Notas de RR.HH.: reunión, respuesta, ajuste…"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" disabled={ocupado === c.id} onClick={() => guardar(c, false)}>Guardar notas</Button>
            <Button size="sm" disabled={ocupado === c.id} onClick={() => guardar(c, true)}>Marcar resuelto</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
