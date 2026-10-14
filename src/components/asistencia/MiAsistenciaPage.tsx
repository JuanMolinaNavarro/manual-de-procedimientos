'use client';

/**
 * Mi asistencia (`/admin/mi-asistencia`): la asistencia del usuario de la
 * sesión, leída de la ficha del organigrama vinculada a su cuenta. Pensada para
 * que la lea de un vistazo una persona de 60 años: el mes, unas pocas frases
 * cortas y un calendario de colores. Cada frase lleva el mismo símbolo que su
 * color del calendario, así el resumen hace de leyenda. Tocar un día abre su
 * detalle (entrada, salida, horas). Un día ausente del mes en curso o del anterior se puede
 * justificar subiendo un documento (certificado médico, de examen…) que revisa RR.HH.
 */

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Banner, Empty } from '@/components/comunes/ui';
import { cn } from '@/lib/utils';
import { fmtDiaLargo, fmtHoraCorta, hoyLocal } from '@/lib/asistencia-datos';
import { DIAS_SEMANA_LARGO, diaSemanaDe, type CeldaDia, type ResumenLiquidacion } from '@/lib/asistencia-calendario';
import { MES_RE, fmtMes, mesAnterior, mesSiguiente } from '@/lib/fechas';
import { compensada, horasExtraDia, plural, tardanza, tardesCompensadas } from '@/lib/asistencia-tablero-calc';

/** Horas extra (de a media hora) en el cuadradito del calendario: 1.5 → "+1½", 0.5 → "+½". */
const masHoras = (h: number) => `+${Math.floor(h) || ''}${h % 1 ? '½' : ''}`;
import type { MiAsistencia, MiAsistenciaRespuesta } from './api';
import { apiFetch, mensajeError } from '@/components/comunes/api';

type Marca = MiAsistencia['marcas'][number];
type Justificacion = MiAsistencia['justificaciones'][number];
type SabadoLibre = MiAsistencia['sabadoLibre'];

/** Sábado que puede elegir (o dejar de tener) como libre: le toca trabajar y no fichó, o ya es el elegido. */
function sabadoElegible(c: CeldaDia, s: SabadoLibre): boolean {
  return s.puede && diaSemanaDe(c.fecha) === 5 && (!!c.libreElegido || (!!c.jornada && c.marcas === 0));
}

/** Lo único que el calendario distingue de un día. */
type Tipo = 'presente' | 'tarde' | 'recuperada' | 'extra' | 'revisar' | 'justificada' | 'libre' | 'hoy' | 'futuro';

const COLOR: Record<Tipo, string> = {
  presente: 'bg-emerald-300 text-emerald-950 dark:bg-emerald-700 dark:text-emerald-50',
  tarde: 'bg-amber-400 text-amber-950',
  recuperada: 'bg-amber-400 text-amber-950',
  extra: 'bg-sky-300 text-sky-950 dark:bg-sky-700 dark:text-sky-50',
  revisar: 'bg-red-600 text-white',
  justificada: 'bg-teal-300 text-teal-950 dark:bg-teal-700 dark:text-teal-50',
  libre: 'text-muted-foreground/60',
  hoy: 'border-2 border-dashed border-border',
  futuro: 'text-muted-foreground/60',
};

/** El servidor acepta hasta 24 meses atrás (`MI_ASISTENCIA_MESES`). */
const MESES_ATRAS = 24;

function tipoDia(c: CeldaDia): Tipo {
  if (c.estado === 'futuro') return 'futuro';
  if (c.estado === 'pendiente') return 'hoy';
  if (c.estado === 'justificado') return 'justificada';
  if (c.estado === 'ausente' || c.sinSalida || c.estado === 'sin_entrada') return 'revisar';
  if (tardanza(c)) return compensada(c) ? 'recuperada' : 'tarde';
  if (horasExtraDia(c)) return 'extra';
  return c.marcas > 0 ? 'presente' : 'libre';
}

function Simbolo({ c }: { c: CeldaDia }) {
  if (c.libreElegido && !c.marcas) return <>L</>;
  const t = tipoDia(c);
  if (t === 'recuperada') return <Check className="size-4" strokeWidth={3.5} aria-hidden />;
  return <>{t === 'tarde' ? 'T' : t === 'revisar' ? '!' : t === 'justificada' ? 'J' : t === 'extra' ? masHoras(horasExtraDia(c)) : ''}</>;
}

/** "2026-09-22" → "Martes 22 de septiembre". */
function diaTitulo(fecha: string): string {
  const s = fmtDiaLargo(fecha);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** 542 → "9 horas y 2 minutos". */
function horasLargo(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h && plural(h, 'hora', 'horas'), m && plural(m, 'minuto', 'minutos')].filter(Boolean).join(' y ') || '0 horas';
}

