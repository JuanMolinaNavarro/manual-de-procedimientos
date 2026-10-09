'use client';

/**
 * Elegir fechas de vacaciones en un calendario donde solo se tocan los inicios válidos, con la
 * cantidad de días y la validación del servidor en vivo. Lo usan Mis vacaciones (la persona, en
 * segunda persona y con violeta) y «Cargar sus fechas» de RR.HH. (en tercera persona, neutro).
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { AlertCircle, CalendarDays, Check, ChevronLeft, ChevronRight, Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { mensajeError, nominaFetch } from '@/components/nomina/api';
import { mesAnterior, mesSiguiente, sumarDias } from '@/lib/fechas';
import { TEXTO_PORTAL, noReprog, vueltaDe, type Flag } from '@/lib/vacaciones-calc';
import type { VistaRespuesta } from '@/lib/vacaciones';
import { cn } from '@/lib/utils';
import {
  MESES,
  diaMes,
  fechaLarga,
  partesFecha,
  primerNombre,
  rangoCorto,
  sinArticulo,
  sinCita,
  usePrevia,
} from './piezas';

export type Accion = (body: Record<string, unknown>, ok?: string) => Promise<boolean>;
/** Quién elige: la persona en su portal o RR.HH. en su nombre. */
export type Voz = 'persona' | 'rrhh';

const TEXTOS: Record<Voz, {
  titulo: string; tituloReprog: string; ayuda: string; eligiendo: string; yaTiene: string; leQuedan: string; vuelve: string;
  vuelveCorto: string; todosLosQueQuedan: string; fueraDeTemporada: (fin: string) => string; agregar: string; pedirReprog: string;
  sugerir: string; okAgregar: string; okReprog: string; sinFechas: string; sinFechasReprog: string; sinLugar: string; vacio: string;
  limpiar: (msg: string) => string;
}> = {
  persona: {
    titulo: '¿Cuándo te vas?', tituloReprog: '¿Cuándo los recuperás?',
    ayuda: 'Tocá el día en que empezás. Solo se pueden tocar los días subrayados.',
    eligiendo: 'Lo que estás eligiendo', yaTiene: 'Fechas que ya tenés', leQuedan: 'te quedan',
    vuelve: 'Volvés a trabajar el', vuelveCorto: 'volvés el', todosLosQueQuedan: 'los que te quedan',
    fueraDeTemporada: (fin) => `Pido tomarlas después del ${fin}. La empresa lo tiene que aceptar.`,
    agregar: 'Agregar estas fechas', pedirReprog: 'Pedir estas fechas', sugerir: 'Sugerime fechas',
    okAgregar: 'Fechas agregadas', okReprog: 'Le pediste a RR.HH. estas fechas',
    sinFechas: 'Ya no quedan fechas para empezar vacaciones esta temporada. Consultalo con RR.HH.',
    sinFechasReprog: 'Ya no quedan fechas para recuperar esos días. Consultalo con RR.HH.',
    sinLugar: 'No encontramos fechas libres para esa cantidad de días. Probá con menos.',
    vacio: 'Todavía no elegiste fechas.',
    limpiar: sinArticulo,
  },
  rrhh: {
    titulo: '¿Cuándo se va?', tituloReprog: '¿Cuándo los recupera?',
    ayuda: 'Tocá el día en que empieza. Solo se pueden tocar los días subrayados.',
    eligiendo: 'Lo que estás cargando', yaTiene: 'Fechas que ya tiene', leQuedan: 'le quedan',
    vuelve: 'Vuelve a trabajar el', vuelveCorto: 'vuelve el', todosLosQueQuedan: 'los que le quedan',
    fueraDeTemporada: (fin) => `Las pide después del ${fin} y la empresa está de acuerdo.`,
    agregar: 'Agregar estas fechas', pedirReprog: 'Cargar estos días', sugerir: 'Sugerir fechas',
    okAgregar: 'Fechas agregadas', okReprog: 'Días cargados',
    sinFechas: 'Ya no quedan fechas para empezar vacaciones esta temporada.',
    sinFechasReprog: 'Ya no quedan fechas para recuperar esos días.',
    sinLugar: 'No hay fechas libres para esa cantidad de días. Probá con menos.',
    vacio: 'Todavía no tiene fechas.',
    limpiar: sinCita,
  },
};

