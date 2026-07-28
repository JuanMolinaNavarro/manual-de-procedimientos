'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coins, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ESTADOS_PROYECTO, estadoProyecto } from '@/lib/proyectos-datos';
import {
  resumenFinanciero,
  type ConfigProyectos,
  type Proyecto,
} from '@/lib/proyectos-calc';
import ConfigDialog from './ConfigDialog';
import TabResumen from './TabResumen';
import TabCronograma from './TabCronograma';
import TabCostos from './TabCostos';
import TabFinanzas from './TabFinanzas';

interface Props {
  proyectoInicial: Proyecto;
  configInicial: ConfigProyectos;
  puedeEditar: boolean;
}

/** Firma común que usan las pestañas para persistir cambios. */
export interface AccionesProyecto {
  patchProyecto: (data: Record<string, unknown>) => Promise<void>;
  addCosto: () => Promise<void>;
  patchCosto: (costoId: number, data: Record<string, unknown>) => Promise<void>;
  delCosto: (costoId: number) => Promise<void>;
  addEtapa: () => Promise<void>;
  patchEtapa: (etapaId: number, data: Record<string, unknown>) => Promise<void>;
  delEtapa: (etapaId: number) => Promise<void>;
  guardando: boolean;
  error: string;
}

export default function ProyectoDetalle({
  proyectoInicial,
  configInicial,
  puedeEditar,
}: Props) {
  const router = useRouter();
  const [proyecto, setProyecto] = useState(proyectoInicial);
  const [config, setConfig] = useState(configInicial);
  const [nombre, setNombre] = useState(proyectoInicial.nombre);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [configAbierto, setConfigAbierto] = useState(false);

  const base = `/api/admin/proyectos/${proyecto.id}`;

  /** Todas las mutaciones devuelven el proyecto completo ya recalculado. */
  const enviar = useCallback(async (url: string, method: string, body?: unknown) => {
    setGuardando(true);
    setError('');
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo guardar');
      if (data && typeof data === 'object' && 'id' in data) setProyecto(data as Proyecto);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }, []);

  const acciones = useMemo<AccionesProyecto>(
    () => ({
      guardando,
      error,
      patchProyecto: (data) => enviar(base, 'PUT', data),
      addCosto: () => enviar(`${base}/costos`, 'POST'),
      patchCosto: (id, data) => enviar(`${base}/costos/${id}`, 'PUT', data),
      delCosto: (id) => enviar(`${base}/costos/${id}`, 'DELETE'),
      addEtapa: () => enviar(`${base}/etapas`, 'POST'),
      patchEtapa: (id, data) => enviar(`${base}/etapas/${id}`, 'PUT', data),
      delEtapa: (id) => enviar(`${base}/etapas/${id}`, 'DELETE'),
    }),
    [base, enviar, guardando, error],
  );

  const eliminar = async () => {
    if (!window.confirm('¿Eliminar este proyecto? Se borran también sus costos y etapas.')) return;
    await fetch(base, { method: 'DELETE' });
    router.push('/admin/proyectos');
    router.refresh();
  };

  const resumen = resumenFinanciero(proyecto, config);
  const est = estadoProyecto(proyecto.estado);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={() => {
              if (nombre.trim() && nombre !== proyecto.nombre) {
                acciones.patchProyecto({ nombre: nombre.trim() });
              }
            }}
            disabled={!puedeEditar}
            aria-label="Nombre del proyecto"
            className="h-auto border-transparent bg-transparent px-1 text-2xl font-bold shadow-none focus-visible:border-input md:text-2xl"
          />
          <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
            <Badge variant="secondary" className={cn('border-0', est.clase)}>
              {est.label}
            </Badge>
            <span className="font-mono">inicio {proyecto.fecha_inicio}</span>
            <span>·</span>
            <span className="font-mono">{proyecto.etapas.length} etapa(s)</span>
            {proyecto.responsable && (
              <>
                <span>·</span>
                <span>{proyecto.responsable}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {puedeEditar && (
            <Select
              value={proyecto.estado}
              onValueChange={(v) => acciones.patchProyecto({ estado: v })}
            >
              <SelectTrigger className="w-40" aria-label="Estado del proyecto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS_PROYECTO.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" asChild>
            <Link href="/admin/proyectos">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setConfigAbierto(true)}>
            <Coins className="h-4 w-4" />
            Moneda
          </Button>
          {puedeEditar && (
            <Button variant="ghost" onClick={eliminar}>
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Tabs defaultValue="resumen" className="gap-6">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto border-b">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
          <TabsTrigger value="costos">Costos</TabsTrigger>
          <TabsTrigger value="finanzas">Análisis financiero</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <TabResumen
            proyecto={proyecto}
            resumen={resumen}
            config={config}
            puedeEditar={puedeEditar}
            acciones={acciones}
          />
        </TabsContent>
        <TabsContent value="cronograma">
          <TabCronograma proyecto={proyecto} puedeEditar={puedeEditar} acciones={acciones} />
        </TabsContent>
        <TabsContent value="costos">
          <TabCostos
            proyecto={proyecto}
            config={config}
            puedeEditar={puedeEditar}
            acciones={acciones}
          />
        </TabsContent>
        <TabsContent value="finanzas">
          <TabFinanzas
            proyecto={proyecto}
            resumen={resumen}
            config={config}
            puedeEditar={puedeEditar}
            acciones={acciones}
            onConfigChange={setConfig}
          />
        </TabsContent>
      </Tabs>

      <ConfigDialog
        abierto={configAbierto}
        onOpenChange={setConfigAbierto}
        config={config}
        puedeEditar={puedeEditar}
        onGuardado={setConfig}
      />
    </div>
  );
}
