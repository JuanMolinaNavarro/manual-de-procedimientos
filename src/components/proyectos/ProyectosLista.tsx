'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Coins, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ESTADOS_PROYECTO, PLANTILLAS_CRONOGRAMA, estadoProyecto } from '@/lib/proyectos-datos';
import {
  fmtMonto,
  fmtUSD,
  hoyISO,
  resumenFinanciero,
  type ConfigProyectos,
  type Proyecto,
} from '@/lib/proyectos-calc';
import ConfigDialog from './ConfigDialog';
import ResponsableSelect, { type EmpleadoOpcion } from './ResponsableSelect';

interface Props {
  proyectos: Proyecto[];
  config: ConfigProyectos;
  empleados: EmpleadoOpcion[];
  puedeEditar: boolean;
}

export default function ProyectosLista({ proyectos, config, empleados, puedeEditar }: Props) {
  const router = useRouter();
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [configAbierto, setConfigAbierto] = useState(false);
  const [filtro, setFiltro] = useState<string>('todos');

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [responsable, setResponsable] = useState<string | null>(null);
  const [responsableId, setResponsableId] = useState<number | null>(null);
  const [inicio, setInicio] = useState(hoyISO());
  const [plantilla, setPlantilla] = useState(PLANTILLAS_CRONOGRAMA[0].id);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const visibles = filtro === 'todos' ? proyectos : proyectos.filter((p) => p.estado === filtro);

  // Totales de cartera: lo que sirve para mirar de un vistazo.
  const totales = proyectos.reduce(
    (acc, p) => {
      const r = resumenFinanciero(p, config);
      acc.costo += r.costoConst;
      acc.ingreso += r.ingresoConst;
      acc.margen += r.margen;
      return acc;
    },
    { costo: 0, ingreso: 0, margen: 0 },
  );

  const abrirNuevo = () => {
    setNombre('');
    setDescripcion('');
    setResponsable(null);
    setResponsableId(null);
    setInicio(hoyISO());
    setPlantilla(PLANTILLAS_CRONOGRAMA[0].id);
    setError('');
    setNuevoAbierto(true);
  };

  const crear = async () => {
    if (!nombre.trim()) {
      setError('Poné un nombre al proyecto.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const res = await fetch('/api/admin/proyectos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          descripcion,
          responsable,
          responsable_id: responsableId,
          fecha_inicio: inicio,
          plantilla,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo crear el proyecto');
      setNuevoAbierto(false);
      router.push(`/admin/proyectos/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el proyecto');
    } finally {
      setGuardando(false);
    }
  };

  const plantillaElegida = PLANTILLAS_CRONOGRAMA.find((p) => p.id === plantilla);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Proyectos y finanzas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cronograma, costos y análisis financiero de cada proyecto.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setConfigAbierto(true)}>
            <Coins className="h-4 w-4" />
            Moneda e inflación
          </Button>
          {puedeEditar && (
            <Button onClick={abrirNuevo}>
              <Plus className="h-4 w-4" />
              Nuevo proyecto
            </Button>
          )}
        </div>
      </div>

      {proyectos.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ResumenCartera titulo="Proyectos" valor={String(proyectos.length)} />
          <ResumenCartera titulo="Costo total" valor={fmtUSD(totales.costo)} />
          <ResumenCartera titulo="Ingreso proyectado" valor={fmtUSD(totales.ingreso)} />
          <ResumenCartera
            titulo="Margen"
            valor={fmtUSD(totales.margen)}
            clase={
              totales.margen > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : totales.margen < 0
                  ? 'text-red-600 dark:text-red-400'
                  : undefined
            }
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {[{ id: 'todos', label: 'Todos' }, ...ESTADOS_PROYECTO].map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setFiltro(e.id)}
              aria-pressed={filtro === e.id}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs transition-colors',
                filtro === e.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {e.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          TC ARS/USD <b className="font-mono text-foreground">{fmtMonto(config.fx_ars)}</b> · inflación
          USD <b className="font-mono text-foreground">{config.infl_usd}%</b> · año base{' '}
          <b className="font-mono text-foreground">{config.anio_base}</b>
        </span>
      </div>

      {visibles.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {proyectos.length === 0 ? 'Todavía no hay proyectos' : 'Ningún proyecto en este estado'}
            </CardTitle>
            <CardDescription>
              {proyectos.length === 0
                ? 'Creá el primero: elegís una plantilla de cronograma, cargás los costos y el módulo arma el análisis financiero.'
                : 'Probá con otro filtro.'}
            </CardDescription>
          </CardHeader>
          {proyectos.length === 0 && puedeEditar && (
            <CardContent>
              <Button onClick={abrirNuevo}>
                <Plus className="h-4 w-4" />
                Crear el primer proyecto
              </Button>
            </CardContent>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((p) => {
            const r = resumenFinanciero(p, config);
            const est = estadoProyecto(p.estado);
            return (
              <Link key={p.id} href={`/admin/proyectos/${p.id}`} className="group">
                <Card className="h-full gap-4 transition-colors group-hover:border-primary/50 group-hover:bg-accent/40">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{p.nombre}</CardTitle>
                      <Badge variant="secondary" className={cn('shrink-0 border-0', est.clase)}>
                        {est.label}
                      </Badge>
                    </div>
                    <CardDescription className="font-mono text-xs">
                      {p.etapas.length} etapa(s) · inicio {p.fecha_inicio}
                      {p.responsable_nombre && ` · ${p.responsable_nombre}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-muted-foreground">Costo (USD const.)</span>
                      <span className="font-mono">{fmtUSD(r.costoConst)}</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-muted-foreground">Margen proyectado</span>
                      <span
                        className={cn(
                          'font-mono',
                          r.ingreso <= 0
                            ? 'text-muted-foreground'
                            : r.margen > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400',
                        )}
                      >
                        {r.ingreso <= 0 ? 'sin ingreso' : fmtUSD(r.margen)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-muted-foreground">Avance</span>
                      <span className="font-mono">{r.avance}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${r.avance}%` }}
                      />
                    </div>
                    {r.etapasAtrasadas > 0 && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {r.etapasAtrasadas} etapa(s) atrasada(s)
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Nuevo proyecto ── */}
      <Dialog open={nuevoAbierto} onOpenChange={setNuevoAbierto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo proyecto</DialogTitle>
            <DialogDescription>
              La plantilla precarga el cronograma con etapas encadenadas. Después editás nombres,
              duraciones y agregás las que falten.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="np-nombre">Nombre del proyecto</Label>
              <Input
                id="np-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="ej: Migración de plataforma de facturación"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="np-desc">Descripción (opcional)</Label>
              <Textarea
                id="np-desc"
                rows={2}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Objetivo y alcance en una o dos líneas."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="np-resp">Responsable (opcional)</Label>
                <ResponsableSelect
                  id="np-resp"
                  responsableId={responsableId}
                  responsableTexto={responsable}
                  empleados={empleados}
                  onChange={(v) => {
                    setResponsableId(v.responsable_id);
                    setResponsable(v.responsable);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="np-inicio">Fecha de inicio</Label>
                <Input
                  id="np-inicio"
                  type="date"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="np-plantilla">Plantilla de cronograma</Label>
              <Select value={plantilla} onValueChange={setPlantilla}>
                <SelectTrigger id="np-plantilla" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLANTILLAS_CRONOGRAMA.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {plantillaElegida && (
                <p className="text-xs text-muted-foreground">{plantillaElegida.descripcion}</p>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setNuevoAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={crear} disabled={guardando}>
              {guardando ? 'Creando…' : 'Crear proyecto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfigDialog
        abierto={configAbierto}
        onOpenChange={setConfigAbierto}
        config={config}
        puedeEditar={puedeEditar}
        onGuardado={() => router.refresh()}
      />
    </div>
  );
}

function ResumenCartera({
  titulo,
  valor,
  clase,
}: {
  titulo: string;
  valor: string;
  clase?: string;
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {titulo}
        </p>
        <p className={cn('mt-1 font-mono text-xl font-semibold', clase)}>{valor}</p>
      </CardContent>
    </Card>
  );
}
