'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { ConfigProyectos } from '@/lib/proyectos-calc';

interface Props {
  abierto: boolean;
  onOpenChange: (v: boolean) => void;
  config: ConfigProyectos;
  puedeEditar: boolean;
  onGuardado: (config: ConfigProyectos) => void;
}

/** Parámetros de moneda e inflación: afectan a todos los proyectos. */
export default function ConfigDialog({
  abierto,
  onOpenChange,
  config,
  puedeEditar,
  onGuardado,
}: Props) {
  const [fx, setFx] = useState(String(config.fx_ars));
  const [infl, setInfl] = useState(String(config.infl_usd));
  const [anio, setAnio] = useState(String(config.anio_base));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setFx(String(config.fx_ars));
    setInfl(String(config.infl_usd));
    setAnio(String(config.anio_base));
    setError('');
  }, [abierto, config]);

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      const res = await fetch('/api/admin/proyectos/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fx_ars: Number(fx),
          infl_usd: Number(infl),
          anio_base: Number(anio),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo guardar');
      onGuardado(data as ConfigProyectos);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Moneda e inflación</DialogTitle>
          <DialogDescription>
            Todo se guarda en USD. Estos parámetros afectan a todos los proyectos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cf-fx">Tipo de cambio ARS por USD</Label>
            <Input
              id="cf-fx"
              className="font-mono"
              value={fx}
              onChange={(e) => setFx(e.target.value)}
              disabled={!puedeEditar}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cf-infl">Inflación anual del dólar (% — CPI de EE.UU.)</Label>
            <Input
              id="cf-infl"
              className="font-mono"
              value={infl}
              onChange={(e) => setInfl(e.target.value)}
              disabled={!puedeEditar}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cf-anio">Año base (para USD constantes)</Label>
            <Input
              id="cf-anio"
              type="number"
              className="font-mono"
              value={anio}
              onChange={(e) => setAnio(e.target.value)}
              disabled={!puedeEditar}
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            El año base es la vara: un costo del año 3 se deflacta a su poder adquisitivo en{' '}
            {config.anio_base} para comparar campañas de distintos años con la misma moneda real.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {puedeEditar ? 'Cancelar' : 'Cerrar'}
          </Button>
          {puedeEditar && (
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