/** Qué pasó ese día, en una frase. */
function fraseDia(c: CeldaDia): string {
  const t = tardanza(c);
  const rec = c.extra?.compensado ?? 0;
  if (c.libreElegido && !c.marcas) return 'Es tu sábado libre del mes.';
  if (c.estado === 'futuro') return c.jornada ? 'Te toca trabajar.' : 'Día libre.';
  if (c.estado === 'ausente') return 'No hay marcas tuyas este día. Si viniste, avisale a RR.HH.';
  if (c.estado === 'justificado') return 'Faltaste con justificativo: RR.HH. lo aprobó y el día se te paga.';
  if (c.sinSalida) return 'Falta tu marca de salida. Si fichaste al salir, avisale a RR.HH.';
  if (c.estado === 'sin_entrada') return 'Falta tu marca de entrada. Avisale a RR.HH.';
  // Un día tarde también puede sumar horas extra (el calendario muestra un solo símbolo: lo dice la frase).
  if (compensada(c) && horasExtraDia(c)) return `Llegaste ${plural(t, 'minuto', 'minutos')} tarde, lo recuperaste y además hiciste ${horasLargo(horasExtraDia(c) * 60)} extra.`;
  if (compensada(c)) return `Llegaste ${plural(t, 'minuto', 'minutos')} tarde, pero lo recuperaste quedándote después de hora.`;
  if (t && rec > 0) return `Llegaste ${plural(t, 'minuto', 'minutos')} tarde y recuperaste ${plural(rec, 'minuto', 'minutos')}.`;
  if (t) return `Llegaste ${plural(t, 'minuto', 'minutos')} tarde.`;
  if (horasExtraDia(c)) return `Hiciste ${horasLargo(horasExtraDia(c) * 60)} extra.`;
  if (c.estado === 'pendiente') return 'Todavía no hay marcas tuyas hoy.';
  if (c.estado === 'feriado' && !c.marcas) return 'Feriado.';
  // Sin horario no hay "a horario" ni "día libre": solo se sabe si fichó.
  if (c.estado === 'sin_horario') return c.marcas ? 'Fichaste este día. No tenés horario cargado.' : 'No tenés horario cargado este día.';
  if (!c.marcas) return 'Día libre.';
  return c.estado === 'trabajo_no_laborable' ? 'Viniste un día libre.' : 'Viniste a horario.';
}

