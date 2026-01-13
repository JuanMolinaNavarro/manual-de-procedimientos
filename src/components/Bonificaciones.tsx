/**
 * Componente Bonificaciones
 *
 * Componente React para mostrar bonificaciones en documentos MDX.
 * Uso: <Bonificaciones tipo="A" />
 *
 * - Solo lectura
 * - Muestra título, descripción y condiciones
 * - Optimizado para lectura rápida por agentes
 */

'use client';

import { useEffect, useState } from 'react';

interface Bonificacion {
  id: number;
  tipo: 'A' | 'B';
  titulo: string;
  descripcion: string | null;
  condiciones: string | null;
}

interface BonificacionesProps {
  /**
   * Tipo de bonificación a mostrar: 'A' o 'B'
   */
  tipo: 'A' | 'B';
}

/**
 * Muestra las bonificaciones activas de un tipo específico.
 * Diseñado para uso en documentación MDX del manual de procedimientos.
 */
export default function Bonificaciones({ tipo }: BonificacionesProps) {
  const [bonificaciones, setBonificaciones] = useState<Bonificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBonificaciones = async () => {
      try {
        const response = await fetch(`/api/bonificaciones?tipo=${tipo}`);
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
  }, [tipo]);

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

  if (bonificaciones.length === 0) {
    return (
      <div className="my-6 rounded-xl border border-amber-700/40 bg-amber-950/30 p-4 text-amber-200">
        <span className="font-medium">Sin bonificaciones disponibles</span>
        <p className="mt-1 text-sm">
          No hay bonificaciones de tipo {tipo} activas en este momento.
        </p>
      </div>
    );
  }

  return (
    <div className="my-6 space-y-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-white/80">
          {tipo}
        </span>
        <h4 className="text-lg font-semibold text-white">
          Bonificaciones disponibles
        </h4>
      </div>

      <div className="grid gap-3">
        {bonificaciones.map((bonificacion) => (
          <div
            key={bonificacion.id}
            className="rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-white/20"
          >
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
