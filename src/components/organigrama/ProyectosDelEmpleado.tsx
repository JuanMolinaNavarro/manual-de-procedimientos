'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { estadoEtapa, estadoProyecto } from '@/lib/proyectos-datos';
import type { ProyectoDeEmpleado } from '@/lib/proyectos';

export interface EstadoProyectosEmpleado {
  /** null mientras carga. */
  proyectos: ProyectoDeEmpleado[] | null;
  error: string;
}

/**
 * Trae los proyectos en los que participa una persona. Vive en el modal (y no
 * en la pestaña) porque el resultado decide si la pestaña se muestra: en modo
 * lectura las pestañas vacías se ocultan.
 */
export function useProyectosDeEmpleado(
  empleadoId: number | null,
  activo: boolean,
): EstadoProyectosEmpleado {
  // Resultado y error se guardan junto al id que los produjo: así, al cambiar de
  // persona, el estado se deriva a "cargando" sin tener que resetearlo desde el
  // efecto (evita el setState sincrónico y datos de la ficha anterior).
  const [cache, setCache] = useState<{ id: number; datos: ProyectoDeEmpleado[] } | null>(null);
  const [fallo, setFallo] = useState<{ id: number; msg: string } | null>(null);

  useEffect(() => {
    // id 0 o null = empleado sin guardar (modo alta): no hay nada que buscar.
    if (!activo || !empleadoId) return;
    let vigente = true;

    fetch(`/api/admin/organigrama/empleados/${empleadoId}/proyectos`)
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudieron cargar los proyectos');
        return (await res.json()) as ProyectoDeEmpleado[];
      })
      .then((datos) => {
        if (vigente) setCache({ id: empleadoId, datos });
      })
      .catch((e) => {
        if (vigente) {
          setFallo({ id: empleadoId, msg: e instanceof Error ? e.message : 'Error al cargar' });
        }
      });

    return () => {
      vigente = false;
    };
  }, [empleadoId, activo]);

  if (!empleadoId) return { proyectos: [], error: '' };
  return {
    proyectos: cache?.id === empleadoId ? cache.datos : null,
    error: fallo?.id === empleadoId ? fallo.msg : '',
  };
}

/** Proyectos que tiene a cargo la persona, o donde es responsable de una etapa. */
export default function ProyectosDelEmpleado({ proyectos, error }: EstadoProyectosEmpleado) {
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (proyectos === null) return <p className="text-sm text-muted-foreground">Cargando proyectos…</p>;

  if (proyectos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No participa en ningún proyecto. Se asigna desde{' '}
        <Link href="/admin/proyectos" className="underline">
          Proyectos
        </Link>
        , eligiéndola como responsable del proyecto o de alguna etapa.
      </p>
    );
  }

  return (
    // Altura fija para ~3 tarjetas: la lista scrollea sola en vez de estirar la ficha.
    <div className="max-h-[350px] space-y-3 overflow-y-auto pr-1.5">
      {proyectos.map((p) => {
        const est = estadoProyecto(p.estado);
        return (
          <div key={p.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/admin/proyectos/${p.id}`}
                  className="inline-flex items-center gap-1.5 font-medium hover:underline"
                >
                  {p.nombre}
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                </Link>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {p.fecha_inicio} → {p.fecha_fin}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                {p.es_responsable && <Badge variant="outline">Responsable</Badge>}
                <Badge variant="secondary" className={cn('border-0', est.clase)}>
                  {est.label}
                </Badge>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${p.avance}%` }} />
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">{p.avance}%</span>
            </div>

            {p.etapas_a_cargo.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t pt-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Etapas a su cargo
                </p>
                {p.etapas_a_cargo.map((t) => {
                  const e = estadoEtapa(t.estado);
                  return (
                    <div key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', e.punto)} />
                      <span className="min-w-0 flex-1 truncate">{t.nombre}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {t.fecha_inicio} → {t.fecha_fin} · {t.avance}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
