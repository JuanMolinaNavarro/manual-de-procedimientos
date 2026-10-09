'use client';

/**
 * Vista Día (la de entrada del módulo): cómo vino cada persona con horario un día. Arriba
 * cuántas ya ficharon, después lo que quedó para revisar del día hábil anterior, y las listas
 * de quién llegó tarde y quién no fichó. Cada nombre lleva a su perfil.
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Banner, EmpleadoCell } from '@/components/comunes/ui';
import { cn } from '@/lib/utils';
import { fmtDiaLargo, fmtHoraCorta, hoyLocal, sumarDias } from '@/lib/asistencia-datos';
import { minutoLocalDe } from '@/lib/asistencia-calendario';
import { fmtMinutos, grupoDelDia, pendienteDeRevisar, type GrupoDia } from '@/lib/asistencia-tablero-calc';
import type { PersonaDia, TableroDia } from './api';
import { useAsistencia, useAsistenciaData } from './AsistenciaContext';
import { Buscador, Etiqueta, LinkPerfil, NavPeriodo, SelectorLugar, coincide } from './piezas';

/** Orden y color de cada lista en la barra del resumen. */
const BARRA: { grupos: GrupoDia[]; color: string }[] = [
  { grupos: ['a_horario'], color: 'bg-emerald-500' },
  { grupos: ['tarde', 'sin_entrada'], color: 'bg-amber-400' },
  { grupos: ['tarde_grave'], color: 'bg-orange-600' },
  { grupos: ['sin_fichar', 'falto'], color: 'bg-red-500' },
  { grupos: ['entra_mas_tarde'], color: 'bg-muted-foreground/30' },
];

export default function DiaTab() {
  const { f, set } = useAsistencia();
  const [q, setQ] = useState('');
  // Minuto de ahora: separa a quien todavía no fichó de quien entra más tarde. Se toma al montar.
  const [ahoraMin] = useState(() => minutoLocalDe(new Date().toISOString()));
  const [hoy] = useState(() => hoyLocal());
  const { data, error, loading } = useAsistenciaData<TableroDia>(`/api/admin/asistencia/dia?fecha=${f.fecha}`);

  const personas = useMemo(
    () => (data?.personas ?? []).filter((p) => (f.lugar == null || p.lugarId === f.lugar) && coincide(p, q)),
    [data, f.lugar, q],
  );
  const grupos = useMemo(() => {
    const g = new Map<GrupoDia, PersonaDia[]>();
    for (const p of personas) {
      const k = grupoDelDia(p.celda, ahoraMin);
      if (k) g.set(k, [...(g.get(k) ?? []), p]);
    }
    return g;
  }, [personas, ahoraMin]);
  const de = (...ks: GrupoDia[]) => ks.flatMap((k) => grupos.get(k) ?? []);

  const esHoy = f.fecha === hoy;
  const tarde = de('tarde_grave', 'tarde').sort((a, b) => (b.celda.minutosTarde ?? 0) - (a.celda.minutosTarde ?? 0));
  const sinFichar = de('sin_fichar', 'entra_mas_tarde', 'falto');
  const sinEntrada = de('sin_entrada');

  return (
    <div className="space-y-5 text-base">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <NavPeriodo
          unidad="Día"
          label={esHoy ? 'Hoy' : fmtDiaLargo(f.fecha)}
          sub={esHoy ? fmtDiaLargo(f.fecha) : undefined}
          onAnterior={() => set({ fecha: sumarDias(f.fecha, -1) })}
          onSiguiente={() => set({ fecha: sumarDias(f.fecha, 1) })}
          sinSiguiente={esHoy}
        />
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-1 lg:justify-end">
          <SelectorLugar lugares={data?.lugares ?? []} />
          <Buscador valor={q} onCambio={setQ} />
        </div>
      </div>

      {error && <Banner variant="warn">{error}</Banner>}
      {data?.truncado && <Banner variant="locked">Hay más marcas de las que se pueden leer juntas; algunos días pueden verse incompletos.</Banner>}

      {!data ? (
        loading && <Skeleton className="h-96 w-full rounded-xl" />
      ) : data.feriado ? (
        <Banner variant="info">Ese día casi nadie fichó: se toma como feriado y nadie queda como falta.</Banner>
      ) : (
        <div className={cn('space-y-5', loading && 'opacity-60')}>
          <ComoViene personas={personas} grupos={grupos} esHoy={esHoy} graveMin={data.tardeGraveMin} />
          <ParaRevisar personas={personas} />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Lista titulo="Llegaron tarde" id="tarde" vacia="Nadie llegó tarde." personas={tarde} detalle={(p) => (
              <>Entró <span className="font-mono">{p.celda.entrada ? fmtHoraCorta(p.celda.entrada) : '—'}</span>, debía <span className="font-mono">{p.celda.jornada?.entrada}</span></>
            )} etiqueta={(p) => (
              <Etiqueta tono={p.celda.estado === 'tarde_grave' ? 'grave' : 'warn'}>
                {p.celda.estado === 'tarde_grave' && <AlertTriangle aria-label={`${data.tardeGraveMin} min o más`} />}
                {fmtMinutos(p.celda.minutosTarde ?? 0)}
              </Etiqueta>
            )} />
            <Lista titulo={esHoy ? 'Todavía no ficharon' : 'No vinieron'} id="sin-fichar" vacia={esHoy ? 'Ya ficharon todos.' : 'Vinieron todos.'} personas={sinFichar} detalle={(p) => (
              <>Entra <span className="font-mono">{p.celda.jornada?.entrada}</span></>
            )} etiqueta={(p) => {
              const g = grupoDelDia(p.celda, ahoraMin);
              return g === 'entra_mas_tarde' ? <Etiqueta tono="neutro">Entra más tarde</Etiqueta> : <Etiqueta tono="bad">{g === 'falto' ? 'Faltó' : 'Sin marcas'}</Etiqueta>;
            }} />
          </div>
          {sinEntrada.length > 0 && (
            <Lista titulo="Sin marca de entrada" id="sin-entrada" vacia="" personas={sinEntrada} detalle={(p) => (
              <>Solo marcó la salida{p.celda.salida ? <>, a las <span className="font-mono">{fmtHoraCorta(p.celda.salida)}</span></> : null}</>
            )} etiqueta={() => <Etiqueta tono="warn">A verificar</Etiqueta>} />
          )}
        </div>
      )}
    </div>
  );
}

