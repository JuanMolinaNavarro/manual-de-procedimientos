'use client';

/**
 * Configuración de la temporada: lo que se ajusta una o dos veces por año, en secciones con un menú
 * a la izquierda (`?tab=configuracion&sec=`). Los parámetros se guardan juntos con un solo botón;
 * áreas, cierres y el cierre de temporada se guardan al momento.
 */

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import AreasTab from './AreasTab';
import AuditoriaTab from './AuditoriaTab';
import ParametrosTab from './ParametrosTab';
import type { PropsTab } from './VacacionesPage';

const SECCIONES = [
  ['temporada', 'Temporada y fechas'],
  ['turnos', 'Turnos para elegir'],
  ['dividir', 'Cómo se pueden dividir'],
  ['areas', 'Áreas'],
  ['cierres', 'Cierres de la empresa'],
  ['convenios', 'Convenios'],
  ['historial', 'Historial de cambios'],
  ['cerrar', 'Cerrar la temporada'],
] as const;

export default function ConfiguracionTab(props: PropsTab & { seccion: string }) {
  const actual = SECCIONES.find(([k]) => k === props.seccion) ?? SECCIONES[0];
  const sec = actual[0];
  return (
    <div className="flex flex-wrap items-start gap-6 text-base">
      <nav aria-label="Secciones de configuración" className="flex flex-[1_1_17rem] flex-col gap-0.5 rounded-xl border border-border bg-card p-2.5 shadow-sm lg:sticky lg:top-4">
        {SECCIONES.map(([k, label], i) => (
          <button
            key={k}
            type="button"
            aria-current={sec === k ? 'page' : undefined}
            onClick={() => props.irA('configuracion', `&sec=${k}`)}
            className={cn(
              'flex min-h-12 items-center gap-3 rounded-lg px-3.5 text-left text-base font-medium transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
              sec === k && 'bg-muted font-bold',
            )}
          >
            <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm', sec === k ? 'bg-primary text-primary-foreground' : 'bg-secondary')}>{i + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      <Card className="min-w-0 flex-[999_1_36rem] gap-6 px-6 py-6">
        <h2 className="text-[22px] leading-[30px] font-bold">{actual[1]}</h2>
        {/* Siempre montado: guarda el borrador mientras se recorren las secciones. */}
        <ParametrosTab key={props.E.config.ejercicio} {...props} seccion={sec} />
        {sec === 'areas' && <AreasTab {...props} />}
        {sec === 'historial' && <AuditoriaTab {...props} />}
      </Card>
    </div>
  );
}
