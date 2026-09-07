'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { asistFetch, mensajeError, type Persona } from './api';
import type { EmpleadoOpt } from './AsistenciaPage';

const SIN_VINCULO = '__none__';

export default function PersonasTab({ empleados }: { empleados: EmpleadoOpt[] }) {
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [vinculando, setVinculando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await asistFetch<{ personas: Persona[] }>('/api/admin/asistencia/personas');
      setPersonas(r.personas);
    } catch (e) {
      setError(mensajeError(e));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtradas = useMemo(() => {
    if (!personas) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return personas;
    return personas.filter((p) => p.nombre.toLowerCase().includes(needle) || p.userId.toLowerCase().includes(needle));
  }, [personas, q]);

  async function vincular(id: number, empleadoId: number | null) {
    try {
      await asistFetch(`/api/admin/asistencia/personas/${id}`, { method: 'PATCH', body: JSON.stringify({ empleadoId }) });
      setPersonas((ps) => (ps ?? []).map((p) => {
        if (p.id !== id) return p;
        const emp = empleadoId != null ? (empleados.find((e) => e.id === empleadoId) ?? null) : null;
        return { ...p, empleadoId, empleado: emp, nombre: emp?.nombre || p.nombreReloj || p.userId };
      }));
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  async function vincularAuto() {
    setVinculando(true);
    try {
      const r = await asistFetch<{ vinculadas: number }>('/api/admin/asistencia/personas/vincular', { method: 'POST' });
      toast.success(`${r.vinculadas} persona(s) vinculadas por CUIL.`);
      await cargar();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setVinculando(false);
    }
  }

  const vinculadas = personas?.filter((p) => p.empleadoId != null).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input value={q} placeholder="Buscar por nombre o legajo" onChange={(e) => setQ(e.target.value)} className="h-9 w-64" />
        <Badge variant="secondary">{vinculadas}/{personas?.length ?? 0} vinculadas al organigrama</Badge>
        <Button variant="outline" onClick={vincularAuto} disabled={vinculando} className="ml-auto h-9">
          {vinculando ? 'Vinculando…' : 'Vincular por CUIL'}
        </Button>
      </div>

      {error && <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm">{error}</div>}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Legajo/ID</TableHead>
              <TableHead>Nombre en el reloj</TableHead>
              <TableHead>Empleado del organigrama</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {personas == null && <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Cargando…</TableCell></TableRow>}
            {personas != null && filtradas.length === 0 && <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Sin personas.</TableCell></TableRow>}
            {filtradas.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="tabular-nums">{p.userId}</TableCell>
                <TableCell className="text-muted-foreground">{p.nombreReloj || '—'}</TableCell>
                <TableCell>
                  <Select
                    value={p.empleadoId != null ? String(p.empleadoId) : SIN_VINCULO}
                    onValueChange={(v) => vincular(p.id, v === SIN_VINCULO ? null : Number(v))}
                  >
                    <SelectTrigger className="h-9 w-72"><SelectValue placeholder="Sin vincular" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SIN_VINCULO}>Sin vincular</SelectItem>
                      {empleados.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.nombre} · {e.rol}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
