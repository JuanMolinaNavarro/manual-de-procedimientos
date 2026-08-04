'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ESTADOS_ETAPA, MESES_CORTOS, estadoEtapa } from '@/lib/proyectos-datos';
import {
  difDias,
  hoyISO,
  limitesCronograma,
  sumarDias,
  type EtapaProyecto,
  type Proyecto,
} from '@/lib/proyectos-calc';
import InfoHint from './InfoHint';
import ResponsableSelect, { type EmpleadoOpcion } from './ResponsableSelect';
import type { AccionesProyecto } from './ProyectoDetalle';

interface Props {
  proyecto: Proyecto;
  empleados: EmpleadoOpcion[];
  puedeEditar: boolean;
  acciones: AccionesProyecto;
}

export default function TabCronograma({ proyecto, empleados, puedeEditar, acciones }: Props) {
  const [selId, setSelId] = useState<number | null>(null);
  const seleccionada = proyecto.etapas.find((t) => t.id === selId) ?? null;

  const limites = limitesCronograma(proyecto);
  const pxPorDia = Math.max(3, Math.min(11, 820 / limites.dias));
  const x = (iso: string) => difDias(limites.min, iso) * pxPorDia;
  const anchoTotal = limites.dias * pxPorDia;

  // Marcas de mes sobre la escala.
  const meses: { iso: string; label: string }[] = [];
  const cursor = new Date(`${limites.min}T12:00:00`);
  cursor.setDate(1);
  while (
    `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-01` < limites.max
  ) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-01`;
    meses.push({
      iso,
      label: `${MESES_CORTOS[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const hoy = hoyISO();
  const mostrarHoy = hoy >= limites.min && hoy <= limites.max;

  return (
    <div className="space-y-6">
      <p className="flex items-center text-sm text-muted-foreground">
        Tocá una etapa para editarla. Si tiene etapas que dependen de ella, se corren en cascada.
        <InfoHint k="cascada" />
      </p>

      {seleccionada && (
        <EditorEtapa
          etapa={seleccionada}
          empleados={empleados}
          puedeEditar={puedeEditar}
          acciones={acciones}
          onCerrar={() => setSelId(null)}
        />
      )}

      <Card className="gap-0 py-0">
        <CardContent className="overflow-x-auto p-0">
          <div style={{ minWidth: 230 + anchoTotal }}>
            {/* Escala de meses */}
            <div className="sticky top-0 z-10 grid grid-cols-[230px_1fr] border-b bg-card/95 backdrop-blur">
              <div className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Etapa
              </div>
              <div className="relative h-8">
                {meses.map((m) => (
                  <div
                    key={m.iso}
                    className="absolute top-0 h-8 border-l pl-1.5 pt-2 font-mono text-[10px] uppercase text-muted-foreground"
                    style={{ left: x(m.iso) }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
            </div>

            {proyecto.etapas.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                El cronograma está vacío. Agregá la primera etapa abajo.
              </p>
            ) : (
              proyecto.etapas.map((t) => {
                const est = estadoEtapa(t.estado);
                const ancho = Math.max(14, t.duracion_dias * pxPorDia);
                const avance = Math.max(0, Math.min(100, t.avance));
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelId(t.id === selId ? null : t.id)}
                    className={cn(
                      'grid w-full grid-cols-[230px_1fr] items-center border-b text-left transition-colors hover:bg-accent/50',
                      t.id === selId && 'bg-accent/60',
                    )}
                  >
                    <div className="flex items-center gap-2.5 px-4 py-2">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', est.punto)} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{t.nombre}</span>
                        <span className="block font-mono text-[10px] text-muted-foreground">
                          {t.fecha_inicio} · {t.duracion_dias}d · {avance}%
                        </span>
                      </span>
                    </div>
                    <div className="relative h-12">
                      {mostrarHoy && (
                        <span
                          className="absolute inset-y-0 w-0.5 bg-amber-500/70"
                          style={{ left: x(hoy) }}
                          aria-hidden
                        />
                      )}
                      {/* Barra: el tramo sólido es el avance cargado. */}
                      <span
                        className={cn(
                          'absolute top-3 flex h-6 items-center overflow-hidden rounded-md',
                          est.barra,
                          'opacity-35',
                        )}
                        style={{ left: x(t.fecha_inicio), width: ancho }}
                      />
                      <span
                        className={cn('absolute top-3 h-6 rounded-l-md', est.barra)}
                        style={{
                          left: x(t.fecha_inicio),
                          width: (ancho * avance) / 100,
                          borderTopRightRadius: avance >= 100 ? '0.375rem' : 0,
                          borderBottomRightRadius: avance >= 100 ? '0.375rem' : 0,
                        }}
                      />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {ESTADOS_ETAPA.map((e) => (
          <span key={e.id} className="inline-flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', e.punto)} />
            {e.label}
          </span>
        ))}
        {mostrarHoy && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-0.5 bg-amber-500" />
            hoy
          </span>
        )}
      </div>

      {puedeEditar && (
        <Button
          variant="outline"
          className="w-full border-dashed"
          disabled={acciones.guardando}
          onClick={acciones.addEtapa}
        >
          <Plus className="h-4 w-4" />
          Agregar etapa
        </Button>
      )}
    </div>
  );
}

function EditorEtapa({
  etapa,
  empleados,
  puedeEditar,
  acciones,
  onCerrar,
}: {
  etapa: EtapaProyecto;
  empleados: EmpleadoOpcion[];
  puedeEditar: boolean;
  acciones: AccionesProyecto;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(etapa.nombre);
  const fin = sumarDias(etapa.fecha_inicio, etapa.duracion_dias);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{etapa.nombre}</CardTitle>
            <CardDescription>
              Termina el {fin}. Moverla arrastra también a las etapas que dependen de ella.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onCerrar} aria-label="Cerrar editor">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor={`et-nm-${etapa.id}`}>Nombre</Label>
            <Input
              id={`et-nm-${etapa.id}`}
              value={nombre}
              disabled={!puedeEditar}
              onChange={(e) => setNombre(e.target.value)}
              onBlur={() => {
                if (nombre.trim() && nombre !== etapa.nombre) {
                  acciones.patchEtapa(etapa.id, { nombre: nombre.trim() });
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`et-rs-${etapa.id}`}>Responsable</Label>
            <ResponsableSelect
              id={`et-rs-${etapa.id}`}
              responsableId={etapa.responsable_id}
              responsableTexto={etapa.responsable}
              empleados={empleados}
              disabled={!puedeEditar || acciones.guardando}
              onChange={(v) => acciones.patchEtapa(etapa.id, { ...v })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`et-st-${etapa.id}`}>Inicio</Label>
            <Input
              id={`et-st-${etapa.id}`}
              type="date"
              value={etapa.fecha_inicio}
              disabled={!puedeEditar}
              onChange={(e) =>
                e.target.value && acciones.patchEtapa(etapa.id, { fecha_inicio: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`et-du-${etapa.id}`}>Duración (días)</Label>
            <Input
              id={`et-du-${etapa.id}`}
              type="number"
              min={1}
              className="font-mono"
              defaultValue={etapa.duracion_dias}
              disabled={!puedeEditar}
              onBlur={(e) => {
                const v = Math.max(1, Number(e.target.value) || 1);
                if (v !== etapa.duracion_dias) acciones.patchEtapa(etapa.id, { duracion_dias: v });
              }}
            />
          </div>
        </div>

        {puedeEditar && (
          <>
            <div className="space-y-2">
              <Label htmlFor={`et-av-${etapa.id}`}>Avance: {etapa.avance}%</Label>
              {/* key: al cambiar el avance desde afuera (ej. botón "Hecho" → 100) el
                  input no controlado se remonta y la perilla queda sincronizada. */}
              <input
                key={`av-${etapa.id}-${etapa.avance}`}
                id={`et-av-${etapa.id}`}
                type="range"
                min={0}
                max={100}
                step={5}
                defaultValue={etapa.avance}
                className="w-full accent-primary"
                onMouseUp={(e) =>
                  acciones.patchEtapa(etapa.id, { avance: Number(e.currentTarget.value) })
                }
                onTouchEnd={(e) =>
                  acciones.patchEtapa(etapa.id, { avance: Number(e.currentTarget.value) })
                }
                onKeyUp={(e) =>
                  acciones.patchEtapa(etapa.id, { avance: Number(e.currentTarget.value) })
                }
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span className="mr-1 text-xs text-muted-foreground">Correr</span>
                {[-7, -1, 1, 7].map((d) => (
                  <Button
                    key={d}
                    variant="outline"
                    size="sm"
                    disabled={acciones.guardando}
                    onClick={() => acciones.patchEtapa(etapa.id, { correr: d })}
                  >
                    {d > 0 ? `+${d}d` : `${d}d`}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {ESTADOS_ETAPA.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    disabled={acciones.guardando}
                    onClick={() => acciones.patchEtapa(etapa.id, { estado: e.id })}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs transition-colors',
                      etapa.estado === e.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={acciones.guardando}
                onClick={() => {
                  acciones.delEtapa(etapa.id);
                  onCerrar();
                }}
              >
                Quitar etapa
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
