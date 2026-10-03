'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ClockAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { PendienteAsistencia } from '@/lib/organigrama';

/**
 * Botón + diálogo de la barra: fichas activas del organigrama elegido que todavía no tienen
 * legajo del reloj vinculado o no tienen horario. Se completan en Asistencia › Personas.
 */
export default function PendientesAsistencia({
  orgId,
  onAbrirFicha,
}: {
  orgId: number | null;
  /** Abre la ficha del organigrama en modo edición. */
  onAbrirFicha: (id: number) => void;
}) {
  // Con el id del organigrama: al cambiar de empresa no se muestra la lista de la anterior.
  const [datos, setDatos] = useState<{ orgId: number; lista: PendienteAsistencia[] } | null>(null);
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(
    (id: number) =>
      fetch(`/api/admin/organigrama/pendientes-asistencia?organigramaId=${id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((lista: PendienteAsistencia[] | null) => lista && setDatos({ orgId: id, lista }))
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    if (orgId != null) void cargar(orgId);
  }, [orgId, cargar]);

  const pendientes = datos?.orgId === orgId ? datos.lista : [];
  if (orgId == null || pendientes.length === 0) return null;

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setAbierto(true);
          void cargar(orgId);
        }}
        className="neu-btn h-10 rounded-xl"
      >
        <ClockAlert className="mr-1 h-4 w-4" /> Asistencia pendiente ({pendientes.length})
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Pendientes de asistencia</DialogTitle>
            <DialogDescription>
              Personas activas de esta empresa sin legajo del reloj vinculado o sin horario configurado. Se completan en{' '}
              <Link href="/admin/asistencia?tab=personas" className="underline">
                Asistencia › Personas
              </Link>
              .
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-[60vh] divide-y overflow-y-auto">
            {pendientes.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <button
                  type="button"
                  onClick={() => {
                    setAbierto(false);
                    onAbrirFicha(p.id);
                  }}
                  className="min-w-0 text-left"
                  title="Abrir la ficha para editarla"
                >
                  <span className="block truncate font-medium hover:underline">{p.nombre}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[p.rol, p.area].filter(Boolean).join(' · ')}
                  </span>
                </button>
                <div className="flex shrink-0 gap-1">
                  {p.sinLegajo && <Badge variant="outline">Sin vincular</Badge>}
                  {p.sinHorario && <Badge variant="outline">Sin horario</Badge>}
                </div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
