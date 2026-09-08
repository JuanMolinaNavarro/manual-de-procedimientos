'use client';

import { useMemo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Banner, Empty, EmpleadoCell, StatCard } from '@/components/comunes/ui';
import { cn } from '@/lib/utils';
import { fmtFechaDia, fmtRelativo, type ResumenAsistencia } from '@/lib/asistencia-datos';
import { useAsistencia, useAsistenciaData } from './AsistenciaContext';
import { ControlesPeriodo } from './piezas';

/** Cuántas personas se listan antes de mandar a la pestaña Personas. */
const TOPE_LISTA = 10;

export default function ResumenTab() {
  const { f, set, relojes, refrescar } = useAsistencia();

  const params = useMemo(() => {
    const p = new URLSearchParams({ desde: f.desde, hasta: f.hasta });
    if (f.relojId) p.set('relojId', String(f.relojId));
    return p;
  }, [f.desde, f.hasta, f.relojId]);

  const { data, error, loading } = useAsistenciaData<ResumenAsistencia>(`/api/admin/asistencia/resumen?${params}`);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
        <ControlesPeriodo />
        <Button variant="outline" onClick={refrescar} disabled={loading} className="ml-auto h-9">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Actualizar
        </Button>
      </div>

      {error && <Banner variant="warn">{error}</Banner>}

      {!data ? (
        <ResumenSkeleton />
      ) : (
        <div className={cn('space-y-5 transition-opacity', loading && 'opacity-60')}>
          {/* KPIs del período: cada uno lleva a la lista que lo explica. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi
              label="Presentes hoy"
              value={data.hoy.enRango ? data.hoy.presentes : '—'}
              tone="green"
              detail={
                data.hoy.enRango
                  ? `Personas con marcas el ${fmtFechaDia(data.hoy.fecha)}`
                  : 'Hoy está fuera del período elegido'
              }
              onClick={data.hoy.enRango ? () => set({ tab: 'fichadas', desde: data.hoy.fecha, hasta: data.hoy.fecha }) : undefined}
            />
            <Kpi
              label="Fichadas del período"
              value={data.totales.fichadas.toLocaleString('es-AR')}
              detail={`${data.totales.personasConMarcas} personas · ${data.rango.dias} días`}
              onClick={() => set({ tab: 'fichadas' })}
            />
            <Kpi
              label="Empleados con días sin marca de salida"
              value={data.totales.diasIncompletos.toLocaleString('es-AR')}
              tone={data.totales.diasIncompletos > 0 ? 'orange' : undefined}
              detail={`Sobre ${data.totales.diasPersona.toLocaleString('es-AR')} días cerrados`}
              onClick={() => set({ tab: 'fichadas', vista: 'dia', soloIncompletos: true })}
            />
          </div>

          {/* Estado del módulo: no depende del período elegido. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Kpi
              label="Sin vincular al organigrama"
              value={data.totales.personasSinVincular.toLocaleString('es-AR')}
              tone={data.totales.personasSinVincular > 0 ? 'orange' : undefined}
              detail="Se muestran con el nombre truncado del reloj"
              onClick={() => set({ tab: 'personas' })}
            />
            <Kpi
              label="Relojes"
              value={`${data.relojes.activos}/${data.relojes.total}`}
              tone={data.relojes.conError > 0 ? 'red' : 'green'}
              detail={
                data.relojes.conError > 0
                  ? `${data.relojes.conError} con error · último sync ${fmtRelativo(data.relojes.ultimoSync)}`
                  : `Activos · último sync ${fmtRelativo(data.relojes.ultimoSync)}`
              }
              onClick={() => set({ tab: 'relojes' })}
            />
          </div>

          {data.relojes.conError > 0 && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  Hay relojes que no están sincronizando
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(relojes ?? []).filter((r) => r.activo && r.ultimo_error).map((r) => (
                  <div key={r.id} className="text-sm">
                    <span className="font-semibold">{r.nombre}</span>{' '}
                    <span className="font-mono text-xs text-muted-foreground">{r.ip}</span>
                    <p className="text-muted-foreground">{r.ultimo_error}</p>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => set({ tab: 'relojes' })}>Ir a Relojes</Button>
              </CardContent>
            </Card>
          )}

          <ActividadPorDia porDia={data.porDia} />

          <PendientesDeVincular />
        </div>
      )}
    </div>
  );
}

/**
 * Personas del reloj sin ficha del organigrama. Sale de `personas` del contexto
 * (que ya está cargado para la pestaña Personas), no del endpoint del resumen:
 * el vínculo no depende del período elegido.
 */
function PendientesDeVincular() {
  const { personas, set } = useAsistencia();
  // Solo las activas: una persona archivada ya no es un pendiente de nadie.
  const pendientes = (personas ?? []).filter((p) => p.empleadoId == null && p.activa);
  const visibles = pendientes.slice(0, TOPE_LISTA);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pendientes de vincular con el organigrama</CardTitle>
        <p className="text-sm text-muted-foreground">
          Personas que fichan pero no tienen ficha asociada. Sus fichadas se muestran con el nombre truncado que
          trae el reloj, y no aparecen en los módulos que dependen del organigrama.
        </p>
      </CardHeader>
      <CardContent>
        {personas == null ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : pendientes.length === 0 ? (
          <Empty title="Todas vinculadas">
            Cada persona del reloj tiene su ficha en el organigrama.
          </Empty>
        ) : (
          <div className="space-y-2">
            {visibles.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3">
                <EmpleadoCell
                  empleado={{ id: -1, nombre: p.nombreReloj || p.userId, foto_archivo: null }}
                  sub={<span className="text-amber-600 dark:text-amber-400">{p.userId} · sin vincular</span>}
                />
                <Button variant="ghost" size="sm" className="shrink-0" onClick={() => set({ tab: 'personas' })}>
                  Vincular
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {pendientes.length > TOPE_LISTA && (
                <p className="text-xs text-muted-foreground">
                  y {pendientes.length - TOPE_LISTA} persona(s) más.
                </p>
              )}
              <Button variant="outline" size="sm" onClick={() => set({ tab: 'personas' })}>
                Ir a Personas
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Barras por día: un día hábil en cero es la señal de que el reloj se cayó. */
function ActividadPorDia({ porDia }: { porDia: ResumenAsistencia['porDia'] }) {
  const max = Math.max(1, ...porDia.map((d) => d.personas));

  if (porDia.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Actividad por día</CardTitle>
        <p className="text-sm text-muted-foreground">
          Personas que ficharon cada día. Los días de semana sin ninguna marca se marcan en rojo.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-[2px]" style={{ height: 96 }}>
          {porDia.map((d) => {
            const finDeSemana = esFinDeSemana(d.fecha);
            const vacioHabil = d.personas === 0 && !finDeSemana;
            const alto = d.personas === 0 ? 2 : Math.max(4, Math.round((d.personas / max) * 96));
            return (
              <div
                key={d.fecha}
                title={`${fmtFechaDia(d.fecha)} · ${d.personas} persona(s) · ${d.marcas} marca(s)`}
                className={cn(
                  'min-w-[3px] flex-1 rounded-sm transition-colors',
                  vacioHabil ? 'bg-red-500/50' : finDeSemana ? 'bg-muted-foreground/25' : 'bg-[var(--chart-1)]',
                )}
                style={{ height: alto }}
              />
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>{fmtFechaDia(porDia[0].fecha)}</span>
          <span>{fmtFechaDia(porDia[porDia.length - 1].fecha)}</span>
        </div>
      </CardContent>
    </Card>
  );
}


function Kpi({
  label, value, detail, tone, onClick,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: 'violet' | 'red' | 'orange' | 'green';
  onClick?: () => void;
}) {
  const card = <StatCard label={label} value={value} detail={detail} tone={tone} />;
  if (!onClick) return card;
  return (
    <button type="button" onClick={onClick} className="rounded-xl text-left transition-colors hover:brightness-105 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
      {card}
    </button>
  );
}

function ResumenSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function esFinDeSemana(yyyymmdd: string): boolean {
  const [a, m, d] = yyyymmdd.split('-').map(Number);
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6;
}
