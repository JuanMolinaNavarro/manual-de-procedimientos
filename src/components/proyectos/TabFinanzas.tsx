'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { MONEDAS } from '@/lib/proyectos-datos';
import {
  fmt1,
  fmtUSD,
  lecturaFinanciera,
  veredictoFinanciero,
  type ConfigProyectos,
  type Proyecto,
  type ResumenFinanciero,
} from '@/lib/proyectos-calc';
import Kpi from './Kpi';
import InfoHint from './InfoHint';
import type { AccionesProyecto } from './ProyectoDetalle';

interface Props {
  proyecto: Proyecto;
  resumen: ResumenFinanciero;
  config: ConfigProyectos;
  puedeEditar: boolean;
  acciones: AccionesProyecto;
  onConfigChange: (c: ConfigProyectos) => void;
}

/** Campo numérico que persiste al salir del foco. */
function CampoNum({
  id,
  label,
  ayuda,
  valor,
  onCommit,
  disabled,
  sufijo,
}: {
  id: string;
  label: string;
  ayuda?: string;
  valor: number;
  onCommit: (v: number) => void;
  disabled: boolean;
  sufijo?: string;
}) {
  // Ajuste de estado durante el render: el texto es local mientras se escribe
  // y se resincroniza cuando el servidor devuelve otro valor.
  const [v, setV] = useState(String(valor));
  const [previo, setPrevio] = useState(valor);
  if (previo !== valor) {
    setPrevio(valor);
    setV(String(valor));
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
        {sufijo && <span className="normal-case tracking-normal"> ({sufijo})</span>}
        {ayuda && <InfoHint k={ayuda} />}
      </Label>
      <Input
        id={id}
        className="font-mono"
        value={v}
        disabled={disabled}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = Number(v);
          if (Number.isFinite(n) && n !== valor) onCommit(n);
          else setV(String(valor));
        }}
      />
    </div>
  );
}

const VEREDICTO = {
  recomendado: {
    texto: '✓ recomendado',
    clase: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  },
  ajustado: {
    texto: 'margen ajustado',
    clase: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  },
  'no-cubre': {
    texto: '⚠ no cubre costos',
    clase: 'bg-red-500/15 text-red-700 dark:text-red-400',
  },
  'sin-datos': { texto: 'faltan datos', clase: 'bg-muted text-muted-foreground' },
} as const;

export default function TabFinanzas({
  proyecto,
  resumen,
  config,
  puedeEditar,
  acciones,
  onConfigChange,
}: Props) {
  const veredicto = veredictoFinanciero(resumen);
  const sinIngreso = resumen.ingreso <= 0;

  const guardarConfig = async (data: Record<string, number>) => {
    const res = await fetch('/api/admin/proyectos/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) onConfigChange((await res.json()) as ConfigProyectos);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supuestos del análisis</CardTitle>
          <CardDescription>
            Los costos salen de la pestaña Costos. Acá va lo que el proyecto va a generar
            (facturación, ahorro o cualquier retorno cuantificable) y cuándo se cobra: el ingreso se
            deflacta a USD constantes del año base para poder compararlo con el costo de hoy.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CampoNum
            id="f-ingreso"
            label="Ingreso estimado"
            ayuda="ingreso"
            valor={proyecto.ingreso_estimado}
            disabled={!puedeEditar}
            onCommit={(v) => acciones.patchProyecto({ ingreso_estimado: v })}
          />
          <CampoNum
            id="f-otros"
            label="Otros ingresos"
            valor={proyecto.otros_ingresos}
            disabled={!puedeEditar}
            onCommit={(v) => acciones.patchProyecto({ otros_ingresos: v })}
          />
          <div className="space-y-2">
            <Label
              htmlFor="f-moneda"
              className="text-[11px] uppercase tracking-wider text-muted-foreground"
            >
              Moneda del ingreso
            </Label>
            <Select
              value={proyecto.moneda_ingreso}
              disabled={!puedeEditar}
              onValueChange={(v) => acciones.patchProyecto({ moneda_ingreso: v })}
            >
              <SelectTrigger id="f-moneda" className="w-full font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONEDAS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <CampoNum
            id="f-anio"
            label="Año del ingreso"
            ayuda="anio_ingreso"
            valor={proyecto.anio_ingreso}
            disabled={!puedeEditar}
            onCommit={(v) => acciones.patchProyecto({ anio_ingreso: Math.round(v) })}
          />
          <CampoNum
            id="f-infl"
            label="Inflación USD anual"
            sufijo="%"
            valor={config.infl_usd}
            disabled={!puedeEditar}
            onCommit={(v) => guardarConfig({ infl_usd: v })}
          />
          <CampoNum
            id="f-fx"
            label="Tipo de cambio"
            sufijo="ARS/USD"
            valor={config.fx_ars}
            disabled={!puedeEditar}
            onCommit={(v) => guardarConfig({ fx_ars: v })}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          titulo="Costo (USD const.)"
          ayuda="costo_const"
          valor={fmtUSD(resumen.costoConst)}
          nota={`año base ${config.anio_base}`}
        />
        <Kpi
          titulo="Ingreso (USD const.)"
          ayuda="ingreso"
          valor={sinIngreso ? '—' : fmtUSD(resumen.ingresoConst)}
          nota={sinIngreso ? 'sin ingreso cargado' : `${proyecto.anio_ingreso} → ${config.anio_base}`}
        />
        <Kpi
          titulo="Margen neto"
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
          titulo="ROI"
          ayuda="roi"
          valor={sinIngreso || resumen.roi == null ? '—' : `${fmt1(resumen.roi)}%`}
          tono={sinIngreso ? 'neutro' : (resumen.roi ?? 0) > 0 ? 'ok' : 'malo'}
          nota="retorno sobre inversión"
        />
        <Kpi
          titulo="Ingreso de equilibrio"
          ayuda="breakeven"
          valor={fmtUSD(resumen.breakeven)}
          tono="alerta"
          nota={
            sinIngreso
              ? `nominal en ${proyecto.anio_ingreso}`
              : `hoy proyectás ${fmtUSD(resumen.ingreso)}`
          }
        />
        <Kpi
          titulo="Margen de seguridad"
          ayuda="seguridad"
          valor={sinIngreso || resumen.seguridad == null ? '—' : fmt1(resumen.seguridad)}
          sufijo={sinIngreso ? undefined : '%'}
          tono={sinIngreso ? 'neutro' : (resumen.seguridad ?? 0) > 0 ? 'ok' : 'malo'}
          nota="cuánto puede caer el ingreso"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Lectura rápida</CardTitle>
            <Badge variant="secondary" className={cn('border-0', VEREDICTO[veredicto].clase)}>
              {VEREDICTO[veredicto].texto}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {lecturaFinanciera(resumen)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
