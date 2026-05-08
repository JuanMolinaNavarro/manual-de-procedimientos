'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { SaltoImporte } from '@/lib/senales-ip';

export default function SaltosPage() {
  const router = useRouter();
  const [saltos, setSaltos] = useState<SaltoImporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSaltos = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/senales-ip/saltos');
      if (!res.ok) throw new Error('Error al cargar');
      setSaltos(await res.json());
    } catch {
      setError('No se pudieron cargar los saltos de precio.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSaltos(); }, [fetchSaltos]);

  const marcarNotificado = async (id: number) => {
    setSaltos((prev) => prev.map((s) => s.id === id ? { ...s, notificado_at: new Date() } : s));
    await fetch(`/api/admin/senales-ip/saltos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificado: true }),
    });
  };

  const eliminar = async (id: number) => {
    if (!window.confirm('¿Eliminar este salto de precio?')) return;
    await fetch(`/api/admin/senales-ip/saltos/${id}`, { method: 'DELETE' });
    setSaltos((prev) => prev.filter((s) => s.id !== id));
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Saltos de precio</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Alertas configuradas para cambios de precio en contratos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/admin/senales-ip')}>← Volver</Button>
          <Button onClick={() => router.push('/admin/senales-ip/saltos/nuevo')}>+ Nuevo salto</Button>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-900/50 bg-red-950/30 p-4 text-red-300">{error}</div>}

      {saltos.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sin saltos de precio</CardTitle>
            <CardDescription>No hay saltos de precio configurados.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Fecha efectiva</TableHead>
                  <TableHead className="hidden sm:table-cell">Nuevo precio</TableHead>
                  <TableHead className="hidden md:table-cell">Aviso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saltos.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.descripcion}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.contrato_comprador_id
                        ? `Comprador #${s.contrato_comprador_id}`
                        : s.contrato_vendedor_id
                          ? `Vendedor #${s.contrato_vendedor_id}`
                          : '-'}
                    </TableCell>
                    <TableCell>{s.fecha_efectiva}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{s.nuevo_precio ?? '-'}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{s.dias_aviso_previo} días</TableCell>
                    <TableCell>
                      {s.notificado_at ? (
                        <Badge variant="secondary">Visto</Badge>
                      ) : (
                        <Badge variant="default">Pendiente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!s.notificado_at && (
                          <Button variant="ghost" size="sm" onClick={() => marcarNotificado(s.id)}>
                            Marcar visto
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => eliminar(s.id)}>Eliminar</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
