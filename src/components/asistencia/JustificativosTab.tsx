'use client';

/**
 * Justificativos de inasistencias que mandan los empleados desde Mi asistencia. RR.HH. ve el
 * documento, marca en el calendario del mes los días que cubre (un reposo puede abarcar varios)
 * y lo aprueba, o lo rechaza con un motivo que el empleado lee. Aprobado: esos días pasan a
 * «Inasistencia justificada». Rechazado: el día queda ausente y no se puede volver a pedir.
 */

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { EmpleadoCell, Empty, ErrorCarga } from '@/components/comunes/ui';
import { apiFetch, mensajeError } from '@/components/comunes/api';
import { cn } from '@/lib/utils';
import { fmtDiaLargo } from '@/lib/asistencia-datos';
import { fechaCorta, fmtMes, mesAnterior, mesSiguiente } from '@/lib/fechas';
import { DIAS_SEMANA_CORTO, diaJustificable, type CeldaDia } from '@/lib/asistencia-calendario';
import type { JustificacionView } from '@/lib/asistencia-justificaciones';
import { useAsistencia, useAsistenciaData } from './AsistenciaContext';
import { Etiqueta } from './piezas';

export const URL_PENDIENTES = '/api/admin/asistencia/justificaciones';
const urlArchivo = (id: number) => `/api/admin/asistencia/justificaciones/${id}/archivo`;

