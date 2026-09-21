'use client';

/**
 * Mi asistencia (`/admin/mi-asistencia`): la asistencia del usuario de la
 * sesión, leída de la ficha del organigrama vinculada a su cuenta. Arriba el
 * último año como calendario de "contribuciones"; abajo el mes elegido con el
 * mismo resumen y detalle que ve quien liquida en el perfil de la persona.
 * Solo lectura: no hay nada que editar acá.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarRange, ChevronLeft, ChevronRight, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Banner, Empty, PageTitle } from '@/components/comunes/ui';
import { cn } from '@/lib/utils';
import { hoyLocal } from '@/lib/asistencia-datos';
import { MES_RE, describirHorario, fmtMes, mesAnterior, mesSiguiente, versionVigente } from '@/lib/asistencia-calendario';
import { asistFetch, mensajeError, type MiAsistenciaRespuesta } from './api';
import CalendarioAnual from './CalendarioAnual';
import { Detalle, Foto, HorarioCard, Resumen } from './PerfilPiezas';

export default function MiAsistenciaPage() {
  const [hoy] = useState(() => hoyLocal());
  const [mes, setMes] = useState(() => hoy.slice(0, 7));
  const [data, setData] = useState<MiAsistenciaRespuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Mes al que corresponde lo último que llegó (dato o error): "cargando" es
  // que todavía no coincide con el mes pedido. Mientras tanto se sigue
  // mostrando el mes anterior atenuado, como en el resto del módulo.
  const [mesCargado, setMesCargado] = useState<string | null>(null);
  const loading = mesCargado !== mes;

  useEffect(() => {
    if (!MES_RE.test(mes)) return;
    const ac = new AbortController();
    asistFetch<MiAsistenciaRespuesta>(`/api/admin/mi-asistencia?mes=${mes}`, { signal: ac.signal })
      .then((d) => { setData(d); setError(null); setMesCargado(mes); })
      .catch((e: unknown) => { if (!ac.signal.aborted) { setError(mensajeError(e)); setMesCargado(mes); } });
    return () => ac.abort();
  }, [mes]);

  if (data && !data.vinculado) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <VolverInicio />
        <PageTitle title="Mi asistencia" sub="Tu calendario del último año y el resumen del mes." />
        <Empty title="Tu usuario no está vinculado a una ficha del organigrama">
          Para ver tu asistencia, un administrador tiene que vincular la cuenta <span className="font-medium text-foreground">{data.usuario}</span> con tu ficha desde Usuarios («Ficha del organigrama»).
        </Empty>
      </div>
    );
  }

  const d = data && data.vinculado ? data : null;
  const vigente = d ? versionVigente(d.versiones, hoy) : null;
  // Recortes del rango completo: la ventana anual y el mes abierto.
  const idx = (fecha: string) => d?.dias.findIndex((x) => x.fecha === fecha) ?? -1;
  const iA0 = d ? idx(d.anio.desde) : -1;
  const iA1 = d ? idx(d.anio.hasta) : -1;
  const iM0 = d ? idx(d.mes.desde) : -1;
  const iM1 = d ? idx(d.mes.hasta) : -1;
  const hoyEnMes = !!d && d.hoy >= d.mes.desde && d.hoy <= d.mes.hasta;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <VolverInicio />
      <PageTitle title="Mi asistencia" sub="Tu calendario del último año y el resumen del mes, con las mismas reglas que usa RRHH." />

      {error && <Banner variant="warn">{error}</Banner>}

      {/* Cabecera: foto y ficha */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-5 p-5">
          <Foto nombre={d?.empleado.nombre ?? null} emp={d ? { id: d.empleado.id, foto_archivo: d.empleado.fotoArchivo } : undefined} />
          <div className="min-w-0 flex-1 space-y-1">
            {d ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold text-foreground">{d.empleado.nombre}</h2>
                  {!d.empleado.activo && <Badge variant="secondary">inactivo</Badge>}
                  {d.personas.length === 0 && <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">sin legajo en el reloj</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{d.empleado.rol} · {d.empleado.area}</p>
                <p className="text-sm text-muted-foreground">
                  {vigente ? (
                    <>Horario: <span className="font-medium text-foreground">{describirHorario(vigente)}</span></>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">Sin horario vigente: solo se muestran tus fichadas.</span>
                  )}
                </p>
              </>
            ) : (
              <>
                <Skeleton className="h-7 w-64" />
                <Skeleton className="h-4 w-48" />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Último año */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="inline-flex items-center gap-2 text-base"><CalendarRange className="h-4 w-4" /> Último año</CardTitle>
        </CardHeader>
        <CardContent>
          {!d ? (
            loading ? <Skeleton className="h-40 w-full" /> : null
          ) : (
            <div className={cn(loading && 'opacity-60')}>
              <CalendarioAnual dias={d.dias.slice(iA0, iA1 + 1)} celdas={d.celdas.slice(iA0, iA1 + 1)} mesActivo={mes} onVerMes={setMes} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mes */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Mes anterior" onClick={() => setMes(mesAnterior(mes))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-40 text-center text-base font-semibold">{fmtMes(mes)}</span>
        <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Mes siguiente" disabled={mes >= hoy.slice(0, 7)} onClick={() => setMes(mesSiguiente(mes))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {mes !== hoy.slice(0, 7) && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => setMes(hoy.slice(0, 7))}>Hoy</Button>
        )}
      </div>

      {/* Resumen del mes a la izquierda; horario y reloj a la derecha */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className={cn(loading && 'opacity-60')}>
          {!d ? (
            loading ? <Skeleton className="h-64 w-full" /> : null
          ) : !d.mes.tieneHorario ? (
            <Banner variant="info">
              Sin horario vigente en {fmtMes(mes).toLowerCase()}: no se calculan ausencias, tardanzas ni horas esperadas. Si creés que es un error, hablá con RRHH.
            </Banner>
          ) : (
            <Resumen r={d.mes.resumen} hoyEnMes={hoyEnMes} />
          )}
        </div>
        <div className="space-y-4">
          <HorarioCard versiones={d?.versiones ?? []} vigente={vigente} hoy={hoy} vinculada cargando={!d} />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="inline-flex items-center gap-2 text-base"><Fingerprint className="h-4 w-4" /> Reloj</CardTitle>
            </CardHeader>
            <CardContent>
              {!d ? (
                <Skeleton className="h-12 w-full" />
              ) : d.personas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tu ficha no tiene legajo asignado en ningún reloj: no hay fichadas para mostrar. Si fichás todos los días, avisale a RRHH para que vincule tu legajo.</p>
              ) : (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  {d.personas.map((p) => (
                    <div key={p.id} className="contents">
                      <dt className="text-muted-foreground">Legajo</dt>
                      <dd className="tabular-nums">{p.userId}{p.nombreReloj ? <span className="ml-1.5 text-muted-foreground">({p.nombreReloj})</span> : null}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Día por día: último, a todo el ancho (sin fila Total: eso es del perfil de RRHH) */}
      {d && (
        <div className={cn(loading && 'opacity-60')}>
          <Detalle celdas={d.celdas.slice(iM0, iM1 + 1)} dias={d.dias.slice(iM0, iM1 + 1)} />
        </div>
      )}
    </div>
  );
}

/** Mismo estilo que el «Personas» del perfil: un link discreto arriba del título. */
function VolverInicio() {
  return (
    <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> Volver a inicio
    </Link>
  );
}
