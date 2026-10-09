'use client';

/**
 * Calendario de un área: una fila por persona, una columna por semana de la temporada y abajo
 * cuántos salen cada semana (en rojo si se llenó el cupo). Un área por vez para que se lea fácil.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Empty } from '@/components/comunes/ui';
import { sumarDias } from '@/lib/asistencia-datos';
import {
  cierresTemporada, cupoSemana, fmtCorto, grupoDe, ocupacionSemana, perfilDe, semanasTemporada, solapan, solDe, type EmpleadoVac,
} from '@/lib/vacaciones-calc';
import { cn } from '@/lib/utils';
import { BARRA, CAMPO, Leyenda, MESES, textoEstado } from './piezas';
import type { PropsTab } from './VacacionesPage';


export default function CalendarioTab({ E, visibles }: PropsTab) {
  const semanas = semanasTemporada(E);
  const cierres = cierresTemporada(E);
  const inc = visibles.filter((e) => perfilDe(E, e.id).incluir);
  const grupos = new Map<string, { nombre: string; areaId: number | null; gente: EmpleadoVac[] }>();
  for (const e of inc) {
    const k = grupoDe(e);
    if (!grupos.has(k)) grupos.set(k, { nombre: `${e.area}${e.organigrama ? ` · ${e.organigrama}` : ''}`, areaId: e.areaId, gente: [] });
    grupos.get(k)!.gente.push(e);
  }
  const lista = [...grupos.entries()].sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));
  const [elegida, setElegida] = useState('');
  const clave = lista.some(([k]) => k === elegida) ? elegida : lista[0]?.[0] ?? '';

  if (!semanas.length || !lista.length) return <Empty title="No hay nada para mostrar">Revisá las fechas de la temporada en Configuración.</Empty>;

  const g = grupos.get(clave)!;
  const cupo = g.areaId != null ? E.areas[g.areaId]?.cupo ?? null : null;
  const primerDia = (e: EmpleadoVac) => solDe(E, e.id).tramos.map((t) => t.desde).sort()[0] ?? '9999';
  const gente = [...g.gente].sort((a, b) => primerDia(a).localeCompare(primerDia(b)) || a.nombre.localeCompare(b.nombre));
  const fin = (w: string) => sumarDias(w, 6);
  const cierreEn = (w: string) => cierres.some((c) => solapan(c.desde, c.hasta, w, fin(w)));
  // Encabezado de meses: cuántas semanas arrancan en cada mes.
  const meses: { mes: string; n: number }[] = [];
  for (const w of semanas) {
    const m = MESES[+w.slice(5, 7) - 1];
    if (meses.at(-1)?.mes === m) meses.at(-1)!.n++;
    else meses.push({ mes: m, n: 1 });
  }

  return (
    <div className="space-y-5 text-base">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium">Área</span>
          <Select value={clave} onValueChange={setElegida}>
            <SelectTrigger className={cn(CAMPO, 'w-full sm:w-80')} aria-label="Área"><SelectValue /></SelectTrigger>
            <SelectContent>{lista.map(([k, x]) => <SelectItem key={k} value={k}>{x.nombre}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <span className="text-muted-foreground">{cupo == null ? 'Sin límite de personas a la vez' : `Pueden salir ${cupo} a la vez`}</span>
      </div>

      <Card className="gap-4 px-0 py-5">
        <div className="overflow-x-auto px-5">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card" />
                {meses.map((m, i) => (
                  <th key={i} colSpan={m.n} scope="colgroup" className="border-l border-border px-1.5 pb-1 text-left text-sm font-semibold capitalize">{m.mes}</th>
                ))}
              </tr>
              <tr>
                <th scope="col" className="sticky left-0 z-10 min-w-52 bg-card pr-3 pb-2 text-left text-sm font-medium text-muted-foreground">Semana del</th>
                {semanas.map((w) => (
                  <th key={w} scope="col" className="min-w-11 px-0.5 pb-2 text-center text-[13px] font-normal text-muted-foreground tabular-nums">{+w.slice(8, 10)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gente.map((e) => {
                const s = solDe(E, e.id);
                const visible = s.estado === 'aprobada' || s.estado === 'enviada';
                return (
                  <tr key={e.id} className="border-t border-border">
                    <th scope="row" className="sticky left-0 z-10 max-w-60 bg-card py-2 pr-3 text-left font-normal">
                      <span className="block truncate text-[15px] font-semibold">{e.nombre}</span>
                      <span className="block text-[13px] text-muted-foreground">{textoEstado(s.estado)}</span>
                    </th>
                    {semanas.map((w) => {
                      const hit = visible && s.tramos.find((t) => solapan(t.desde, t.hasta, w, fin(w)));
                      return (
                        <td key={w} className="px-px py-2" title={hit ? `${e.nombre}: ${fmtCorto(hit.desde)} al ${fmtCorto(hit.hasta)}` : undefined}>
                          {hit ? <div className={cn('h-6 rounded', s.estado === 'aprobada' ? BARRA.aprobada : BARRA.pedida)} />
                            : cierreEn(w) && <div className={cn('h-6 rounded', BARRA.cierre)} />}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {g.areaId != null && (
                <tr className="border-t-2 border-border">
                  <th scope="row" className="sticky left-0 z-10 bg-card py-2.5 pr-3 text-left text-[15px] font-semibold">Afuera</th>
                  {semanas.map((w) => {
                    const c = cupoSemana(E, g.areaId, w), oc = ocupacionSemana(E, g.areaId!, w), lleno = c != null && oc >= c;
                    return (
                      <td key={w} className={cn('px-px py-2.5 text-center text-[15px] font-semibold tabular-nums', lleno && 'bg-destructive/10 text-destructive', !oc && !lleno && 'text-muted-foreground')}>
                        {c === 0 ? '✕' : oc}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5">
          <Leyenda items={[['aprobada', 'Aprobadas'], ['pedida', 'Pedidas, sin aprobar'], ...(cierres.length ? [['cierre', 'Cierre de la empresa'] as const] : [])]}>
            {cupo != null && <span className="font-semibold text-destructive">{cupo} = semana llena</span>}
            {g.areaId != null && semanas.some((w) => cupoSemana(E, g.areaId, w) === 0) && <span className="text-muted-foreground">✕ = semana cerrada</span>}
          </Leyenda>
        </div>
      </Card>
    </div>
  );
}
