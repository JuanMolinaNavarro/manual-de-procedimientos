'use client';

/**
 * Calendario anual tipo "contribuciones": una columna por semana, una fila por
 * día (lunes arriba, domingo abajo), cada celda con el color del estado del
 * día (`ESTILO_CELDA`, el mismo que la pestaña Calendario). Recibe los días
 * ya evaluados: acá no se calcula nada, solo se dibuja.
 *
 * `dias` y `celdas` van alineados por índice y tienen que empezar en lunes y
 * terminar en domingo (semanas enteras), que es lo que devuelve `miAsistencia`.
 */

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { fmtFechaDia, fmtHoraCorta } from '@/lib/asistencia-datos';
import { ESTADOS_DIA, fmtMes, totalesDe, type CeldaDia, type DiaCalendario } from '@/lib/asistencia-calendario';
import { ESTILO_CELDA, LEYENDA_ESTADOS } from './estilo-celda';

const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
/** Etiquetas de fila como GitHub: solo lunes, miércoles y viernes para no apretar. */
const FILAS_CON_LABEL: Record<number, string> = { 0: 'Lun', 2: 'Mié', 4: 'Vie' };
const CELDA = 13; // px
/** Descripciones para la propia persona: las de `ESTADOS_DIA` mencionan la tolerancia, que es interna de RRHH. */
const DESC_PERSONAL: Partial<Record<CeldaDia['estado'], string>> = {
  a_horario: 'Entraste a horario.',
  tarde: 'Entraste después de la hora pactada.',
  tarde_grave: 'Entraste con un atraso importante respecto de la hora pactada.',
};
const GAP = 3; // px

interface Props {
  dias: DiaCalendario[];
  celdas: CeldaDia[];
  /** Mes yyyy-mm que está abierto abajo: sus celdas se marcan apenas. */
  mesActivo?: string;
  onVerMes?: (mes: string) => void;
}

export default function CalendarioAnual({ dias, celdas, mesActivo, onVerMes }: Props) {
  const semanas = useMemo(() => {
    const out: { dia: DiaCalendario; celda: CeldaDia }[][] = [];
    for (let i = 0; i < dias.length; i++) {
      const w = Math.floor(i / 7);
      (out[w] ??= []).push({ dia: dias[i], celda: celdas[i] });
    }
    return out;
  }, [dias, celdas]);

  // Etiqueta de mes en la columna que contiene el día 1. La primera columna
  // lleva la de su mes solo si la siguiente etiqueta queda a 3+ columnas.
  const labelsMes = useMemo(() => {
    const out: { col: number; texto: string }[] = [];
    semanas.forEach((sem, w) => {
      const primero = sem.find((x) => x.dia.dia === 1);
      if (primero) out.push({ col: w, texto: MESES_CORTO[Number(primero.dia.fecha.slice(5, 7)) - 1] });
    });
    if (semanas.length && (out.length === 0 || out[0].col >= 3)) {
      out.unshift({ col: 0, texto: MESES_CORTO[Number(semanas[0][0].dia.fecha.slice(5, 7)) - 1] });
    }
    return out;
  }, [semanas]);

  const t = useMemo(() => totalesDe(celdas), [celdas]);
  const hoy = dias.find((x) => x.esHoy)?.fecha;
  const primero = dias[0]?.fecha;
  const ultimoPasado = hoy ?? dias[dias.length - 1]?.fecha;

  if (!dias.length) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Del {fmtFechaDia(primero)} al {fmtFechaDia(ultimoPasado)}:{' '}
        <span className="text-foreground">{t.laborables}</span> día(s) laborable(s) ·{' '}
        <span className="text-emerald-700 dark:text-emerald-400">{t.aHorario} a horario</span> ·{' '}
        <span className="text-amber-700 dark:text-amber-400">{t.tarde} tarde</span> ·{' '}
        <span className="text-orange-700 dark:text-orange-400">{t.tardeGrave} tarde grave</span> ·{' '}
        <span className="text-red-700 dark:text-red-400">{t.ausente} ausente</span>
        {t.trabajoNoLaborable ? <> · <span className="text-sky-700 dark:text-sky-400">{t.trabajoNoLaborable} en día no laborable</span></> : null}
      </p>

      <div className="overflow-x-auto pb-1">
        <div
          className="inline-grid"
          style={{
            gap: GAP,
            gridTemplateColumns: `28px repeat(${semanas.length}, ${CELDA}px)`,
            gridTemplateRows: `16px repeat(7, ${CELDA}px)`,
          }}
        >
          {labelsMes.map((l) => (
            <span key={`${l.col}-${l.texto}`} className="whitespace-nowrap text-[11px] leading-4 text-muted-foreground" style={{ gridColumn: l.col + 2, gridRow: 1 }}>
              {l.texto}
            </span>
          ))}
          {Object.entries(FILAS_CON_LABEL).map(([fila, texto]) => (
            <span key={fila} className="text-[10px] leading-[13px] text-muted-foreground" style={{ gridColumn: 1, gridRow: Number(fila) + 2 }}>
              {texto}
            </span>
          ))}
          {semanas.map((sem, w) =>
            sem.map(({ dia, celda }, d) => (
              <div
                key={celda.fecha}
                style={{ gridColumn: w + 2, gridRow: d + 2 }}
                className={cn('rounded-[3px]', mesActivo && celda.fecha.startsWith(mesActivo) && 'ring-1 ring-primary/30')}
              >
                <Celda dia={dia} celda={celda} onVerMes={onVerMes} />
              </div>
            )),
          )}
        </div>
      </div>

      <Leyenda />
    </div>
  );
}

