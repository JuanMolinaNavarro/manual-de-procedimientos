'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ClockAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Organigrama, PendienteAsistencia } from '@/lib/organigrama';

/**
 * Botón + diálogo de la barra: fichas activas de todas las empresas que todavía no tienen
 * legajo del reloj vinculado o no tienen horario. Se completan en Asistencia › Personas.
 */
export default function PendientesAsistencia({ organigramas, orgId }: { organigramas: Organigrama[]; orgId: number | null }) {
  const [pendientes, setPendientes] = useState<PendienteAsistencia[] | null>(null);
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(
    () =>
      fetch('/api/admin/organigrama/pendientes-asistencia')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: PendienteAsistencia[] | null) => data && setPendientes(data))
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (!pendientes?.length) return null;

  // La empresa del lienzo primero; el resto en el orden del selector; sin empresa al final.
  const orden = [
    ...organigramas.filter((o) => o.id === orgId),
    ...organigramas.filter((o) => o.id !== orgId),
    { id: null, nombre: 'Sin empresa' },
  ];
  const grupos = orden
    .map((o) => ({ ...o, fichas: pendientes.filter((p) => p.organigrama_id === o.id) }))
    .filter((g) => g.fichas.length > 0);

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setAbierto(true);
          cargar();
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
              Personas activas sin legajo del reloj vinculado o sin horario configurado, por empresa. Se completan en{' '}
              <Link href="/admin/asistencia?tab=personas" className="underline">
                Asistencia › Personas
              </Link>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            {grupos.map((g) => (
              <section key={g.id ?? 'sin'}>
                <h3 className="mb-1 text-sm font-semibold">
                  {g.nombre} <span className="font-normal text-muted-foreground">({g.fichas.length})</span>
                </h3>
                <ul className="divide-y">
                  {g.fichas.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.nombre}</p>
                        <p className="truncate text-xs text-muted-foreground">{[p.rol, p.area].filter(Boolean).join(' · ')}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {p.sinLegajo && <Badge variant="outline">Sin vincular</Badge>}
                        {p.sinHorario && <Badge variant="outline">Sin horario</Badge>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
