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
      <div className="my-6 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex animate-pulse space-x-4">
          <div className="flex-1 space-y-3">
            <div className="h-4 w-3/4 rounded bg-white/10"></div>
            <div className="h-3 w-1/2 rounded bg-white/10"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-6 rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-red-300">
        {error}
      </div>
    );
  }

  if (bonificacionesFiltradas.length === 0) {
    return (
      <div className="my-6 rounded-xl border border-amber-700/40 bg-amber-950/30 p-4 text-amber-200">
        <span className="font-medium">Sin bonificaciones disponibles</span>
        <p className="mt-1 text-sm">
          No hay bonificaciones activas en este momento.
        </p>
      </div>
    );
  }

  return (
    <div className="my-6 space-y-4">
      <div className="flex items-center gap-3">
        <h4 className="text-lg font-semibold text-white">Bonificaciones disponibles</h4>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEmpresaSeleccionada(null)}
          className={`rounded-full border px-4 py-1.5 text-sm transition ${
            empresaSeleccionada === null
              ? 'border-white/30 bg-white/10 text-white'
              : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:text-white'
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
                ? 'border-white/30 bg-white/10 text-white'
                : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:text-white'
            }`}
          >
            {empresa}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {bonificacionesFiltradas.map((bonificacion) => (
          <div
            key={bonificacion.id}
            className="rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-white/20"
          >
            <div className="mb-2 text-xs uppercase tracking-[0.2em] text-white/50">
              {bonificacion.empresa}
            </div>
            <h5 className="mb-2 font-semibold text-white">
              {bonificacion.titulo}
            </h5>

            {bonificacion.descripcion && (
              <p className="mb-3 text-sm text-white/70">
                {bonificacion.descripcion}
              </p>
            )}

            {bonificacion.condiciones && (
              <div className="mt-3 border-t border-white/10 pt-3">
                <span className="text-xs font-medium uppercase tracking-wide text-white/50">
                  Condiciones
                </span>
                <p className="mt-1 text-sm text-white/75">
                  {bonificacion.condiciones}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
