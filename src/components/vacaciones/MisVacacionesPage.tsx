'use client';

/**
 * Mis vacaciones: el portal de la persona (rol `empleado` o cualquiera con el módulo), pensado
 * para gente que no usa sistemas todos los días. Una sola página que cambia según el estado:
 * elegir fechas → enviadas → aprobadas (con el aviso escrito). En el celular las piezas se apilan;
 * en pantalla ancha el calendario va a la izquierda y el resumen a la derecha. Todo el cálculo es
 * del servidor (`vacaciones-calc.ts`); acá solo se muestra y se valida en vivo con `validar`.
 * El calendario para elegir es el mismo que usa RR.HH. al cargar en nombre de alguien (`ElegirFechas`).
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CalendarDays, Check, Clock, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, ErrorCarga } from '@/components/comunes/ui';
import { noReprog } from '@/lib/vacaciones-calc';
import { diffDias } from '@/lib/fechas';
import type { VistaRespuesta } from '@/lib/vacaciones';
import { cn } from '@/lib/utils';
import { Aviso, BOTON_GRANDE, ElegirFechas, ListaFechas, Progreso, colorBoton, estadoEnvio, useVista, type Accion } from './ElegirFechas';
import { diaMes, diaMesMMDD, fechaLarga, primerNombre } from './piezas';

const URL_API = '/api/admin/mis-vacaciones';
const DOC = '/admin/mis-vacaciones/documento?tipo=';
// Violeta = RR.HH. (decisión del usuario): acciones principales y selección.
const VIOLETA = colorBoton('persona');

export default function MisVacacionesPage() {
  const { data, sinVinculo, error, ocupado, cargar, accion } = useVista(URL_API);

  if (sinVinculo) {
    return (
      <Empty title="Tu usuario no está vinculado a una ficha">
        Para ver tus vacaciones, pedile a RR.HH. que vincule la cuenta <span className="font-medium text-foreground">{sinVinculo}</span> con tu ficha.
      </Empty>
    );
  }
  if (!data) {
    return error ? <ErrorCarga error={error} onReintentar={cargar} /> : (
      <div className="space-y-4">
        <Skeleton className="h-16 w-64" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  const editable = data.sol.estado === 'borrador' || data.sol.estado === 'rechazada';

  return (
    <div className="space-y-6 text-base">
      <Link href="/admin" className="-my-2 inline-flex h-11 items-center gap-1.5 text-muted-foreground hover:text-foreground lg:hidden">
        <ArrowLeft className="size-5" /> Volver al inicio
      </Link>
      <header className="space-y-1">
        <p className="text-lg text-muted-foreground">Hola, {primerNombre(data.empleado.nombre)}</p>
        <h1 className="text-3xl font-bold">Mis vacaciones</h1>
      </header>

      {editable ? <Eleccion v={data} accion={accion} ocupado={ocupado} />
        : data.sol.estado === 'enviada' ? <Enviadas v={data} accion={accion} ocupado={ocupado} />
        : <Aprobadas v={data} accion={accion} ocupado={ocupado} />}
    </div>
  );
}

// ─── Piezas ─────────────────────────────────────────────────────────────────

function Caja({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-2xl border bg-card p-5 shadow-sm sm:p-6', className)}>{children}</section>;
}

function Titular({ icono, tono, titulo, children }: { icono: ReactNode; tono: 'violeta' | 'verde' | 'ambar'; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className={cn(
        'flex size-14 shrink-0 items-center justify-center rounded-full',
        tono === 'violeta' && 'bg-violet-600/20 text-violet-600 dark:text-violet-400',
        tono === 'verde' && 'bg-emerald-600 text-white',
        tono === 'ambar' && 'bg-muted text-amber-700 dark:text-amber-400',
      )}>{icono}</span>
      <div className="min-w-60 flex-1 space-y-1">
        <h2 className="text-2xl font-bold">{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

const PASOS = ['Elegís tus fechas', 'RR.HH. las aprueba', 'Recibís el aviso por escrito'];

/** `actual`: índice del paso en curso; los anteriores se muestran hechos (3 = todos hechos). */
function Pasos({ actual, className }: { actual: number; className?: string }) {
  return (
    <section className={cn('space-y-3.5 px-1', className)}>
      <h2 className="text-lg font-semibold">Cómo sigue</h2>
      <ol className="space-y-3.5">
        {PASOS.map((p, i) => (
          <li key={p} className="flex items-center gap-3.5" aria-current={i === actual ? 'step' : undefined}>
            <span className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full font-semibold',
              i < actual && 'bg-emerald-600 text-white',
              i === actual && 'bg-violet-600 text-white',
              i > actual && 'border-2 border-input text-muted-foreground',
            )}>
              {i < actual ? <Check className="size-4" strokeWidth={3} aria-label="Hecho" /> : i + 1}
            </span>
            <span className={cn('text-lg', i === actual ? 'font-semibold' : i > actual && 'text-muted-foreground')}>{p}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ─── Elegir fechas (borrador o devuelta) ────────────────────────────────────

function Eleccion({ v, accion, ocupado }: { v: VistaRespuesta; accion: Accion; ocupado: boolean }) {
  const s = v.sol;
  const { restan, partido, pista, bloqueo, puedeEnviar } = estadoEnvio(v, 'persona');
  // Sin días calculables no hay nada que elegir: un aviso claro en vez de «Elegiste todos tus días».
  if (bloqueo) return <Aviso icono={<AlertCircle className="size-6" />}>{bloqueo}</Aviso>;

  return (
    <div className="space-y-6">
      {s.estado === 'rechazada' && (
        <Aviso icono={<AlertCircle className="size-6" />}>
          <p className="font-semibold">RR.HH. te pidió un cambio</p>
          {s.motivo && <p className="mt-1">«{s.motivo}»</p>}
        </Aviso>
      )}
      {!v.turno.abierto && (
        <Aviso icono={<CalendarDays className="size-6" />}>
          Ya podés elegir tus fechas. Vas a poder enviarlas desde el <b>{fechaLarga(v.turno.apertura)}</b>.
        </Aviso>
      )}
      {v.limiteVencido && (
        <Aviso icono={<AlertCircle className="size-6" />}>
          Se pasó la fecha para elegir ({diaMes(v.fechaLimite)}). Pedile a RR.HH. que te habilite para enviarlas.
        </Aviso>
      )}
      {v.verano.debe && (
        <Aviso icono={<CalendarDays className="size-6" />}>
          Este año te toca verano: elegí al menos una parte entre el {diaMesMMDD(v.verano.desde)} y el {diaMesMMDD(v.verano.hasta)}.
        </Aviso>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        <Caja className="space-y-4 lg:col-start-2 lg:row-start-1">
          <div className="space-y-1">
            <p className="text-lg text-muted-foreground">Este año te corresponden</p>
            <p className="font-mono text-5xl font-semibold">{v.dias.total} días</p>
            <p className="text-lg">Para tomar entre el {diaMes(v.temporada.desde)} y el {diaMes(v.temporada.hasta)}.</p>
          </div>
          <Progreso usados={v.usados} total={v.dias.total} texto={`Elegiste ${v.usados} de ${v.dias.total} días`} />
        </Caja>

        <Caja className="lg:col-start-1 lg:row-span-3 lg:row-start-1">
          {restan > 0 ? <ElegirFechas v={v} url={URL_API} voz="persona" accion={accion} ocupado={ocupado} /> : (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-emerald-600 text-white"><Check className="size-8" strokeWidth={2.5} /></span>
              <h2 className="text-2xl font-bold">Elegiste todos tus días</h2>
              <p className="text-lg text-muted-foreground">Revisá tus fechas y envialas a RR.HH.</p>
            </div>
          )}
        </Caja>

        <Caja className="space-y-4 lg:col-start-2 lg:row-start-2">
          <h2 className="text-lg font-semibold">Tus fechas</h2>
          <ListaFechas v={v} voz="persona" accion={accion} ocupado={ocupado} editable />
          {partido && (
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-lg leading-snug">
                <Checkbox
                  checked={!!s.acuerdoFracc}
                  disabled={ocupado}
                  onCheckedChange={(c) => accion({ accion: 'conformidad', acepta: c === true })}
                  className="mt-0.5 size-6 data-[state=checked]:border-violet-600 data-[state=checked]:bg-violet-600"
                />
                <span>Estoy de acuerdo en tomar mis vacaciones en {noReprog(s).length} partes.</span>
              </label>
              <a href={`${DOC}fraccionamiento`} target="_blank" rel="noopener" className="inline-flex h-11 items-center gap-1.5 text-muted-foreground underline underline-offset-4 hover:text-foreground">
                <FileText className="size-4" /> Ver el acuerdo
              </a>
            </div>
          )}
          <Button className={cn(BOTON_GRANDE, 'w-full', VIOLETA)} disabled={!puedeEnviar || ocupado} onClick={() => accion({ accion: 'enviar' }, 'Enviaste tus fechas a RR.HH.')}>
            Enviar a RR.HH.
          </Button>
          {pista && <p className="text-center text-muted-foreground">{pista}</p>}
        </Caja>

        <Pasos actual={0} className="lg:col-start-2 lg:row-start-3" />
      </div>
    </div>
  );
}

// ─── Enviadas y aprobadas ───────────────────────────────────────────────────

function Enviadas({ v, accion, ocupado }: { v: VistaRespuesta; accion: Accion; ocupado: boolean }) {
  return (
    <div className="space-y-6">
      <Titular icono={<Clock className="size-7" />} tono="violeta" titulo="Enviaste tus fechas">
        <p className="text-lg text-muted-foreground">RR.HH. las está revisando. Cuando las apruebe lo vas a ver acá.</p>
      </Titular>
      <div className="grid gap-6 lg:grid-cols-2">
        <Caja className="space-y-2">
          <h2 className="text-lg font-semibold">Tus fechas</h2>
          <ListaFechas v={v} voz="persona" editable={false} />
        </Caja>
        <Caja><Pasos actual={1} /></Caja>
      </div>
      <Button variant="outline" className={BOTON_GRANDE} disabled={ocupado} onClick={() => accion({ accion: 'retirar' }, 'Podés cambiar tus fechas')}>
        Quiero cambiar mis fechas
      </Button>
    </div>
  );
}

function Aprobadas({ v, accion, ocupado }: { v: VistaRespuesta; accion: Accion; ocupado: boolean }) {
  const a = v.aviso;
  const faltan = a?.primero ? diffDias(v.hoy, a.primero) : null;
  const varias = noReprog(v.sol).length > 1;
  return (
    <div className="space-y-6">
      <Titular icono={<Check className="size-8" strokeWidth={2.5} />} tono="verde" titulo="Tus vacaciones están aprobadas">
        {faltan != null && faltan > 0 && (
          <p className="text-lg text-muted-foreground">Faltan {faltan} días para {varias ? 'la primera parte' : 'que empiecen'}.</p>
        )}
      </Titular>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Caja className="space-y-2">
          <h2 className="text-lg font-semibold">Tus fechas</h2>
          <ListaFechas v={v} voz="persona" accion={accion} ocupado={ocupado} editable={false} />
        </Caja>
        <Caja className="space-y-4">
          {!a?.notificada ? (
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 size-6 shrink-0 text-violet-600 dark:text-violet-400" />
              <p className="text-lg">RR.HH. te va a mandar el aviso por escrito antes de que empiecen.</p>
            </div>
          ) : !a.acuse ? (
            <>
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 size-6 shrink-0 text-violet-600 dark:text-violet-400" />
                <div className="space-y-1">
                  <p className="text-lg font-semibold">Te llegó el aviso por escrito</p>
                  <p className="text-muted-foreground">Leelo y confirmá que lo recibiste.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button className={cn(BOTON_GRANDE, VIOLETA)} disabled={ocupado} onClick={() => accion({ accion: 'acusar' }, 'Confirmaste que recibiste el aviso')}>
                  Confirmar que lo recibí
                </Button>
                <Button variant="outline" className={BOTON_GRANDE} asChild>
                  <a href={`${DOC}notificacion`} target="_blank" rel="noopener">Ver el aviso</a>
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Check className="size-6 shrink-0 text-emerald-600" strokeWidth={3} />
              <div className="min-w-40 flex-1">
                <p className="text-lg font-semibold">Aviso recibido</p>
                <p className="text-muted-foreground">Lo confirmaste el {diaMes(a.acuse)}. No tenés que hacer nada más.</p>
              </div>
              <Button variant="outline" className="h-11" asChild>
                <a href={`${DOC}notificacion`} target="_blank" rel="noopener">Ver</a>
              </Button>
            </div>
          )}
        </Caja>
      </div>

      {v.pendienteReprog > 0 && (
        <Caja className="space-y-4">
          <Aviso icono={<CalendarDays className="size-6" />}>
            Tus vacaciones se interrumpieron y te quedan <b>{v.pendienteReprog} días</b> para recuperar. Elegí cuándo y RR.HH. lo confirma.
          </Aviso>
          <ElegirFechas v={v} url={URL_API} voz="persona" accion={accion} ocupado={ocupado} reprog />
        </Caja>
      )}
    </div>
  );
}
