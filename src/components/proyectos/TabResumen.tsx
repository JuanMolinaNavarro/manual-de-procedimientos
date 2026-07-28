'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { estadoEtapa } from '@/lib/proyectos-datos';
import {
  costoPorCategoria,
  costoPorEtapa,
  etapasVencidas,
  fmt1,
  fmtUSD,
  hoyISO,
  sumarDias,
  type AgrupadoCosto,
  type ConfigProyectos,
  type Proyecto,
  type ResumenFinanciero,
} from '@/lib/proyectos-calc';
import Kpi from './Kpi';
import InfoHint from './InfoHint';
import ResponsableSelect, { type EmpleadoOpcion } from './ResponsableSelect';
import type { AccionesProyecto } from './ProyectoDetalle';

interface Props {
  proyecto: Proyecto;
  resumen: ResumenFinanciero;
  config: ConfigProyectos;
  empleados: EmpleadoOpcion[];
  puedeEditar: boolean;
  acciones: AccionesProyecto;
}

export default function TabResumen({
  proyecto,
  resumen,
  config,
  empleados,
  puedeEditar,
  acciones,
}: Props) {
  const [notas, setNotas] = useState(proyecto.notas ?? '');
  const hoy = hoyISO();

  const porCategoria = costoPorCategoria(proyecto, config);
  const porEtapa = costoPorEtapa(proyecto, config);
  const vencidas = etapasVencidas(proyecto, hoy);

  // Lo que está corriendo ahora o arranca en los próximos 30 días.
  const proximas = proyecto.etapas
    .filter((t) => t.estado !== 'hecho' && sumarDias(t.fecha_inicio, t.duracion_dias) >= hoy)
    .slice(0, 5);

  const sinIngreso = resumen.ingreso <= 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi
          titulo="Costo total"
          ayuda="costo_total"
          valor={fmtUSD(resumen.costoConst)}
          nota={`USD constantes ${config.anio_base} · ${proyecto.costos.length} línea(s)`}
        />
        <Kpi
          titulo="Ingreso proyectado"
          ayuda="ingreso"
          valor={sinIngreso ? '—' : fmtUSD(resumen.ingresoConst)}
          nota={sinIngreso ? 'sin ingreso cargado' : `se cobra en ${proyecto.anio_ingreso}`}
        />
        <Kpi
          titulo="Margen"
          ayuda="margen"
          valor={sinIngreso ? '—' : fmtUSD(resumen.margen)}
          tono={sinIngreso ? 'neutro' : resumen.margen > 0 ? 'ok' : 'malo'}
          nota={
            sinIngreso || resumen.margenPct == null
              ? undefined
              : `${fmt1(resumen.margenPct)}% sobre ingreso`
          }
        />
        <Kpi
          titulo="Avance"
          ayuda="avance"
          valor={resumen.avance}
          sufijo="%"
          nota={
            <>
              {resumen.etapasHechas}/{proyecto.etapas.length} etapas hechas
              {resumen.etapasAtrasadas > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  {' '}
                  · {resumen.etapasAtrasadas} atrasada(s)
                </span>
              )}
            </>
          }
        />
        <Kpi
          titulo="Ventana"
          ayuda="ventana"
          valor={
            <span className="text-base">
              {proyecto.fecha_inicio} <span className="text-muted-foreground">→</span> {resumen.fin}
            </span>
          }
          nota={`${resumen.duracionDias} días`}
        />
        <Kpi
          titulo="ROI"
          ayuda="roi"
          valor={sinIngreso || resumen.roi == null ? '—' : `${fmt1(resumen.roi)}%`}
          tono={sinIngreso ? 'neutro' : (resumen.roi ?? 0) > 0 ? 'ok' : 'malo'}
          nota="retorno sobre inversión"
        />
      </div>

      {vencidas.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              {vencidas.length} etapa(s) pasadas de fecha
            </CardTitle>
            <CardDescription>
              El cronograma dice que ya deberían estar terminadas. Actualizá su estado o corré las
              fechas desde el Cronograma.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {vencidas.map((t) => (
              <Badge key={t.id} variant="outline" className="font-normal">
                {t.nombre}
                <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                  venció {sumarDias(t.fecha_inicio, t.duracion_dias)}
                </span>
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <DistribucionCostos
          titulo="Costo por categoría"
          descripcion="En qué rubros se va la plata del proyecto."
          filas={porCategoria}
          ayuda="costo_total"
        />
        <DistribucionCostos
          titulo="Costo por etapa"
          descripcion="En qué parte del cronograma se concentra el gasto."
          filas={porEtapa}
          ayuda="etapa_costo"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximas etapas</CardTitle>
          <CardDescription>Lo que está en curso o por arrancar.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {proximas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No queda nada pendiente en el cronograma.
            </p>
          ) : (
            proximas.map((t) => {
              const est = estadoEtapa(t.estado);
              return (
                <div key={t.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', est.punto)} />
                  <div className="min-w-40 flex-1">
                    <p className="text-sm font-medium">{t.nombre}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {t.fecha_inicio} → {sumarDias(t.fecha_inicio, t.duracion_dias)} ·{' '}
                      {t.duracion_dias} d{t.responsable_nombre ? ` · ${t.responsable_nombre}` : ''}
                    </p>
                  </div>
                  <div className="w-28 shrink-0">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full', est.barra)}
                        style={{ width: `${Math.max(0, Math.min(100, t.avance))}%` }}
                      />
                    </div>
                    <p className="mt-1 text-right font-mono text-[10px] text-muted-foreground">
                      {t.avance}%
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Responsable del proyecto</CardTitle>
          <CardDescription>
            Si elegís a alguien del organigrama, el proyecto aparece en la pestaña Proyectos de su
            ficha.
          </CardDescription>
        </CardHeader>
        <CardContent className="max-w-md">
          <ResponsableSelect
            responsableId={proyecto.responsable_id}
            responsableTexto={proyecto.responsable}
            empleados={empleados}
            disabled={!puedeEditar || acciones.guardando}
            onChange={(v) => acciones.patchProyecto({ ...v })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notas del proyecto</CardTitle>
          <CardDescription>Contexto, decisiones y recordatorios.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={4}
            value={notas}
            disabled={!puedeEditar}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Contexto, decisiones, pendientes…"
          />
          {puedeEditar && notas !== (proyecto.notas ?? '') && (
            <Button
              size="sm"
              disabled={acciones.guardando}
              onClick={() => acciones.patchProyecto({ notas })}
            >
              Guardar notas
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DistribucionCostos({
  titulo,
  descripcion,
  filas,
  ayuda,
}: {
  titulo: string;
  descripcion: string;
  filas: AgrupadoCosto[];
  ayuda: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-base">
          {titulo}
          <InfoHint k={ayuda} />
        </CardTitle>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {filas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay costos cargados.</p>
        ) : (
          filas.map((f) => (
            <div key={f.clave} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{f.etiqueta}</span>
                <span className="shrink-0 font-mono">
                  {fmtUSD(f.total)}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {fmt1(f.porcentaje)}%
                  </span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${Math.max(1, f.porcentaje)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
