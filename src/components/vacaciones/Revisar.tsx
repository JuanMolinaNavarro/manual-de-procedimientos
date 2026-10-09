'use client';

/**
 * Revisar una solicitud (`/admin/vacaciones?tab=solicitudes&ver=<id>`): qué fechas pide, los
 * controles en frases simples, quién más del área sale esas semanas y la respuesta de RR.HH.
 * Después de aprobar muestra el paso siguiente (el aviso por escrito).
 */

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { sumarDias } from '@/lib/asistencia-datos';
import {
  avisoEstado, cupoSemana, diasDe, fmtCorto, genteDeArea, ocupacionSemana, perfilDe, semanasDeRango, solDe, solapan, vueltaDe,
  type EmpleadoVac, type EstadoVac,
} from '@/lib/vacaciones-calc';
import { cn } from '@/lib/utils';
import { BotonesAviso, DevolverForm, MenuCambiar } from './AccionesSolicitud';
import { controles, limiteAviso } from './controles';
import { BARRA, BOTON, EstadoChip, Leyenda, Linea, Persona, diaMes, fechaLarga, rangoCorto, rangoLargo, useOcupado } from './piezas';
import { grupoBandeja } from './SolicitudesTab';
import type { PropsTab } from './VacacionesPage';

interface PropsPersona { E: EstadoVac; e: EmpleadoVac; accion: PropsTab['accion'] }

