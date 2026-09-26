'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, MessageSquareWarning } from 'lucide-react';
import { fechaHora } from '@/lib/nomina-calc';
import type { ConstanciaView } from '@/lib/nomina';
import { cn } from '@/lib/utils';

function Fila({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9.5rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:pt-0.5">{label}</dt>
      <dd className={cn('min-w-0 text-foreground', mono && 'break-all font-mono text-[11px] leading-relaxed')}>{children}</dd>
    </div>
  );
}

/**
 * Constancia de recepción y firma electrónica de un recibo PDF de Finnegans: quién, cuándo,
 * desde dónde y sobre qué documento (hash) firmó. `hashOk`: resultado de verificar el PDF
 * contra el hash firmado.
 */
export default function ConstanciaCard({ constancia: c, hashOk }: { constancia: ConstanciaView; hashOk?: boolean | null }) {
  const conforme = c.conformidad === 'conforme';
  const Icono = conforme ? CheckCircle2 : MessageSquareWarning;
  return (
    <div className={cn('space-y-4 rounded-xl border border-l-4 border-border bg-card p-4 text-sm', conforme ? 'border-l-emerald-600' : 'border-l-amber-500')}>
      <div className="flex items-start gap-2.5">
        <Icono className={cn('mt-0.5 h-5 w-5 shrink-0', conforme ? 'text-emerald-600' : 'text-amber-500')} />
        <div>
          <p className="font-semibold text-foreground">Constancia de recepción y firma electrónica</p>
          <p className="text-muted-foreground">Firmado {conforme ? 'en conformidad' : 'en disconformidad'} el {fechaHora(c.fecha)}</p>
        </div>
      </div>
      <dl className="space-y-2.5">
        <Fila label="Firmante">{c.firmante.nombre} · CUIL {c.firmante.cuil || '—'}</Fila>
        <Fila label="Identidad">PIN personal{c.firmante.adhesion ? ` · adhesión ${c.firmante.adhesion}` : ''}</Fila>
        <Fila label="Desde">
          {c.canal === 'portal' ? 'Portal del empleado' : c.canal}{c.ip ? ` · IP ${c.ip}` : ''}
          {c.dispositivo && <span className="block break-all text-xs text-muted-foreground">{c.dispositivo}</span>}
        </Fila>
        {c.observaciones && <Fila label="Observaciones">«{c.observaciones}»</Fila>}
        <Fila label="Fecha exacta" mono>{c.fecha}</Fila>
        <Fila label="Recibo (SHA-256)" mono>{c.hash}</Fila>
        <Fila label="Encadenado" mono>{c.chainHash}</Fila>
      </dl>
      {hashOk != null && (
        <p className={cn('rounded-md px-3 py-2 text-sm', hashOk ? 'bg-emerald-500/10' : 'bg-red-500/10 text-red-700 dark:text-red-300')}>
          {hashOk
            ? 'El PDF del recibo coincide con el hash firmado: el documento no fue alterado.'
            : 'El PDF del recibo NO coincide con el hash firmado.'}
        </p>
      )}
    </div>
  );
}
