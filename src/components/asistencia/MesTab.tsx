'use client';

/**
 * Vista Mes: una fila por persona con horario, con lo que se mira para liquidar: horas
 * trabajadas contra las esperadas, llegadas tarde (y cuántas compensó), horas extra, faltas y
 * días con una marca faltante. En el celular es una tarjeta por persona; en la compu, una tabla.
 */

import { useMemo, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Banner, EmpleadoCell } from '@/components/comunes/ui';
import { cn, coincide } from '@/lib/utils';
import { fmtMes, mesAnterior, mesSiguiente } from '@/lib/fechas';
import { fmtHorasExtra, fmtMinutos, plural, type ResumenMesPersona } from '@/lib/asistencia-tablero-calc';
import type { PersonaMes, TableroMes } from './api';
import { useAsistencia, useAsistenciaData } from './AsistenciaContext';
import { BarraHoras, Buscador, Etiqueta, LinkPerfil, NavPeriodo, SelectorLugar, type Tono } from './piezas';

const ORDENES = {
  tarde: { label: 'Llegadas tarde', cmp: (a: ResumenMesPersona, b: ResumenMesPersona) => b.tardes - a.tardes || b.minutosTarde - a.minutosTarde },
  extra: { label: 'Horas extra', cmp: (a: ResumenMesPersona, b: ResumenMesPersona) => b.extra50 + b.extra100 - (a.extra50 + a.extra100) },
  horas: { label: 'Menos horas', cmp: (a: ResumenMesPersona, b: ResumenMesPersona) => cumplido(a) - cumplido(b) },
} as const;
type Orden = keyof typeof ORDENES;

/** Fracción de las horas esperadas que trabajó (sin horas esperadas va al final). */
const cumplido = (r: ResumenMesPersona) => (r.minutosEsperados > 0 ? r.minutosTrabajados / r.minutosEsperados : Infinity);

export default function MesTab() {
  const { f, set, personaPorUserId } = useAsistencia();
  const [q, setQ] = useState('');
  const [orden, setOrden] = useState<Orden>('tarde');
  const { data, error, loading } = useAsistenciaData<TableroMes>(`/api/admin/asistencia/mes?mes=${f.mes}`);

  const personas = useMemo(
    () => (data?.personas ?? [])
      .filter((p) => (f.lugar == null || p.lugarId === f.lugar) && coincide(q, p.nombre, p.area))
      .sort((a, b) => ORDENES[orden].cmp(a.resumen, b.resumen) || a.nombre.localeCompare(b.nombre, 'es')),
    [data, f.lugar, q, orden],
  );
  const personaId = (p: PersonaMes) => (p.userIds.length ? personaPorUserId.get(p.userIds[0])?.id : null);
  const mesActual = data?.hoy.slice(0, 7);

  return (
    <div className="space-y-5 text-base">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <NavPeriodo
          unidad="Mes"
          label={fmtMes(f.mes)}
          onAnterior={() => set({ mes: mesAnterior(f.mes) })}
          onSiguiente={() => set({ mes: mesSiguiente(f.mes) })}
          sinSiguiente={!!mesActual && f.mes >= mesActual}
        />
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-1 lg:justify-end">
          <SelectorLugar lugares={data?.lugares ?? []} />
          <Buscador valor={q} onCambio={setQ} />
        </div>
      </div>

      <div role="group" aria-labelledby="ordenar-por" className="flex flex-wrap items-center gap-2">
        <span id="ordenar-por" className="text-muted-foreground">Ordenar por</span>
        {(Object.keys(ORDENES) as Orden[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={orden === k}
            onClick={() => setOrden(k)}
            className={cn(
              'h-11 rounded-full border px-3.5 font-medium transition-colors',
              orden === k ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background hover:bg-accent',
            )}
          >
            {ORDENES[k].label}
          </button>
        ))}
      </div>

      {error && <Banner variant="warn">{error}</Banner>}
      {data?.truncado && <Banner variant="locked">Hay más marcas de las que se pueden leer juntas en un mes; algunos días pueden verse incompletos.</Banner>}

      {!data ? (
        loading && <Skeleton className="h-96 w-full rounded-xl" />
      ) : personas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          {q ? `Nadie coincide con «${q}».` : 'Nadie tiene horario cargado en este mes. Se carga en Personas, columna Horario.'}
        </p>
      ) : (
        <div className={cn(loading && 'opacity-60')}>
          <ul className="space-y-3 lg:hidden">
            {personas.map((p) => (
              <li key={p.clave}>
                <LinkPerfil personaId={personaId(p)} nombre={p.nombre} mes={f.mes} className="rounded-xl hover:text-foreground">
                  <Tarjeta p={p} />
                </LinkPerfil>
              </li>
            ))}
          </ul>
          <Tabla personas={personas} personaId={personaId} mes={f.mes} orden={orden} />
          <p className="mt-3 text-sm text-muted-foreground">{plural(personas.length, 'persona', 'personas')}</p>
        </div>
      )}
    </div>
  );
}