export default function MiAsistenciaPage() {
  const [hoy] = useState(() => hoyLocal());
  const mesActual = hoy.slice(0, 7);
  const [mes, setMes] = useState(mesActual);
  const [data, setData] = useState<MiAsistenciaRespuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Mes al que corresponde lo último que llegó (dato o error): mientras no coincide con el pedido,
  // se sigue mostrando el anterior atenuado.
  const [mesCargado, setMesCargado] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  // Sube después de mandar un justificativo: vuelve a pedir el mes.
  const [recarga, setRecarga] = useState(0);
  const loading = mesCargado !== mes;
  const mesMinimo = (() => {
    const [y, m] = mesActual.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1 - MESES_ATRAS, 1)).toISOString().slice(0, 7);
  })();

  useEffect(() => {
    if (!MES_RE.test(mes)) return;
    const ac = new AbortController();
    apiFetch<MiAsistenciaRespuesta>(`/api/admin/mi-asistencia?mes=${mes}`, { signal: ac.signal })
      .then((d) => { setData(d); setError(null); setMesCargado(mes); })
      .catch((e: unknown) => { if (!ac.signal.aborted) { setError(mensajeError(e)); setMesCargado(mes); } });
    return () => ac.abort();
  }, [mes, recarga]);

  if (data && !data.vinculado) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5 text-lg">
        <VolverInicio />
        <h1 className="text-2xl font-bold sm:text-3xl">Mi asistencia</h1>
        <Empty title="Tu usuario no está vinculado a una ficha del organigrama">
          Para ver tu asistencia, un administrador tiene que vincular la cuenta <span className="font-medium text-foreground">{data.usuario}</span> con tu ficha desde Usuarios («Ficha del organigrama»).
        </Empty>
      </div>
    );
  }

  const d = data && data.vinculado ? data : null;
  const celdaAbierta = d && abierto ? d.celdas.find((c) => c.fecha === abierto) : undefined;
  // El año solo se aclara si no es el actual.
  const nombreMes = mes.slice(0, 4) === mesActual.slice(0, 4) ? fmtMes(mes).split(' ')[0] : fmtMes(mes);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 text-lg sm:space-y-6 sm:text-xl">
      <VolverInicio />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold sm:text-3xl">Mi asistencia</h1>
        <nav aria-label="Elegir mes" className="flex w-full items-center justify-between gap-3 sm:w-auto">
          <Button variant="outline" className="size-14" aria-label="Mes anterior" disabled={mes <= mesMinimo} onClick={() => setMes(mesAnterior(mes))}>
            <ChevronLeft className="size-7" />
          </Button>
          <span className="text-center text-2xl font-bold sm:min-w-48">{nombreMes}</span>
          <Button variant="outline" className="size-14" aria-label="Mes siguiente" disabled={mes >= mesActual} onClick={() => setMes(mesSiguiente(mes))}>
            <ChevronRight className="size-7" />
          </Button>
        </nav>
      </div>

      {error && <Banner variant="warn">{error}</Banner>}

      {!d ? (
        !error && (
          <div className="space-y-5">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        )
      ) : (
        <div className={cn('space-y-5 sm:space-y-6', loading && 'opacity-60')}>
          {d.personas.length === 0 && (
            <Banner variant="info">Tu ficha no tiene legajo en ningún reloj, así que no hay marcas para mostrar. Avisale a RR.HH.</Banner>
          )}
          {d.mes.tieneHorario ? (
            <Resumen r={d.mes.resumen} enCurso={mes === mesActual} sabado={d.sabadoLibre} />
          ) : (
            <Banner variant="info">No tenés horario cargado este mes: solo se muestran los días que fichaste. Si creés que es un error, hablá con RR.HH.</Banner>
          )}
          <Calendario celdas={d.celdas} sabado={d.sabadoLibre} onAbrir={setAbierto} />
        </div>
      )}

      <Dialog open={!!celdaAbierta} onOpenChange={(o) => !o && setAbierto(null)}>
        <DialogContent
          aria-describedby={undefined}
          className="top-auto bottom-0 left-0 max-h-[90dvh] max-w-full translate-x-0 translate-y-0 gap-5 overflow-y-auto rounded-t-2xl rounded-b-none bg-card p-5 text-lg sm:top-[50%] sm:bottom-auto sm:left-[50%] sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl"
        >
          {celdaAbierta && (
            <DetalleDia c={celdaAbierta} marcas={d!.marcas.filter((m) => m.fecha === celdaAbierta.fecha)}>
              <JustificarDia
                c={celdaAbierta}
                justificacion={d!.justificaciones.find((j) => j.fecha === celdaAbierta.fecha)}
                enPlazo={celdaAbierta.fecha >= d!.justificarDesde}
                onEnviado={() => setRecarga((n) => n + 1)}
              />
              {sabadoElegible(celdaAbierta, d!.sabadoLibre) && (
                <ElegirSabadoLibre c={celdaAbierta} actual={d!.sabadoLibre.fecha} onCambio={() => setRecarga((n) => n + 1)} />
              )}
            </DetalleDia>
          )}
          <DialogClose asChild>
            <Button className="h-14 w-full text-lg">Cerrar</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VolverInicio() {
  return (
    <Link href="/admin" className="inline-flex min-h-11 items-center gap-2 text-base text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-5" /> Volver a inicio
    </Link>
  );
}

/** Cuadrado de color con su símbolo: el mismo en el resumen y en el calendario. */
function Muestra({ tipo, children }: { tipo: Tipo; children?: ReactNode }) {
  return <span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-base font-bold', COLOR[tipo])} aria-hidden>{children}</span>;
}

function Linea({ muestra, children }: { muestra: ReactNode; children: ReactNode }) {
  return <li className="flex items-center gap-4 py-4">{muestra}<span>{children}</span></li>;
}