/** "41 de 46 ya ficharon", la barra y cuántos hay en cada lista. */
function ComoViene({ personas, grupos, esHoy, graveMin }: { personas: PersonaDia[]; grupos: Map<GrupoDia, PersonaDia[]>; esHoy: boolean; graveMin: number }) {
  const n = (...ks: GrupoDia[]) => ks.reduce((t, k) => t + (grupos.get(k)?.length ?? 0), 0);
  const esperados = [...grupos.values()].reduce((t, g) => t + g.length, 0);
  const vinieron = n('a_horario', 'tarde', 'tarde_grave', 'sin_entrada');
  if (esperados === 0) {
    return <Banner variant="info">{personas.length ? 'Ese día no se esperaba a nadie (franco o fin de semana).' : 'Nadie con horario coincide con lo elegido.'}</Banner>;
  }
  const filas: { texto: string; n: number; color: string; ancla: string }[] = [
    { texto: 'Llegaron a horario', n: n('a_horario'), color: 'bg-emerald-500', ancla: 'tarde' },
    { texto: `Tarde, menos de ${graveMin} min`, n: n('tarde'), color: 'bg-amber-400', ancla: 'tarde' },
    { texto: `Tarde, ${graveMin} min o más`, n: n('tarde_grave'), color: 'bg-orange-600', ancla: 'tarde' },
    { texto: esHoy ? 'Todavía no ficharon' : 'No vinieron', n: n('sin_fichar', 'falto', 'entra_mas_tarde'), color: 'bg-red-500', ancla: 'sin-fichar' },
  ];
  if (n('sin_entrada')) filas.push({ texto: 'Sin marca de entrada', n: n('sin_entrada'), color: 'bg-amber-400', ancla: 'sin-entrada' });
  return (
    <section aria-label="Cómo viene el día" className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div>
        <p className="text-3xl font-bold">{vinieron} de {esperados} {esHoy ? 'ya ficharon' : 'vinieron'}</p>
        <p className="text-sm text-muted-foreground">Personas con horario ese día</p>
      </div>
      <div aria-hidden className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-muted">
        {BARRA.map((b) => <div key={b.color} className={b.color} style={{ flexGrow: n(...b.grupos) }} />)}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-4">
        {filas.map((r) => (
          <a key={r.texto} href={`#${r.ancla}`} className="flex min-h-12 items-center gap-3 border-t border-border px-1 transition-colors hover:bg-muted/50">
            <span className={cn('size-3.5 shrink-0 rounded', r.color)} />
            <span className="flex-1">{r.texto}</span>
            <span className="font-mono text-lg font-semibold">{r.n}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

const MOTIVOS = [
  { k: 'falto', titulo: 'Faltaron' },
  { k: 'sin_entrada', titulo: 'No marcaron la entrada' },
  { k: 'sin_salida', titulo: 'Se fueron sin marcar la salida' },
] as const;

/** "viernes 11 de septiembre" → "viernes 11". */
const diaCorto = (fecha: string) => fmtDiaLargo(fecha).split(' de ')[0];

/**
 * Faltas y marcas faltantes del último día anterior de cada uno (el lunes, el viernes; con sábados
 * alternos, el sábado solo para quien le tocaba). Si quedan de más de un día, cada nombre lleva el suyo.
 */
function ParaRevisar({ personas }: { personas: PersonaDia[] }) {
  const { set } = useAsistencia();
  const conPendiente = personas.filter((p) => p.anterior && pendienteDeRevisar(p.anterior));
  if (!conPendiente.length) return null;
  const fechas = [...new Set(conPendiente.map((p) => p.anterior!.fecha))].sort().reverse();
  const nombre = (p: PersonaDia) => (fechas.length > 1 ? `${p.nombre} (${diaCorto(p.anterior!.fecha)})` : p.nombre);
  return (
    <section aria-label="Para revisar del día anterior" className="space-y-3 rounded-xl border border-amber-500 bg-amber-400/10 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" />
        <div className="min-w-0 space-y-2">
          <p className="font-semibold">{fechas.length === 1 ? `Quedó para revisar del ${fmtDiaLargo(fechas[0])}` : 'Quedó para revisar de los días anteriores'}</p>
          {MOTIVOS.map((m) => {
            const lista = conPendiente.filter((p) => pendienteDeRevisar(p.anterior!) === m.k);
            return lista.length > 0 && <p key={m.k}><span className="font-medium">{m.titulo}:</span> {lista.map(nombre).join(', ')}</p>;
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {fechas.map((fecha) => (
          <Button key={fecha} variant="outline" className="h-11 w-full bg-card text-base sm:w-auto" onClick={() => set({ fecha })}>
            {fechas.length === 1 ? 'Ver ese día' : `Ver el ${diaCorto(fecha)}`} <ChevronRight className="size-4" />
          </Button>
        ))}
      </div>
    </section>
  );
}

function Lista({
  titulo, id, vacia, personas, detalle, etiqueta,
}: {
  titulo: string; id: string; vacia: string; personas: PersonaDia[];
  detalle: (p: PersonaDia) => React.ReactNode; etiqueta: (p: PersonaDia) => React.ReactNode;
}) {
  const { f, personaPorUserId } = useAsistencia();
  return (
    <section id={id} aria-label={titulo} className="scroll-mt-20 space-y-2.5">
      <div className="flex items-center gap-2">
        <h3 className="flex-1 text-lg font-semibold">{titulo}</h3>
        <Etiqueta tono="neutro">{personas.length} {personas.length === 1 ? 'persona' : 'personas'}</Etiqueta>
      </div>
      {personas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-5 text-center text-muted-foreground">{vacia}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {personas.map((p) => (
            <li key={p.clave}>
              <LinkPerfil personaId={p.userIds.length ? personaPorUserId.get(p.userIds[0])?.id : null} nombre={p.nombre} mes={f.fecha.slice(0, 7)} className="rounded-none hover:bg-muted/50 hover:text-foreground">
                <div className="flex min-h-[72px] items-center gap-3 px-4 py-3">
                  <EmpleadoCell grande className="flex-1" empleado={{ id: p.empleadoId ?? -1, nombre: p.nombre, foto_archivo: p.fotoArchivo }} sub={<>{p.area ? `${p.area} · ` : ''}{detalle(p)}</>} />
                  {etiqueta(p)}
                </div>
              </LinkPerfil>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