/** Celular: una tarjeta por persona; el color marca solo lo que hay que mirar. */
function Tarjeta({ p }: { p: PersonaMes }) {
  const r = p.resumen;
  const extra = r.extra50 + r.extra100;
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50">
      <EmpleadoCell grande empleado={{ id: p.empleadoId ?? -1, nombre: p.nombre, foto_archivo: p.fotoArchivo }} sub={p.area ?? undefined} />
      <div className="space-y-1.5">
        <div className="flex justify-between gap-2">
          <span>Horas trabajadas</span>
          <span><Horas min={r.minutosTrabajados} /> <span className="text-muted-foreground">de {Math.floor(r.minutosEsperados / 60)} h</span></span>
        </div>
        <BarraHoras r={r} />
      </div>
      <dl className="divide-y divide-border border-t border-border">
        <Cifra label="Llegadas tarde" tono={r.tardes ? 'warn' : null} valor={r.tardes} sub={r.tardes ? plural(r.compensadas, 'compensada', 'compensadas') : undefined} />
        <Cifra label="Horas extra" tono={extra ? 'info' : null} valor={fmtHorasExtra(extra)} sub={r.extra100 ? `${fmtHorasExtra(r.extra100)} al 100 %` : undefined} />
        <Cifra label="Faltas" tono={r.faltas ? 'bad' : null} valor={r.faltas} sub={[r.justificadas && plural(r.justificadas, 'justificada', 'justificadas'), r.sinMarca && plural(r.sinMarca, 'día sin marca', 'días sin marca')].filter(Boolean).join(' · ') || undefined} />
      </dl>
    </div>
  );
}

function Cifra({ label, tono, valor, unidad, sub }: { label: string; tono: Tono | null; valor: number | string; unidad?: string; sub?: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 pt-2 [&:not(:last-child)]:pb-2">
      <dt>{label}</dt>
      <dd className="flex items-center gap-2 text-right">
        {sub && <span className="text-sm text-muted-foreground">{sub}</span>}
        {tono ? <Etiqueta tono={tono}><span><span className="font-mono">{valor}</span>{unidad}</span></Etiqueta> : <span className="px-2.5 text-muted-foreground"><span className="font-mono">{valor}</span>{unidad}</span>}
      </dd>
    </div>
  );
}

/** Horas enteras: el número en mono, la unidad no (en mono "91 h" queda con un hueco). */
function Horas({ min }: { min: number }) {
  return <><span className="font-mono font-semibold">{Math.floor(min / 60)}</span> h</>;
}

/** Compu: todas las columnas para liquidar. Los ceros van atenuados para que resalte lo que hay. */
function Tabla({ personas, personaId, mes, orden }: { personas: PersonaMes[]; personaId: (p: PersonaMes) => number | null | undefined; mes: string; orden: Orden }) {
  const cero = 'text-muted-foreground';
  const columnas: { label: string; orden?: Orden }[] = [
    { label: 'Llegadas tarde', orden: 'tarde' }, { label: 'Compensadas' }, { label: 'Tiempo tarde' },
    { label: 'Extra 50 %', orden: 'extra' }, { label: 'Extra 100 %' }, { label: 'Faltas' }, { label: 'Días sin marca' },
  ];
  return (
    <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-sm lg:block">
      <table className="w-full min-w-[980px] border-collapse text-[15px]">
        <thead>
          <tr className="h-12 border-b border-border text-left text-sm text-muted-foreground">
            <th scope="col" className="px-5 font-medium">Persona</th>
            <th scope="col" aria-sort={orden === 'horas' ? 'ascending' : undefined} className="w-52 px-3 font-medium">Horas trabajadas</th>
            {columnas.map((c) => (
              <th key={c.label} scope="col" aria-sort={c.orden === orden ? 'descending' : undefined} className="px-3 text-right font-medium">
                <span className={cn('inline-flex items-center gap-1 whitespace-nowrap', c.orden === orden && 'font-semibold text-foreground')}>
                  {c.label}{c.orden === orden && <ArrowDown className="size-4" />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {personas.map((p) => {
            const r = p.resumen;
            return (
              <tr key={p.clave} className="h-[68px] border-b border-border last:border-0 hover:bg-muted/50">
                <td className="px-5">
                  <LinkPerfil personaId={personaId(p)} nombre={p.nombre} mes={mes}>
                    <EmpleadoCell grande empleado={{ id: p.empleadoId ?? -1, nombre: p.nombre, foto_archivo: p.fotoArchivo }} sub={p.area ?? undefined} />
                  </LinkPerfil>
                </td>
                <td className="px-3">
                  <span className="text-sm"><Horas min={r.minutosTrabajados} /> <span className="text-muted-foreground">de {Math.floor(r.minutosEsperados / 60)} h</span></span>
                  <BarraHoras r={r} className="mt-1.5 h-1.5" />
                </td>
                <td className="px-3 text-right">{r.tardes ? <Etiqueta tono="warn"><span className="font-mono">{r.tardes}</span></Etiqueta> : <span className={cero}>0</span>}</td>
                <td className={cn('px-3 text-right font-mono', r.compensadas ? 'text-emerald-700 dark:text-emerald-400' : cero)}>{r.compensadas}</td>
                <td className={cn('whitespace-nowrap px-3 text-right font-mono', !r.minutosTarde && cero)}>{r.minutosTarde ? fmtMinutos(r.minutosTarde) : '0'}</td>
                <td className={cn('whitespace-nowrap px-3 text-right font-mono', r.extra50 ? 'text-sky-700 dark:text-sky-300' : cero)}>{fmtHorasExtra(r.extra50)}</td>
                <td className={cn('whitespace-nowrap px-3 text-right font-mono', r.extra100 ? 'text-sky-700 dark:text-sky-300' : cero)}>{fmtHorasExtra(r.extra100)}</td>
                <td className="px-3 text-right">
                  {r.faltas ? <Etiqueta tono="bad"><span className="font-mono">{r.faltas}</span></Etiqueta> : <span className={cero}>0</span>}
                  {r.justificadas > 0 && <span className="block whitespace-nowrap text-xs text-teal-700 dark:text-teal-300">+{plural(r.justificadas, 'justificada', 'justificadas')}</span>}
                </td>
                <td className="px-5 pl-3 text-right">{r.sinMarca ? <Etiqueta tono="warn"><span className="font-mono">{r.sinMarca}</span></Etiqueta> : <span className={cero}>0</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
