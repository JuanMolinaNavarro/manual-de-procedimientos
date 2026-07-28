'use client';

import { Fragment, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { MONEDAS } from '@/lib/proyectos-datos';
import {
  costoLineaUSD,
  costoTotalUSD,
  deflactar,
  fmtMonto,
  fmtUSD,
  type ConfigProyectos,
  type Proyecto,
} from '@/lib/proyectos-calc';
import Kpi from './Kpi';
import InfoHint from './InfoHint';
import type { AccionesProyecto } from './ProyectoDetalle';

/** Valor centinela: el Select de Radix no acepta "" como value de un item. */
const SIN_ETAPA = 'sin-etapa';

interface Props {
  proyecto: Proyecto;
  config: ConfigProyectos;
  puedeEditar: boolean;
  acciones: AccionesProyecto;
}

/** Input de celda: mantiene su propio texto y sincroniza cuando cambia el dato. */
function Celda({
  valor,
  onCommit,
  disabled,
  numerico,
  ariaLabel,
}: {
  valor: string | number;
  onCommit: (v: string) => void;
  disabled: boolean;
  numerico?: boolean;
  ariaLabel: string;
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
    <Input
      aria-label={ariaLabel}
      value={v}
      disabled={disabled}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v !== String(valor)) onCommit(v);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      className={cn(
        'h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-input',
        numerico && 'text-right font-mono',
      )}
    />
  );
}

export default function TabCostos({ proyecto, config, puedeEditar, acciones }: Props) {
  const total = costoTotalUSD(proyecto, config);
  const totalConst = deflactar(total, config.anio_base, config);

  // Agrupado por categoría, respetando el orden de aparición.
  const grupos: { nombre: string; costos: typeof proyecto.costos }[] = [];
  proyecto.costos.forEach((c) => {
    const nombre = c.categoria || 'General';
    const g = grupos.find((x) => x.nombre === nombre);
    if (g) g.costos.push(c);
    else grupos.push({ nombre, costos: [c] });
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Kpi
          titulo="Costo total (nominal)"
          ayuda="costo_total"
          valor={fmtUSD(total)}
          nota={`${proyecto.costos.length} línea(s) · TC ${fmtMonto(config.fx_ars)}`}
        />
        <Kpi
          titulo="Costo en USD constantes"
          ayuda="costo_const"
          valor={fmtUSD(totalConst)}
          nota={`año base ${config.anio_base} · infl. ${config.infl_usd}%`}
        />
      </div>

      <Card className="gap-0">
        <CardHeader>
          <CardTitle className="flex items-center text-base">
            Detalle de costos
            <InfoHint k="costos_tabla" />
          </CardTitle>
          <CardDescription>
            Editá cualquier celda. El total de cada línea es cantidad × costo unitario; lo que
            cargues en ARS se pasa a USD con el tipo de cambio. Imputar la línea a una etapa es
            opcional, pero alimenta el desglose del Resumen.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-4 overflow-x-auto px-0">
          {proyecto.costos.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              Todavía no hay costos cargados.
            </p>
          ) : (
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="w-28">Unidad</TableHead>
                  <TableHead className="w-20 text-right">Cant</TableHead>
                  <TableHead className="w-28 text-right">Costo unit.</TableHead>
                  <TableHead className="w-24">Moneda</TableHead>
                  <TableHead className="w-44">Etapa</TableHead>
                  <TableHead className="w-32 text-right">Total USD</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {grupos.map((g) => (
                  <Fragment key={g.nombre}>
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={8} className="pt-5">
                        <Celda
                          ariaLabel={`Categoría ${g.nombre}`}
                          valor={g.nombre}
                          disabled={!puedeEditar}
                          onCommit={(v) =>
                            // Renombrar la categoría reetiqueta todas sus líneas.
                            Promise.all(
                              g.costos.map((c) => acciones.patchCosto(c.id, { categoria: v })),
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                    {g.costos.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="py-1">
                          <Celda
                            ariaLabel="Concepto"
                            valor={c.concepto}
                            disabled={!puedeEditar}
                            onCommit={(v) => acciones.patchCosto(c.id, { concepto: v })}
                          />
                        </TableCell>
                        <TableCell className="py-1">
                          <Celda
                            ariaLabel="Unidad"
                            valor={c.unidad}
                            disabled={!puedeEditar}
                            onCommit={(v) => acciones.patchCosto(c.id, { unidad: v })}
                          />
                        </TableCell>
                        <TableCell className="py-1">
                          <Celda
                            ariaLabel="Cantidad"
                            numerico
                            valor={c.cantidad}
                            disabled={!puedeEditar}
                            onCommit={(v) => acciones.patchCosto(c.id, { cantidad: Number(v) || 0 })}
                          />
                        </TableCell>
                        <TableCell className="py-1">
                          <Celda
                            ariaLabel="Costo unitario"
                            numerico
                            valor={c.costo_unitario}
                            disabled={!puedeEditar}
                            onCommit={(v) =>
                              acciones.patchCosto(c.id, { costo_unitario: Number(v) || 0 })
                            }
                          />
                        </TableCell>
                        <TableCell className="py-1">
                          <div className="inline-flex overflow-hidden rounded-md border">
                            {MONEDAS.map((m) => (
                              <button
                                key={m}
                                type="button"
                                disabled={!puedeEditar || acciones.guardando}
                                onClick={() => acciones.patchCosto(c.id, { moneda: m })}
                                className={cn(
                                  'px-2 py-1 font-mono text-xs transition-colors',
                                  c.moneda === m
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                                )}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="py-1">
                          <Select
                            value={c.etapa_id != null ? String(c.etapa_id) : SIN_ETAPA}
                            disabled={!puedeEditar || proyecto.etapas.length === 0}
                            onValueChange={(v) =>
                              acciones.patchCosto(c.id, {
                                etapa_id: v === SIN_ETAPA ? null : Number(v),
                              })
                            }
                          >
                            <SelectTrigger
                              className="h-8 w-full border-transparent bg-transparent shadow-none hover:border-input"
                              aria-label="Etapa imputada"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SIN_ETAPA}>Sin etapa</SelectItem>
                              {proyecto.etapas.map((t) => (
                                <SelectItem key={t.id} value={String(t.id)}>
                                  {t.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {fmtUSD(costoLineaUSD(c, config))}
                        </TableCell>
                        <TableCell className="py-1">
                          {puedeEditar && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              disabled={acciones.guardando}
                              onClick={() => acciones.delCosto(c.id)}
                              aria-label={`Quitar ${c.concepto}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="pt-4 text-right text-muted-foreground">
                    TOTAL
                  </TableCell>
                  <TableCell className="pt-4 text-right font-mono font-semibold">
                    {fmtUSD(total)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}

          {puedeEditar && (
            <div className="px-6 pt-4">
              <Button
                variant="outline"
                className="w-full border-dashed"
                disabled={acciones.guardando}
                onClick={acciones.addCosto}
              >
                <Plus className="h-4 w-4" />
                Agregar línea de costo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
