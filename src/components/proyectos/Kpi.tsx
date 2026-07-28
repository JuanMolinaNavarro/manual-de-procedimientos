'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import InfoHint from './InfoHint';

export type TonoKpi = 'neutro' | 'ok' | 'alerta' | 'malo';

const TONO: Record<TonoKpi, string> = {
  neutro: 'text-foreground',
  ok: 'text-emerald-600 dark:text-emerald-400',
  alerta: 'text-amber-600 dark:text-amber-400',
  malo: 'text-red-600 dark:text-red-400',
};

interface KpiProps {
  titulo: string;
  valor: React.ReactNode;
  sufijo?: string;
  nota?: React.ReactNode;
  tono?: TonoKpi;
  /** Clave de AYUDA para el icono "i". */
  ayuda?: string;
  className?: string;
}

export default function Kpi({
  titulo,
  valor,
  sufijo,
  nota,
  tono = 'neutro',
  ayuda,
  className,
}: KpiProps) {
  return (
    <Card className={cn('gap-0 py-4', className)}>
      <CardContent className="px-4">
        <div className="flex items-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <span>{titulo}</span>
          {ayuda && <InfoHint k={ayuda} />}
        </div>
        <p className={cn('mt-1.5 font-mono text-2xl font-semibold leading-tight', TONO[tono])}>
          {valor}
          {sufijo && <span className="ml-1 text-sm text-muted-foreground">{sufijo}</span>}
        </p>
        {nota && <p className="mt-1.5 text-xs text-muted-foreground">{nota}</p>}
      </CardContent>
    </Card>
  );
}