/** El mes en frases cortas. Una frase aparece solo si tiene algo que decir. */
function Resumen({ r, enCurso, sabado }: { r: ResumenLiquidacion; enCurso: boolean; sabado: SabadoLibre }) {
  const esperadas = Math.round((enCurso ? r.minutosEsperadosHastaHoy : r.minutosEsperadosMes) / 60);
  const recuperadas = tardesCompensadas(r);
  const extra = r.horasExtra50 + r.horasExtra100;
  const revisar = new Set([...r.ausentes, ...r.sinSalida, ...r.sinEntrada]).size;
  const vino = r.laborables - r.ausentes.length - r.justificados.length;
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-card px-5 sm:px-6">
      <Linea muestra={<Muestra tipo="presente" />}>
        {enCurso ? 'Hasta hoy viniste' : 'Viniste'} <strong>{vino} de {plural(r.laborables, 'día', 'días')}</strong>
      </Linea>
      <Linea muestra={<span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border-2 border-border text-muted-foreground" aria-hidden><Clock className="size-5" /></span>}>
        Trabajaste <strong>{plural(Math.floor(r.minutosTrabajados / 60), 'hora', 'horas')}</strong> de {esperadas}
      </Linea>
      <Linea muestra={<Muestra tipo="tarde">T</Muestra>}>
        {r.tardes.length ? <>Llegaste tarde <strong>{plural(r.tardes.length, 'vez', 'veces')}</strong></> : 'No llegaste tarde ningún día'}
      </Linea>
      {r.tardes.length > 0 && (
        <Linea muestra={<Muestra tipo="recuperada"><Check className="size-5" strokeWidth={3.5} /></Muestra>}>
          Recuperaste <strong>{recuperadas}</strong> de esas veces
        </Linea>
      )}
      {extra > 0 && (
        <Linea muestra={<Muestra tipo="extra">+</Muestra>}>
          Hiciste <strong>{horasLargo(extra * 60)}</strong> extra
        </Linea>
      )}
      {r.justificados.length > 0 && (
        <Linea muestra={<Muestra tipo="justificada">J</Muestra>}>
          <strong>{plural(r.justificados.length, 'falta justificada', 'faltas justificadas')}</strong>
        </Linea>
      )}
      {(sabado.puede || sabado.fecha) && (
        <Linea muestra={<Muestra tipo="libre">L</Muestra>}>
          {sabado.fecha
            ? <>Tu sábado libre: <strong>{diaTitulo(sabado.fecha).toLowerCase()}</strong></>
            : 'Todavía no elegiste tu sábado libre. Tocá un sábado del calendario.'}
        </Linea>
      )}
      {revisar > 0 && (
        <Linea muestra={<Muestra tipo="revisar">!</Muestra>}>
          <strong>{plural(revisar, 'día', 'días')}</strong> para revisar con RR.HH.
        </Linea>
      )}
    </ul>
  );
}

function Calendario({ celdas, sabado, onAbrir }: { celdas: CeldaDia[]; sabado: SabadoLibre; onAbrir: (fecha: string) => void }) {
  // 0 = lunes: huecos antes del día 1.
  const huecos = (new Date(`${celdas[0]?.fecha}T12:00:00Z`).getUTCDay() + 6) % 7;
  return (
    <section aria-label="Calendario del mes" className="space-y-3 rounded-2xl border border-border bg-card p-3 sm:p-5">
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {DIAS_SEMANA_LARGO.map((n) => (
          <span key={n} className="text-center text-base font-semibold text-muted-foreground">
            <span className="sm:hidden">{n.slice(0, 2)}</span>
            <span className="hidden sm:inline">{n}</span>
          </span>
        ))}
        {Array.from({ length: huecos }, (_, i) => <span key={`h${i}`} aria-hidden />)}
        {celdas.map((c) => {
          const tipo = tipoDia(c);
          return (
            <button
              key={c.fecha}
              type="button"
              disabled={tipo === 'futuro' && !sabadoElegible(c, sabado)}
              onClick={() => onAbrir(c.fecha)}
              aria-label={`${diaTitulo(c.fecha)}. ${fraseDia(c)}`}
              className={cn(
                'flex h-16 flex-col items-center justify-start gap-0.5 rounded-lg pt-2 leading-tight focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:h-20 sm:pt-3',
                COLOR[tipo],
              )}
            >
              <span className="text-xl font-semibold sm:text-2xl">{Number(c.fecha.slice(8))}</span>
              <span className="text-base font-bold sm:text-lg"><Simbolo c={c} /></span>
            </button>
          );
        })}
      </div>
      <p className="pt-1 text-center text-base text-muted-foreground">Tocá un día para ver a qué hora entraste y saliste.</p>
    </section>
  );
}