function Celda({ dia, celda, onVerMes }: { dia: DiaCalendario; celda: CeldaDia; onVerMes?: (mes: string) => void }) {
  const [abierta, setAbierta] = useState(false);
  const e = ESTILO_CELDA[celda.estado];
  const inerte = celda.estado === 'futuro' || ((celda.estado === 'sin_horario' || celda.estado === 'feriado' || celda.estado === 'no_laborable') && celda.marcas === 0);
  const futuroLaborable = celda.estado === 'futuro' && celda.jornada != null;
  const label = `${fmtFechaDia(celda.fecha)}: ${ESTADOS_DIA[celda.estado].label}${celda.minutosTarde ? `, ${celda.minutosTarde} min tarde` : ''}${celda.sinSalida ? ', sin salida' : ''}`;
  const boton = (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={inerte}
      className={cn(
        'block h-[13px] w-[13px] rounded-[3px] transition-transform',
        e.celda,
        futuroLaborable && 'border border-border',
        dia.esHoy && 'outline outline-1 outline-offset-1 outline-primary',
        celda.sinSalida && 'ring-2 ring-inset ring-foreground/60',
        !inerte && 'hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {celda.estado === 'sin_horario' && celda.marcas > 0 ? <span className="mx-auto block h-1.5 w-1.5 rounded-full bg-muted-foreground" /> : null}
    </button>
  );
  if (inerte) return boton;
  return (
    <Popover open={abierta} onOpenChange={setAbierta}>
      <PopoverTrigger asChild>{boton}</PopoverTrigger>
      <PopoverContent align="center" className="w-72">
        {abierta && <DetalleCelda celda={celda} onVerMes={onVerMes} />}
      </PopoverContent>
    </Popover>
  );
}

function DetalleCelda({ celda, onVerMes }: { celda: CeldaDia; onVerMes?: (mes: string) => void }) {
  const est = ESTADOS_DIA[celda.estado];
  const mes = celda.fecha.slice(0, 7);
  const extra = celda.extra;
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{fmtFechaDia(celda.fecha)}</span>
        <Badge variant="secondary">{est.label}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{DESC_PERSONAL[celda.estado] ?? est.desc}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-muted-foreground">Horario</dt>
        <dd className="tabular-nums">{celda.jornada ? `${celda.jornada.entrada}–${celda.jornada.salida}` : celda.estado === 'sin_horario' ? 'sin horario' : 'no laborable'}</dd>
        <dt className="text-muted-foreground">Entrada</dt>
        <dd className="tabular-nums">
          {celda.entrada ? fmtHoraCorta(celda.entrada) : '—'}
          {celda.entradaInferida && <span className="ml-1 text-amber-600 dark:text-amber-400">(inferida)</span>}
          {celda.minutosTarde ? <span className="ml-1 text-muted-foreground">· {celda.minutosTarde} min tarde</span> : null}
        </dd>
        <dt className="text-muted-foreground">Salida</dt>
        <dd className="tabular-nums">{celda.salida ? fmtHoraCorta(celda.salida) : celda.sinSalida ? <span className="text-amber-600 dark:text-amber-400">sin marca</span> : '—'}</dd>
        <dt className="text-muted-foreground">Fichadas</dt>
        <dd className="tabular-nums">{celda.marcas}</dd>
        {extra && (extra.horas50 || extra.horas100) ? (
          <>
            <dt className="text-muted-foreground">Extra</dt>
            <dd className="text-violet-700 dark:text-violet-400">
              {extra.horas50 ? `${extra.horas50} h al 50 %` : ''}{extra.horas50 && extra.horas100 ? ' + ' : ''}{extra.horas100 ? `${extra.horas100} h al 100 %` : ''}
            </dd>
          </>
        ) : extra && extra.compensado + extra.minutos50 + extra.minutos100 > 0 ? (
          <>
            <dt className="text-muted-foreground">Extra</dt>
            <dd className="text-muted-foreground" title="Tiempo después de la hora de salida">{extra.compensado + extra.minutos50 + extra.minutos100} min</dd>
          </>
        ) : null}
      </dl>
      {onVerMes && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => onVerMes(mes)}>
          Ver {fmtMes(mes).toLowerCase()}
        </Button>
      )}
    </div>
  );
}

function Leyenda() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-muted-foreground">
      {LEYENDA_ESTADOS.map((e) => (
        <span key={e} className="inline-flex items-center gap-1.5">
          <span className={cn('inline-block h-3 w-3 rounded-[3px]', ESTILO_CELDA[e].celda)} />
          {ESTADOS_DIA[e].label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-[3px] bg-emerald-500/70 ring-2 ring-inset ring-foreground/60" />
        Sin fichaje de salida
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-[3px] outline outline-1 outline-offset-1 outline-primary" />
        Hoy
      </span>
    </div>
  );
}