export default function Revisar({ E, e, visibles, accion, verSolicitud }: PropsTab & { e: EmpleadoVac }) {
  const s = solDe(E, e.id);
  const siguiente = visibles.find((x) => x.id !== e.id && perfilDe(E, x.id).incluir && grupoBandeja(E, x.id) === 'aprobar');

  return (
    <div className="space-y-6 text-base">
      <Button variant="ghost" className={cn(BOTON, '-ml-3')} onClick={() => verSolicitud(null)}><ArrowLeft className="h-5 w-5" /> Volver a solicitudes</Button>
      <header className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1"><Persona grande e={e} sub={[e.rol, e.area, e.organigrama].filter(Boolean).join(' · ')} /></div>
        <EstadoChip estado={s.estado} />
      </header>

      <FechasPedidas E={E} e={e} />
      {s.tramos.length > 0 && <ListaControles E={E} e={e} />}
      {e.areaId != null && s.tramos.length > 0 && <Equipo E={E} e={e} />}

      <Card className="gap-4 px-6 py-6" aria-label="Tu respuesta">
        {s.estado === 'enviada' && <RespuestaEnviada E={E} e={e} accion={accion} />}
        {s.estado === 'aprobada' && <RespuestaAprobada E={E} e={e} accion={accion} />}
        {(s.estado === 'borrador' || s.estado === 'rechazada') && <SinEnviar E={E} e={e} />}
        {siguiente && s.estado !== 'enviada' && (
          <div className="flex justify-end border-t border-border pt-4">
            <Button className={BOTON} onClick={() => verSolicitud(siguiente.id)}>Siguiente solicitud</Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function FechasPedidas({ E, e }: { E: EstadoVac; e: EmpleadoVac }) {
  const s = solDe(E, e.id);
  const titulo = !s.tramos.length ? 'Todavía no cargó fechas' : s.estado === 'enviada' ? 'Pide estas fechas' : 'Sus fechas';
  return (
    <Card className="gap-2 px-6 py-6">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {s.tramos.map((t) => (
        <div key={t.desde}>
          <p className="text-2xl font-bold tabular-nums">{rangoLargo(t.desde, t.hasta)}</p>
          <p className="text-muted-foreground">
            {t.dias} días · vuelve a trabajar el {fechaLarga(vueltaDe(t.hasta, E.config.feriados))}
            {t.reprog && ' · días que le quedaron pendientes'}
          </p>
        </div>
      ))}
      <p className="text-muted-foreground">Le corresponden {diasDe(E, e.id).total} días en total.</p>
    </Card>
  );
}

function ListaControles({ E, e }: { E: EstadoVac; e: EmpleadoVac }) {
  return (
    <Card className="gap-0 px-6 py-6">
      <h2 className="mb-3 text-lg font-semibold">Controles</h2>
      <ul>
        {controles(E, e).items.map((c, i) => (
          <li key={i} className={cn('flex items-start gap-3 py-3', i > 0 && 'border-t border-border', c.tono === 'error' && 'font-semibold')}>
            {c.tono === 'ok'
              ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              : <XCircle className={cn('mt-0.5 h-5 w-5 shrink-0', c.tono === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400')} />}
            <span>{c.txt}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RespuestaEnviada({ E, e, accion }: PropsPersona) {
  const [devolviendo, setDevolviendo] = useState(false);
  const { ocupado, correr } = useOcupado();
  if (devolviendo) return <DevolverForm e={e} accion={accion} cancelar={() => setDevolviendo(false)} />;
  const errores = controles(E, e).errores;
  const limite = limiteAviso(E, e.id);
  return (
    <>
      {errores
        ? <Linea tono="error">No se puede aprobar con estas fechas. Devolvésela para que elija otras.</Linea>
        : <Linea tono="ok">Se puede aprobar.{limite && ` Después hay que darle el aviso por escrito antes del ${fechaLarga(limite)}.`}</Linea>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" className={BOTON} onClick={() => setDevolviendo(true)}><RotateCcw className="h-5 w-5" /> Devolver</Button>
        <Button className={BOTON} disabled={ocupado || errores > 0} onClick={() => correr(() => accion(e.id, { accion: 'aprobar' }, 'Vacaciones aprobadas'))}>
          <Check className="h-5 w-5" /> Aprobar vacaciones
        </Button>
      </div>
    </>
  );
}

function RespuestaAprobada({ E, e, accion }: PropsPersona) {
  const { ocupado, correr } = useOcupado();
  const av = avisoEstado(E, e.id);
  const reprogPendientes = solDe(E, e.id).tramos.filter((t) => t.reprog && t.estadoTramo === 'pendiente');
  return (
    <>
      {reprogPendientes.map((t) => (
        <div key={t.desde} className="flex flex-wrap items-center justify-between gap-3">
          <span>Pide tomar los días pendientes del {rangoCorto(t.desde, t.hasta)}.</span>
          <Button className={BOTON} disabled={ocupado} onClick={() => correr(() => accion(e.id, { accion: 'aprobarReprog', desde: t.desde }, 'Aprobado'))}>
            <Check className="h-5 w-5" /> Aprobar
          </Button>
        </div>
      ))}
      {av?.primero && !av.notificada && <Linea tono={av.tarde ? 'error' : 'ok'}>Vacaciones aprobadas. Falta un paso: entregarle el aviso por escrito antes del {fechaLarga(av.limite!)}.</Linea>}
      {av?.notificada && !av.acuse && <Linea tono="info">Se le entregó el aviso el {diaMes(av.fecha!)}. Falta que lo firme.</Linea>}
      {av?.notificada && av.acuse && <Linea tono="ok">Avisado el {diaMes(av.fecha!)} y firmado el {diaMes(av.acuse)}.</Linea>}
      <div className="flex flex-wrap justify-end gap-2">
        <MenuCambiar E={E} e={e} accion={accion} />
        <BotonesAviso E={E} e={e} accion={accion} />
      </div>
    </>
  );
}

function SinEnviar({ E, e }: { E: EstadoVac; e: EmpleadoVac }) {
  const s = solDe(E, e.id);
  return (
    <>
      <Linea tono="info">{s.estado === 'rechazada' ? `Se la devolviste${s.motivo ? `: «${s.motivo}»` : ''}. Puede elegir otras fechas.` : 'Todavía no mandó sus fechas.'}</Linea>
      <div className="flex justify-end">
        <Button variant="outline" className={BOTON} asChild><Link href={`/admin/vacaciones/seleccion/${e.id}`}>Cargar sus fechas</Link></Button>
      </div>
    </>
  );
}

/** Quién más del área sale en las semanas que pide (y una antes y una después). */
function Equipo({ E, e }: { E: EstadoVac; e: EmpleadoVac }) {
  const s = solDe(E, e.id), areaId = e.areaId!;
  const semanas = [...new Set(s.tramos.flatMap((t) => semanasDeRango(sumarDias(t.desde, -7), sumarDias(t.hasta, 7))))].sort();
  const saleEn = (id: number, w: string) => solDe(E, id).tramos.some((t) => solapan(t.desde, t.hasta, w, sumarDias(w, 6)));
  const pide = (w: string) => saleEn(e.id, w);
  const otros = genteDeArea(E, areaId).filter((x) => {
    const estado = solDe(E, x.id).estado;
    return x.id !== e.id && (estado === 'aprobada' || estado === 'enviada') && semanas.some((w) => saleEn(x.id, w));
  });
  const barraDe = (x: EmpleadoVac) => (x.id === e.id ? BARRA.pide : solDe(E, x.id).estado === 'aprobada' ? BARRA.aprobada : BARRA.pedida);
  const cupo = E.areas[areaId]?.cupo;

  return (
    <Card className="gap-4 px-6 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Quién más sale de {e.area}</h2>
        <span className="text-muted-foreground">{cupo == null ? 'Sin límite de personas a la vez' : `Pueden salir ${cupo} a la vez`}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse">
          <thead>
            <tr>
              <th scope="col" className="py-2 pr-3 text-left text-sm font-medium text-muted-foreground">Semana del</th>
              {semanas.map((w) => (
                <th key={w} scope="col" className={cn('px-1 py-2 text-center text-sm font-medium', pide(w) ? 'rounded-t-lg bg-muted font-bold text-foreground' : 'text-muted-foreground')}>
                  {fmtCorto(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[e, ...otros].map((x) => (
              <tr key={x.id} className="border-t border-border">
                <th scope="row" className={cn('max-w-48 truncate py-2.5 pr-3 text-left text-[15px]', x.id === e.id ? 'font-bold' : 'font-normal')}>{x.nombre}</th>
                {semanas.map((w) => (
                  <td key={w} className={cn('px-0.5 py-2', pide(w) && 'bg-muted')}>
                    {saleEn(x.id, w) && <div className={cn('h-6 rounded', barraDe(x))} />}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 border-border">
              <th scope="row" className="py-2.5 pr-3 text-left text-[15px] font-semibold">Afuera</th>
              {semanas.map((w) => {
                const c = cupoSemana(E, areaId, w), afuera = ocupacionSemana(E, areaId, w, e.id), lleno = c != null && afuera >= c;
                return (
                  <td key={w} className={cn('px-1 py-2.5 text-center text-[15px] font-semibold tabular-nums', pide(w) && 'rounded-b-lg bg-muted', lleno && 'text-destructive')}>
                    {c === 0 ? 'cerrada' : lleno ? `${afuera} · lleno` : afuera}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <Leyenda items={[['pide', 'Lo que pide'], ['aprobada', 'Ya aprobadas'], ['pedida', 'Pedidas, sin aprobar']]} />
    </Card>
  );
}
