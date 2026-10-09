'use client';

/**
 * «Cargar sus fechas» (`/admin/vacaciones/seleccion/[id]`): RR.HH. elige las vacaciones en nombre
 * de una persona con el mismo calendario que Mis vacaciones, en tercera persona. Aprobar, avisar
 * y los cambios posteriores se hacen en la revisión de la solicitud (`Revisar.tsx`).
 */

import Link from 'next/link';
import { ArrowLeft, Check, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorCarga } from '@/components/comunes/ui';
import { noReprog } from '@/lib/vacaciones-calc';
import type { VistaRespuesta } from '@/lib/vacaciones';
import { cn } from '@/lib/utils';
import { docUrl } from './AccionesSolicitud';
import { ElegirFechas, ListaFechas, Progreso, estadoEnvio, useVista, type Accion } from './ElegirFechas';
import { BOTON, EstadoChip, Linea, Persona, diaMes, diaMesMMDD, fechaLarga } from './piezas';

const BANDEJA = '/admin/vacaciones?tab=solicitudes';

export default function CargarFechasPage({ empleadoId }: { empleadoId: number }) {
  const url = `/api/admin/vacaciones/seleccion/${empleadoId}`;
  const { data: v, error, ocupado, cargar, accion } = useVista(url);

  const volver = (
    <Button variant="ghost" className={cn(BOTON, '-ml-3')} asChild>
      <Link href={BANDEJA}><ArrowLeft className="h-5 w-5" /> Volver a solicitudes</Link>
    </Button>
  );
  if (!v) {
    return (
      <div className="space-y-4">
        {volver}
        {error ? <ErrorCarga error={error} onReintentar={cargar} /> : <Skeleton className="h-96 w-full rounded-xl" />}
      </div>
    );
  }

  const editable = v.sol.estado === 'borrador' || v.sol.estado === 'rechazada';
  const e = v.empleado;

  return (
    <div className="space-y-6 text-base">
      {volver}
      <header className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1"><Persona grande e={e} sub={[e.rol, e.area, e.organigrama].filter(Boolean).join(' · ')} /></div>
        <EstadoChip estado={v.sol.estado} />
      </header>
      {editable ? <Carga v={v} url={url} accion={accion} ocupado={ocupado} /> : <YaCargadas v={v} url={url} accion={accion} ocupado={ocupado} />}
    </div>
  );
}

interface PropsCarga { v: VistaRespuesta; url: string; accion: Accion; ocupado: boolean }

/** Borrador o devuelta: elegir fechas y mandarlas a aprobar. */
function Carga({ v, url, accion, ocupado }: PropsCarga) {
  const s = v.sol;
  const { restan, partido, pista, bloqueo, puedeEnviar } = estadoEnvio(v, 'rrhh');
  if (bloqueo) return <Linea tono="warn">{bloqueo}</Linea>;

  return (
    <div className="space-y-6">
      {s.estado === 'rechazada' && s.motivo && <Linea tono="info">Se la devolviste: «{s.motivo}».</Linea>}
      {!v.turno.abierto && <Linea tono="info">Su turno para elegir abre el {fechaLarga(v.turno.apertura)}. Podés cargar las fechas ahora y mandarlas ese día.</Linea>}
      {v.limiteVencido && (
        <Linea tono="warn">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Se le venció el plazo para elegir ({diaMes(v.fechaLimite)}).</span>
            <Button variant="outline" className={BOTON} disabled={ocupado} onClick={() => accion({ accion: 'autorizar' }, 'Ya se pueden mandar sus fechas')}>Darle más tiempo</Button>
          </div>
        </Linea>
      )}
      {v.verano.debe && <Linea tono="warn">Le toca verano: al menos una parte tiene que caer entre el {diaMesMMDD(v.verano.desde)} y el {diaMesMMDD(v.verano.hasta)}.</Linea>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:grid-rows-[auto_1fr] lg:items-start">
        <Card className="px-6 py-6 lg:row-span-2">
          {restan > 0 ? <ElegirFechas v={v} url={url} voz="rrhh" accion={accion} ocupado={ocupado} /> : (
            <div className="flex min-h-60 flex-col items-center justify-center gap-3 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-emerald-600 text-white"><Check className="size-8" strokeWidth={2.5} /></span>
              <h2 className="text-2xl font-bold">Ya tiene todos sus días elegidos</h2>
              <p className="text-lg text-muted-foreground">Revisá las fechas y mandalas para aprobar.</p>
            </div>
          )}
        </Card>

        <Card className="gap-4 px-6 py-6">
          <div className="space-y-1">
            <p className="text-muted-foreground">Le corresponden</p>
            <p className="text-4xl font-bold tabular-nums">{v.dias.total} días</p>
          </div>
          <Progreso usados={v.usados} total={v.dias.total} texto={`Tiene ${v.usados} de ${v.dias.total} días elegidos`} />
        </Card>

        <Card className="gap-4 px-6 py-6">
          <h2 className="text-lg font-semibold">Sus fechas</h2>
          <ListaFechas v={v} voz="rrhh" accion={accion} ocupado={ocupado} editable />
          {partido && (
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 leading-snug">
                <Checkbox checked={!!s.acuerdoFracc} disabled={ocupado} className="mt-0.5 size-5"
                  onCheckedChange={(c) => accion({ accion: 'conformidad', acepta: c === true })} />
                <span>Firmó en papel el acuerdo para dividirlas en {noReprog(s).length} partes.</span>
              </label>
              <Button variant="ghost" className={cn(BOTON, '-ml-3')} asChild>
                <a href={docUrl(v.empleado.id, 'fraccionamiento')} target="_blank" rel="noopener"><Printer className="h-5 w-5" /> Imprimir el acuerdo</a>
              </Button>
            </div>
          )}
          <Button className={cn(BOTON, 'w-full')} disabled={!puedeEnviar || ocupado} onClick={() => accion({ accion: 'enviar' }, 'Listo: quedaron para aprobar')}>
            Mandar para aprobar
          </Button>
          {pista && <p className="text-center text-muted-foreground">{pista}</p>}
        </Card>
      </div>
    </div>
  );
}

/** Enviada o aprobada: las fechas ya están; lo que sigue se hace en la revisión. */
function YaCargadas({ v, url, accion, ocupado }: PropsCarga) {
  const aprobada = v.sol.estado === 'aprobada';
  return (
    <div className="space-y-6">
      <Linea tono={aprobada ? 'ok' : 'info'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{aprobada ? 'Sus vacaciones están aprobadas.' : 'Sus fechas ya están cargadas y esperan aprobación.'}</span>
          <Button className={BOTON} asChild><Link href={`${BANDEJA}&ver=${v.empleado.id}`}>{aprobada ? 'Ver la solicitud' : 'Revisar y aprobar'}</Link></Button>
        </div>
      </Linea>
      <Card className="gap-4 px-6 py-6">
        <h2 className="text-lg font-semibold">Sus fechas</h2>
        <ListaFechas v={v} voz="rrhh" accion={accion} ocupado={ocupado} editable={false} />
      </Card>
      {aprobada && v.pendienteReprog > 0 && (
        <Card className="gap-4 px-6 py-6">
          <Linea tono="info">Sus vacaciones se interrumpieron: le quedan {v.pendienteReprog} días para recuperar.</Linea>
          <ElegirFechas v={v} url={url} voz="rrhh" accion={accion} ocupado={ocupado} reprog />
        </Card>
      )}
    </div>
  );
}