export default function JustificativosTab() {
  const [ver, setVer] = useState<'pendiente' | 'resueltas'>('pendiente');
  const { data, error, loading } = useAsistenciaData<JustificacionView[]>(ver === 'pendiente' ? URL_PENDIENTES : `${URL_PENDIENTES}?estado=resueltas`);
  const [revisando, setRevisando] = useState<JustificacionView | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-4 text-base">
      <div role="tablist" aria-label="Justificativos" className="inline-grid grid-cols-2 gap-1 rounded-[10px] bg-muted p-1">
        {(['pendiente', 'resueltas'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={ver === v}
            onClick={() => setVer(v)}
            className={cn('h-11 rounded-lg px-4 font-medium', ver === v ? 'bg-card font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            {v === 'pendiente' ? 'Para revisar' : 'Resueltos'}
          </button>
        ))}
      </div>

      {error ? <ErrorCarga error={error} /> : loading && !data ? <p className="text-muted-foreground">Cargando…</p> : !data?.length ? (
        <Empty title={ver === 'pendiente' ? 'No hay justificativos para revisar' : 'Todavía no se resolvió ninguno'}>
          Los empleados los mandan desde Mi asistencia, tocando un día en que faltaron.
        </Empty>
      ) : (
        <ul className="space-y-3">
          {data.map((j) => (
            <li key={j.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <EmpleadoCell grande empleado={{ id: j.empleado.id, nombre: j.empleado.nombre, foto_archivo: j.empleado.fotoArchivo }} sub={j.empleado.area || undefined} />
                <EstadoJustificacion j={j} />
              </div>
              <p>Faltó el <strong>{fmtDiaLargo(j.fecha)}</strong> · lo mandó el {fechaCorta(j.creado)}</p>
              {j.comentario && <blockquote className="border-l-4 border-border pl-3 text-muted-foreground">{j.comentario}</blockquote>}
              {j.estado === 'aprobada' && <p className="text-sm">Justificó: {j.dias.map(fechaCorta).join(', ')} · {j.revisadoPor}</p>}
              {j.estado === 'rechazada' && <p className="text-sm">Motivo: «{j.motivoRechazo}» · {j.revisadoPor}</p>}
              <div className="flex flex-wrap justify-end gap-2">
                <Button asChild variant="outline" className="h-11 text-base">
                  <a href={urlArchivo(j.id)} target="_blank" rel="noreferrer"><FileText className="size-4" />Ver documento</a>
                </Button>
                {j.estado === 'pendiente' && <Button className="h-11 text-base" onClick={() => setRevisando(j)}>Revisar</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!revisando} onOpenChange={(o) => !o && setRevisando(null)}>
        <DialogContent aria-describedby={undefined} className="max-h-[92dvh] overflow-y-auto text-base sm:max-w-2xl">
          {revisando && <Revisar key={revisando.id} j={revisando} onListo={() => setRevisando(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EstadoJustificacion({ j }: { j: JustificacionView }) {
  if (j.estado === 'aprobada') return <Etiqueta tono="ok">Aprobado</Etiqueta>;
  if (j.estado === 'rechazada') return <Etiqueta tono="bad">Rechazado</Etiqueta>;
  return <Etiqueta tono="warn">Para revisar</Etiqueta>;
}

type Detalle = { justificacion: JustificacionView; celdas: CeldaDia[] };

/** Documento + calendario del mes para marcar los días; aprobar o rechazar con motivo. */
function Revisar({ j, onListo }: { j: JustificacionView; onListo: () => void }) {
  const { refrescar } = useAsistencia();
  const [mes, setMes] = useState(j.fecha.slice(0, 7));
  const [detalle, setDetalle] = useState<{ mes: string; d: Detalle } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dias, setDias] = useState<Set<string>>(() => new Set([j.fecha]));
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    apiFetch<Detalle>(`/api/admin/asistencia/justificaciones/${j.id}?mes=${mes}`, { signal: ac.signal })
      .then((d) => { setDetalle({ mes, d }); setError(null); })
      .catch((e: unknown) => { if (!ac.signal.aborted) setError(mensajeError(e)); });
    return () => ac.abort();
  }, [j.id, mes]);

  function alternar(fecha: string) {
    setDias((prev) => {
      const s = new Set(prev);
      if (s.has(fecha)) s.delete(fecha); else s.add(fecha);
      return s;
    });
  }

  async function resolver(body: object, ok: string) {
    setEnviando(true);
    try {
      await apiFetch(`/api/admin/asistencia/justificaciones/${j.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      toast.success(ok);
      refrescar();
      onListo();
    } catch (e) {
      toast.error(mensajeError(e));
      setEnviando(false);
    }
  }

  const celdas = detalle?.mes === mes ? detalle.d.celdas : null;
  const huecos = celdas?.length ? (new Date(`${celdas[0].fecha}T12:00:00Z`).getUTCDay() + 6) % 7 : 0;

  return (
    <div className="space-y-4">
      <DialogTitle className="pr-8 text-xl">Justificativo de {j.empleado.nombre}</DialogTitle>
      <p>Faltó el <strong>{fmtDiaLargo(j.fecha)}</strong>.{j.comentario && <> Dice: «{j.comentario}»</>}</p>
      {j.esImagen ? (
        <a href={urlArchivo(j.id)} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urlArchivo(j.id)} alt={`Documento de ${j.empleado.nombre}`} className="max-h-80 w-full rounded-lg border border-border object-contain" />
        </a>
      ) : (
        <Button asChild variant="outline" className="h-11 w-full text-base">
          <a href={urlArchivo(j.id)} target="_blank" rel="noreferrer"><FileText className="size-4" />Abrir el PDF ({j.nombreOriginal})</a>
        </Button>
      )}

      <section aria-label="Días que justifica" className="space-y-2 rounded-xl border border-border p-3">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" className="size-11" aria-label="Mes anterior" onClick={() => setMes(mesAnterior(mes))}><ChevronLeft /></Button>
          <span className="font-semibold">{fmtMes(mes)}</span>
          <Button variant="outline" size="icon" className="size-11" aria-label="Mes siguiente" onClick={() => setMes(mesSiguiente(mes))}><ChevronRight /></Button>
        </div>
        <p className="text-sm text-muted-foreground">Marcá los días que cubre el documento. Solo se pueden marcar días en que le tocaba venir y no fichó.</p>
        {error ? <ErrorCarga error={error} /> : !celdas ? <p className="text-muted-foreground">Cargando…</p> : !celdas.length ? (
          <p className="text-muted-foreground">No tiene horario este mes: no hay días para justificar.</p>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {DIAS_SEMANA_CORTO.map((n) => <span key={n} className="text-center text-sm font-semibold text-muted-foreground">{n}</span>)}
            {Array.from({ length: huecos }, (_, i) => <span key={`h${i}`} aria-hidden />)}
            {celdas.map((c) => {
              const elegible = diaJustificable(c);
              const marcado = dias.has(c.fecha);
              return (
                <button
                  key={c.fecha}
                  type="button"
                  disabled={!elegible}
                  aria-pressed={elegible ? marcado : undefined}
                  aria-label={`${fmtDiaLargo(c.fecha)}${c.estado === 'justificado' ? ', ya justificado' : elegible ? '' : ', no se puede justificar'}`}
                  onClick={() => alternar(c.fecha)}
                  className={cn(
                    'flex h-11 items-center justify-center rounded-md font-medium focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    marcado ? 'bg-primary text-primary-foreground'
                      : c.estado === 'justificado' ? 'bg-teal-500/30 text-teal-900 dark:text-teal-50'
                      : elegible ? 'border border-red-500/60 text-foreground hover:bg-muted'
                      : 'text-muted-foreground/50',
                  )}
                >
                  {Number(c.fecha.slice(8))}{c.estado === 'justificado' && <span className="ml-0.5 text-xs">J</span>}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-sm">{dias.size ? `Marcados: ${[...dias].sort().map(fechaCorta).join(', ')}` : 'No marcaste ningún día.'}</p>
      </section>

      {rechazando ? (
        <div className="space-y-3 rounded-xl bg-muted p-3">
          <label htmlFor="motivo-rechazo" className="font-medium">¿Por qué lo rechazás? {j.empleado.nombre} va a leer esto. El día queda ausente y no lo puede volver a pedir.</label>
          <Textarea id="motivo-rechazo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} className="bg-card text-base" />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" className="h-11 text-base" onClick={() => setRechazando(false)}>Cancelar</Button>
            <Button variant="destructive" className="h-11 text-base" disabled={!motivo.trim() || enviando} onClick={() => resolver({ accion: 'rechazar', motivo }, 'Justificativo rechazado')}>
              Rechazar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" className="h-11 text-base" onClick={() => setRechazando(true)}>Rechazar…</Button>
          <Button className="h-11 text-base" disabled={!dias.size || enviando} onClick={() => resolver({ accion: 'aprobar', dias: [...dias] }, 'Justificativo aprobado')}>
            Aprobar {dias.size === 1 ? '1 día' : `${dias.size} días`}
          </Button>
        </div>
      )}
    </div>
  );
}