/** Violeta en el portal (decisión del usuario: violeta = RR.HH.); en RR.HH. el primario neutro de Aurelius. */
const COLOR: Record<Voz, { boton: string; rango: string; extremo: string; elegido: string; casilla: string; icono: string }> = {
  persona: {
    boton: 'bg-violet-600 text-white hover:bg-violet-600/90',
    rango: 'bg-violet-600/20',
    extremo: 'bg-violet-600 text-white',
    elegido: 'border-violet-600 bg-violet-600 text-white',
    casilla: 'data-[state=checked]:border-violet-600 data-[state=checked]:bg-violet-600',
    icono: 'text-violet-600 dark:text-violet-400',
  },
  rrhh: {
    boton: '',
    rango: 'bg-primary/15',
    extremo: 'bg-primary text-primary-foreground',
    elegido: 'border-primary bg-primary text-primary-foreground',
    casilla: '',
    icono: 'text-muted-foreground',
  },
};

const TEXTOS_ENVIO: Record<Voz, {
  elegirPrimero: string; enviarDesde: (fecha: string) => string; marcarAcuerdo: string; quedanDias: (n: number) => string;
  noParticipa: string; sinIngreso: string; sinDias: string;
}> = {
  persona: {
    elegirPrimero: 'Elegí tus fechas para poder enviarlas.',
    enviarDesde: (f) => `Vas a poder enviarlas desde el ${f}.`,
    marcarAcuerdo: 'Marcá la casilla de arriba para poder enviar.',
    quedanDias: (n) => `Te quedan ${n} días sin elegir. Podés enviar igual y elegirlos después.`,
    noParticipa: TEXTO_PORTAL.noParticipa,
    sinIngreso: TEXTO_PORTAL.sinIngreso,
    sinDias: 'Este año todavía no te corresponden días de vacaciones. Si creés que es un error, consultalo con RR.HH.',
  },
  rrhh: {
    elegirPrimero: 'Elegí sus fechas para poder mandarlas.',
    enviarDesde: (f) => `Se van a poder mandar desde el ${f}.`,
    marcarAcuerdo: 'Marcá que firmó el acuerdo para poder mandarlas.',
    quedanDias: (n) => `Le quedan ${n} días sin elegir. Se pueden mandar igual.`,
    noParticipa: 'No participa de esta temporada. Se cambia en Personas.',
    sinIngreso: 'Falta su fecha de ingreso. Se carga en Nómina › Maestro.',
    sinDias: 'Este año todavía no le corresponden días de vacaciones.',
  },
};

/**
 * Si la selección (en borrador o devuelta) se puede mandar a aprobar, la pista que explica por
 * qué no, y el motivo por el que no hay nada que elegir (`bloqueo`, null si se puede elegir).
 */
export function estadoEnvio(v: VistaRespuesta, voz: Voz) {
  const s = v.sol, t = TEXTOS_ENVIO[voz];
  const restan = v.dias.total - v.usados;
  const partido = v.fraccionar && noReprog(s).length > 1;
  const error = v.validacion.find((f) => f.tipo === 'error');
  const pista = !s.tramos.length ? t.elegirPrimero
    : !v.turno.abierto ? t.enviarDesde(fechaLarga(v.turno.apertura))
    : partido && !s.acuerdoFracc ? t.marcarAcuerdo
    : error ? TEXTOS[voz].limpiar(error.msg)
    : restan > 0 ? t.quedanDias(restan) : null;
  const bloqueo = !v.participa ? t.noParticipa
    : v.dias.anios === null ? t.sinIngreso
    : v.dias.total === 0 ? t.sinDias
    : null;
  return { restan, partido, pista, bloqueo: s.tramos.length ? null : bloqueo, puedeEnviar: s.tramos.length > 0 && !error && v.turno.abierto };
}

/**
 * Carga la vista de una selección y aplica acciones sobre ella (cada POST devuelve la vista nueva).
 * El portal responde `{ vinculado: true, ...vista }` (convención de las rutas personales); un usuario
 * sin ficha vinculada recibe `{ vinculado: false }` y queda en `sinVinculo`.
 */
