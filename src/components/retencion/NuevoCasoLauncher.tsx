'use client';

import { FormEvent, useState } from 'react';
import { EMPRESAS } from '@/lib/empresas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NuevoCasoLauncher() {
  const [unidad, setUnidad] = useState<string>(EMPRESAS[0]);
  const [numeroAbonado, setNumeroAbonado] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const numeroAbonadoLimpio = numeroAbonado.trim();
    if (!numeroAbonadoLimpio) {
      setError('Ingresa un numero de abonado valido.');
      return;
    }

    const searchParams = new URLSearchParams({
      unidad,
      numeroAbonado: numeroAbonadoLimpio,
    });

    const nuevaPestana = window.open(
      `/retencion/primeros-pasos?${searchParams.toString()}`,
      '_blank',
      'noopener,noreferrer',
    );

    if (!nuevaPestana) {
      return;
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold text-foreground">Iniciar un nuevo caso</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="unidad">Unidad</Label>
          <select
            id="unidad"
            value={unidad}
            onChange={(event) => setUnidad(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {EMPRESAS.map((empresa) => (
              <option key={empresa} value={empresa}>
                {empresa}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="numeroAbonado">Numero de Abonado</Label>
          <Input
            id="numeroAbonado"
            value={numeroAbonado}
            onChange={(event) => setNumeroAbonado(event.target.value)}
            placeholder="Ej: 123456"
            required
          />
        </div>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit">+ Nuevo caso</Button>
      </form>
    </section>
  );
}