function DetalleDia({ c, marcas, children }: { c: CeldaDia; marcas: Marca[]; children?: ReactNode }) {
  const tipo = tipoDia(c);
  return (
    <div className="space-y-5">
      <DialogTitle className="pr-8 text-2xl leading-tight font-bold">{diaTitulo(c.fecha)}</DialogTitle>
      <p className="flex items-start gap-3 rounded-xl bg-muted p-4 leading-relaxed">
        {tipo !== 'libre' && tipo !== 'hoy' && <Muestra tipo={tipo}><Simbolo c={c} /></Muestra>}
        <span>{fraseDia(c)}</span>
      </p>
      {(c.entrada || c.salida) && (
        <ul className="divide-y divide-border text-xl">
          <li className="py-3">{c.entrada ? <>Entraste a las <strong className="font-mono">{fmtHoraCorta(c.entrada)}</strong></> : 'No hay marca de entrada'}</li>
          <li className="py-3">{c.salida ? <>Saliste a las <strong className="font-mono">{fmtHoraCorta(c.salida)}</strong></> : 'No hay marca de salida'}</li>
          {c.minutosTrabajados != null && <li className="py-3">Trabajaste <strong>{horasLargo(c.minutosTrabajados)}</strong></li>}
        </ul>
      )}
      {marcas.length > 2 && (
        <p className="text-base text-muted-foreground">Todas tus marcas del reloj: <span className="font-mono">{marcas.map((m) => fmtHoraCorta(m.fechaHora)).join(' · ')}</span></p>
      )}
      {children}
      <p className="text-base text-muted-foreground">¿No es lo que fichaste? Hablá con RR.HH.</p>
    </div>
  );
}

/** Justificativo de un día ausente: lo que ya se mandó y cómo terminó, o el formulario para mandarlo. */
function JustificarDia({ c, justificacion: j, enPlazo, onEnviado }: { c: CeldaDia; justificacion?: Justificacion; enPlazo: boolean; onEnviado: () => void }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verDocumento = j && (
    <a href={`/api/admin/mi-asistencia/justificaciones/${j.id}/archivo`} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">Ver lo que mandaste</a>
  );
  if (j?.estado === 'pendiente') return <Banner variant="info">Mandaste un justificativo para este día. RR.HH. lo está revisando. {verDocumento}</Banner>;
  if (j?.estado === 'rechazada') return <Banner variant="warn">RR.HH. no aceptó tu justificativo y el día queda como ausente. Motivo: «{j.motivoRechazo}» {verDocumento}</Banner>;
  if (c.estado !== 'ausente' || j) return null;
  if (!enPlazo) return <p className="text-base text-muted-foreground">Ya pasó el plazo para justificar este día: se puede el mes en curso y el anterior.</p>;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!archivo) return;
    const form = new FormData();
    form.set('fecha', c.fecha);
    form.set('archivo', archivo);
    form.set('comentario', comentario);
    setEnviando(true);
    setError(null);
    try {
      await apiFetch('/api/admin/mi-asistencia/justificaciones', { method: 'POST', body: form });
      onEnviado();
    } catch (err) {
      setError(mensajeError(err));
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4 rounded-xl border border-border p-4">
      <p className="font-semibold">¿Faltaste por un motivo justificado?</p>
      <p className="text-base text-muted-foreground">Subí el certificado (médico, de examen…) en PDF o una foto. RR.HH. lo revisa.</p>
      <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 text-center text-base font-medium hover:bg-muted focus-within:ring-[3px] focus-within:ring-ring/50">
        <Paperclip className="size-5 shrink-0" aria-hidden />
        <span className="truncate">{archivo ? archivo.name : 'Elegir el documento'}</span>
        <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
      </label>
      <Textarea value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={500} placeholder="Comentario para RR.HH. (opcional)" className="text-base" />
      {error && <Banner variant="warn">{error}</Banner>}
      <Button type="submit" className="h-14 w-full text-lg" disabled={!archivo || enviando}>{enviando ? 'Enviando…' : 'Enviar justificativo'}</Button>
    </form>
  );
}

/** Elegir este sábado como el libre del mes (reemplaza al que tenía) o dejar de tenerlo libre. Sin aprobación. */
function ElegirSabadoLibre({ c, actual, onCambio }: { c: CeldaDia; actual: string | null; onCambio: () => void }) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(init: RequestInit) {
    setGuardando(true);
    setError(null);
    try {
      await apiFetch('/api/admin/mi-asistencia/sabado-libre', init);
      onCambio();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      {c.libreElegido ? (
        <Button variant="outline" className="h-14 w-full text-lg" disabled={guardando} onClick={() => guardar({ method: 'DELETE' })}>
          Ya no lo quiero libre
        </Button>
      ) : (
        <>
          <p className="text-base text-muted-foreground">
            {actual ? `Tu sábado libre de este mes es el ${Number(actual.slice(8))}. Podés cambiarlo por este.` : 'Una vez por mes podés elegir un sábado para no venir.'}
          </p>
          <Button className="h-14 w-full text-lg" disabled={guardando} onClick={() => guardar({ method: 'POST', body: JSON.stringify({ fecha: c.fecha }) })}>
            {actual ? 'Cambiar mi sábado libre a este' : 'Elegir este sábado como libre'}
          </Button>
        </>
      )}
      {error && <Banner variant="warn">{error}</Banner>}
    </div>
  );
}