export function useVista(url: string) {
  const [data, setData] = useState<VistaRespuesta | null>(null);
  const [sinVinculo, setSinVinculo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(() => {
    nominaFetch<(VistaRespuesta & { vinculado?: true }) | { vinculado: false; usuario: string }>(url)
      .then((r) => {
        if (r.vinculado === false) setSinVinculo(r.usuario);
        else setData(r);
        setError(null);
      })
      .catch((e: unknown) => setError(mensajeError(e)));
  }, [url]);
  useEffect(() => { cargar(); }, [cargar]);

  const accion: Accion = async (body, ok) => {
    setOcupado(true);
    try {
      setData(await nominaFetch<VistaRespuesta>(url, { method: 'POST', body: JSON.stringify(body) }));
      if (ok) toast.success(ok);
      return true;
    } catch (e) {
      toast.error(mensajeError(e));
      return false;
    } finally {
      setOcupado(false);
    }
  };

  return { data, sinVinculo, error, ocupado, cargar, accion };
}

export const BOTON_GRANDE = 'h-12 px-6 text-base';
export const colorBoton = (voz: Voz) => COLOR[voz].boton;

export function Aviso({ icono, voz = 'persona', children }: { icono: ReactNode; voz?: Voz; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted p-4 text-lg leading-snug">
      <span className={cn('mt-0.5 shrink-0', COLOR[voz].icono)}>{icono}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Barra de días elegidos sobre el total. */
export function Progreso({ usados, total, texto }: { usados: number; total: number; texto: string }) {
  return (
    <div className="space-y-2">
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-emerald-600" style={{ width: `${Math.min(100, Math.round((usados / Math.max(1, total)) * 100))}%` }} />
      </div>
      <p className="font-medium">{texto}</p>
    </div>
  );
}

/** Las fechas elegidas, con «Quitar» cuando se pueden cambiar. Los cierres de la empresa también cuentan. */
export function ListaFechas({ v, voz, accion, ocupado, editable }: { v: VistaRespuesta; voz: Voz; accion?: Accion; ocupado?: boolean; editable: boolean }) {
  const t = TEXTOS[voz];
  const items = [
    ...v.sol.tramos.map((x) => ({ ...x, cierre: false, quitable: editable || (x.reprog && x.estadoTramo === 'pendiente') })),
    ...v.cierres.map((x) => ({ ...x, cierre: true, quitable: false })),
  ].sort((a, b) => a.desde.localeCompare(b.desde));
  if (!items.length) return <p className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">{t.vacio}</p>;
  return (
    <ul className="divide-y border-y">
      {items.map((x) => (
        <li key={x.desde} className="flex items-center gap-2 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">{rangoCorto(x.desde, x.hasta)}</p>
            <p className="text-muted-foreground">
              {x.dias} días · {t.vuelveCorto} {fechaLarga(vueltaDe(x.hasta, v.feriados, v.descanso))}
              {x.cierre && ' · cierre de la empresa'}
              {x.reprog && (x.estadoTramo === 'pendiente' ? ' · días recuperados, a confirmar' : ' · días recuperados')}
              {x.fueraTemp && ' · fuera de temporada, de común acuerdo'}
            </p>
          </div>
          {x.quitable && accion && (
            <Button variant="ghost" className="h-11 text-muted-foreground" disabled={ocupado}
              onClick={() => accion({ accion: 'quitarTramo', desde: x.desde }, 'Fechas quitadas')} aria-label={`Quitar del ${rangoCorto(x.desde, x.hasta)}`}>
              <Trash2 className="size-4" /> Quitar
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function Mes({ ym, celda }: { ym: string; celda: (f: string) => ReactNode }) {
  const [y, m] = partesFecha(ym);
  const blancos = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <h3 className="text-center text-lg font-semibold first-letter:uppercase">{MESES[m - 1]} {y}</h3>
      <div className="grid grid-cols-7 text-center text-sm font-medium text-muted-foreground" aria-hidden>
        {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: blancos }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: n }, (_, i) => celda(`${ym}-${String(i + 1).padStart(2, '0')}`))}
      </div>
    </div>
  );
}

function Problemas({ flags, limpiar }: { flags: Flag[]; limpiar: (msg: string) => string }) {
  if (!flags.length) return null;
  return (
    <div className="space-y-2">
      {flags.map((f) => (
        <p key={f.msg} className="flex items-start gap-2 text-lg leading-snug">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" />
          <span>{limpiar(f.msg)}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Calendario + cantidad de días + validación en vivo. Sirve para elegir vacaciones y, con
 * `reprog`, para pedir los días que quedaron sin gozar por una interrupción.
 */
export function ElegirFechas({ v, url, voz, accion, ocupado, reprog = false }: {
  v: VistaRespuesta; url: string; voz: Voz; accion: Accion; ocupado: boolean; reprog?: boolean;
}) {
  const t = TEXTOS[voz], color = COLOR[voz];
  const s = v.sol;
  const restan = reprog ? v.pendienteReprog : v.dias.total - v.usados;
  const min = reprog ? 1 : v.fraccionar ? Math.min(v.tramoMinimo, restan) : restan;
  const inicios = reprog ? v.inicios : v.inicios.filter((f) => f >= v.temporada.desde && f <= v.temporada.hasta);
  const primerMes = (inicios[0] ?? sumarDias(v.hoy, 1)).slice(0, 7);
  const ultimoMes = (inicios[inicios.length - 1] ?? v.temporada.hasta).slice(0, 7);

  const [desde, setDesde] = useState<string | null>(null);
  const [diasPedidos, setDias] = useState(restan);
  const [mes, setMes] = useState(primerMes);
  const [fueraAcuerdo, setFuera] = useState(false);

  const dias = Math.max(min, Math.min(restan, diasPedidos));
  const hasta = desde ? sumarDias(desde, dias - 1) : null;
  const previa = usePrevia(url, desde ? { desde, dias, ...(reprog ? { reprog: true } : { fueraAcuerdo }) } : null, s);
  const errores = previa?.filter((f) => f.tipo === 'error') ?? [];
  const avisos = previa?.filter((f) => f.tipo === 'warn') ?? [];
  const pideAcuerdo = !reprog && !!hasta && hasta > v.temporada.hasta;
  const ok = !!previa && errores.length === 0;

  if (!inicios.length) {
    return <Aviso voz={voz} icono={<CalendarDays className="size-6" />}>{reprog ? t.sinFechasReprog : t.sinFechas}</Aviso>;
  }

  const posibles = new Set(inicios);
  const ocupados = [...s.tramos, ...v.cierres];
  const celda = (f: string) => {
    const tomado = ocupados.some((x) => f >= x.desde && f <= x.hasta);
    const sel = !!desde && !!hasta && f >= desde && f <= hasta;
    const puede = posibles.has(f) && !tomado;
    const cls = cn(
      'flex h-11 items-center justify-center text-base tabular-nums',
      sel && color.rango,
      sel && (f === desde || f === hasta) && cn(color.extremo, 'font-semibold'),
      sel && f === desde && 'rounded-l-lg', sel && f === hasta && 'rounded-r-lg',
      !sel && tomado && 'bg-emerald-500/25',
      !sel && !tomado && (puede ? 'rounded-lg font-bold underline underline-offset-4 hover:bg-muted' : 'text-muted-foreground/50'),
    );
    const n = partesFecha(f)[2];
    if (!puede) return <span key={f} className={cls}>{n}</span>;
    return (
      <button key={f} type="button" className={cn(cls, 'cursor-pointer focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50')}
        aria-label={fechaLarga(f)} aria-pressed={f === desde} onClick={() => setDesde(f)}>
        {n}
      </button>
    );
  };

  async function sugerir() {
    try {
      const r = await nominaFetch<{ desde: string | null; dias: number }>(url, { method: 'POST', body: JSON.stringify({ accion: 'sugerir', dias }) });
      if (!r.desde) { toast.info(t.sinLugar); return; }
      setDesde(r.desde); setDias(r.dias); setMes(r.desde.slice(0, 7));
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  async function agregar() {
    if (!desde) return;
    const body = reprog ? { accion: 'reprogramar', desde, dias } : { accion: 'agregarTramo', desde, dias, fueraAcuerdo };
    if (await accion(body, reprog ? t.okReprog : t.okAgregar)) {
      setDesde(null); setFuera(false); setDias(restan - dias);
    }
  }

  const atajos = [[restan, `Todos (${restan})`], [14, '14 días'], [7, '7 días']]
    .filter(([n], i, xs) => +n >= min && +n <= restan && xs.findIndex(([m]) => m === n) === i) as [number, string][];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-56 flex-1 space-y-1">
          <h2 className="text-2xl font-bold">{reprog ? t.tituloReprog : t.titulo}</h2>
          <p className="text-muted-foreground">{t.ayuda}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="icon" className="size-11" aria-label="Mes anterior" disabled={mes <= primerMes} onClick={() => setMes(mesAnterior(mes))}>
            <ChevronLeft className="size-5" />
          </Button>
          <Button variant="outline" size="icon" className="size-11" aria-label="Mes siguiente" disabled={mes >= ultimoMes} onClick={() => setMes(mesSiguiente(mes))}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </div>

      <div className="flex gap-8">
        <Mes ym={mes} celda={celda} />
        <div className="hidden min-w-0 flex-1 lg:block"><Mes ym={mesSiguiente(mes)} celda={celda} /></div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground">
        <span className="flex items-center gap-2"><span className={cn('size-4 rounded', color.extremo)} />{t.eligiendo}</span>
        <span className="flex items-center gap-2"><span className="size-4 rounded bg-emerald-500/25" />{t.yaTiene}</span>
      </div>

      <div className="flex flex-wrap items-start gap-x-8 gap-y-6 border-t pt-6">
        <div className="min-w-64 flex-1 space-y-3">
          <h3 className="text-lg font-semibold">¿Cuántos días?</h3>
          {min === restan ? (
            <p className="text-lg">{restan} días{!reprog && (v.fraccionar ? `, ${t.todosLosQueQuedan}` : ', todos juntos')}</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="size-12" aria-label="Un día menos" disabled={dias <= min} onClick={() => setDias(dias - 1)}>
                  <Minus className="size-5" />
                </Button>
                <span className="min-w-14 text-center text-3xl font-bold tabular-nums" aria-live="polite">{dias}</span>
                <Button variant="outline" size="icon" className="size-12" aria-label="Un día más" disabled={dias >= restan} onClick={() => setDias(dias + 1)}>
                  <Plus className="size-5" />
                </Button>
                <span className="text-muted-foreground">{t.leQuedan} {restan}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {atajos.map(([n, txt]) => (
                  <button key={n} type="button" onClick={() => setDias(n)} aria-pressed={n === dias}
                    className={cn('h-11 rounded-full border px-4 font-medium focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      n === dias ? color.elegido : 'border-input hover:bg-muted')}>
                    {txt}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="min-w-64 flex-1 space-y-3" aria-live="polite">
          {!desde || !hasta ? (
            <p className="text-lg text-muted-foreground">Elegí el primer día en el calendario.</p>
          ) : (
            <>
              <p className="text-xl font-semibold">Del {fechaLarga(desde)} al {fechaLarga(hasta)}</p>
              <p className="text-lg text-muted-foreground">{t.vuelve} {fechaLarga(vueltaDe(hasta, v.feriados, v.descanso))}.</p>
              {!previa && <p className="text-muted-foreground">Revisando...</p>}
              {ok && (
                <p className="flex items-center gap-2 text-lg font-semibold">
                  <Check className="size-5 text-emerald-600" strokeWidth={3} /> Fechas disponibles
                </p>
              )}
              <Problemas limpiar={t.limpiar} flags={errores.filter((f) => !(pideAcuerdo && /acuerdo/.test(f.msg)))} />
              {pideAcuerdo && (
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-lg leading-snug">
                  <Checkbox checked={fueraAcuerdo} onCheckedChange={(c) => setFuera(c === true)} className={cn('mt-0.5 size-6', color.casilla)} />
                  <span>{t.fueraDeTemporada(diaMes(v.temporada.hasta))}</span>
                </label>
              )}
              {ok && avisos.map((f) => <p key={f.msg} className="text-muted-foreground">{t.limpiar(f.msg)}</p>)}
            </>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button className={cn(BOTON_GRANDE, color.boton)} disabled={!ok || ocupado} onClick={agregar}>
              <Plus className="size-5" /> {reprog ? t.pedirReprog : t.agregar}
            </Button>
            {!reprog && <Button variant="link" className="h-12 text-base" onClick={sugerir}>{t.sugerir}</Button>}
            {!reprog && v.conyuge && (
              <Button variant="link" className="h-12 text-base"
                onClick={() => { setDesde(v.conyuge!.desde); setDias(v.conyuge!.dias); setMes(v.conyuge!.desde.slice(0, 7)); }}>
                Coincidir con {primerNombre(v.conyuge.nombre)}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
