/**
 * Componente Bonificaciones
 *
 * Componente React para mostrar bonificaciones en documentos MDX.
 * Uso: <Bonificaciones />
 *
 * - Solo lectura
 * - Muestra título, descripción y condiciones
 * - Optimizado para lectura rápida por agentes
 */

'use client';

import { useEffect, useState } from 'react';
import { EMPRESAS } from '@/lib/empresas';

interface Bonificacion {
  id: number;
  empresa: string;
  titulo: string;
  descripcion: string | null;
  condiciones: string | null;
}

/**
 * Muestra las bonificaciones activas y permite filtrar por empresa.
 * Diseñado para uso en documentación MDX del manual de procedimientos.
 */
export default function Bonificaciones() {
  const [bonificaciones, setBonificaciones] = useState<Bonificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState<string | null>(null);

  useEffect(() => {
    const fetchBonificaciones = async () => {
      try {
        const response = await fetch('/api/bonificaciones');
        if (!response.ok) {
          throw new Error('Error al cargar bonificaciones');
        }
        const data = await response.json();
        setBonificaciones(data);
      } catch (err) {
        setError('No se pudieron cargar las bonificaciones');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchBonificaciones();
  }, []);

  const bonificacionesFiltradas = empresaSeleccionada
    ? bonificaciones.filter((bonificacion) => bonificacion.empresa === empresaSeleccionada)
    : bonificaciones;

  if (loading) {
    return (
      <div className="my-6 rounded-xl border border-border bg-card p-4">
        <div className="flex animate-pulse space-x-4">
          <div className="flex-1 space-y-3">
            <div className="h-4 w-3/4 rounded bg-muted"></div>
            <div className="h-3 w-1/2 rounded bg-muted"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="my-6 space-y-4">
      <div className="flex items-center gap-3">
        <h4 className="text-lg font-semibold text-foreground">Bonificaciones disponibles</h4>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEmpresaSeleccionada(null)}
          className={`rounded-full border px-4 py-1.5 text-sm transition ${
            empresaSeleccionada === null
              ? 'border-border bg-muted text-foreground'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          }`}
        >
          Todas
        </button>
        {EMPRESAS.map((empresa) => (
          <button
            key={empresa}
            type="button"
            onClick={() => setEmpresaSeleccionada(empresa)}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              empresaSeleccionada === empresa
                ? 'border-border bg-muted text-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {empresa}
          </button>
        ))}
      </div>

      {bonificacionesFiltradas.length === 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-200">
          <span className="font-medium">Sin bonificaciones disponibles</span>
          <p className="mt-1 text-sm">
            No hay bonificaciones activas en este momento.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {bonificacionesFiltradas.map((bonificacion) => (
            <div
              key={bonificacion.id}
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-muted-foreground/40"
            >
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {bonificacion.empresa}
              </div>
              <h5 className="mb-2 font-semibold text-foreground">
                {bonificacion.titulo}
              </h5>

              {bonificacion.descripcion && (
                <p className="mb-3 text-sm text-muted-foreground">
                  {bonificacion.descripcion}
                </p>
              )}

              {bonificacion.condiciones && (
                <div className="mt-3 border-t border-border pt-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Condiciones
                  </span>
                  <p className="mt-1 text-sm text-foreground/80">
                    {bonificacion.condiciones}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
