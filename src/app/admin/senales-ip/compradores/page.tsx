'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { ContratoComprador } from '@/lib/senales-ip';

export default function CompradoresPage() {
  const router = useRouter();
  const [contratos, setContratos] = useState<ContratoComprador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchContratos = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/senales-ip/compradores');
      if (!res.ok) throw new Error('Error al cargar');
      setContratos(await res.json());
    } catch {
      setError('No se pudieron cargar los contratos de compradores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchContratos(); }, [fetchContratos]);

  const toggleActiva = async (id: number, activa: boolean) => {
    await fetch(`/api/admin/senales-ip/compradores/${id}`, {
      method: activa ? 'DELETE' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: activa ? undefined : JSON.stringify({ activa: true }),
    });
    fetchContratos();
  };

  const eliminar = async (id: number) => {
    if (!window.confirm('¿Eliminar este contrato de forma permanente? Esta acción no se puede deshacer.')) return;
    await fetch(`/api/admin/senales-ip/compradores/${id}?hard=true`, { method: 'DELETE' });
    fetchContratos();
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('es-AR') : '-';

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Contratos Comprador</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Adquisición de derechos de señales IP
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/admin/senales-ip')}>← Volver</Button>
          <Button onClick={() => router.push('/admin/senales-ip/compradores/nueva')}>+ Nuevo contrato</Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 p-4 text-red-300">{error}</div>
      )}

      {contratos.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sin contratos</CardTitle>
            <CardDescription>
              No hay contratos de comprador registrados. Haga clic en "+ Nuevo contrato" para agregar uno.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="hidden md:table-cell">Ejecutivo</TableHead>
                  <TableHead className="hidden lg:table-cell">Vigencia</TableHead>
                  <TableHead className="hidden sm:table-cell">Precio</TableHead>
                  <TableHead className="w-28 text-center">Estado</TableHead>
                  <TableHead className="w-48 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.nombre_empresa}</div>
                      {c.mail_comercial && (
                        <div className="text-xs text-muted-foreground">{c.mail_comercial}</div>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {c.ejecutivo_a_cargo ?? '-'}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {c.vigencia_desde || c.vigencia_hasta
                        ? `${formatDate(c.vigencia_desde)} – ${formatDate(c.vigencia_hasta)}`
                        : 'Sin límite'}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {c.precio_tipo && c.precio_valor
                        ? <Badge variant="secondary">{c.precio_tipo}: {c.precio_valor}</Badge>
                        : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch
                          checked={c.activa}
                          onCheckedChange={() => toggleActiva(c.id, c.activa)}
                        />
                        <span className="text-sm text-muted-foreground">{c.activa ? 'Activo' : 'Inactivo'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/senales-ip/compradores/${c.id}`)}>
                          Ver
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/senales-ip/compradores/${c.id}/editar`)}>
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => eliminar(c.id)}>
                          Eliminar
                        </Button>
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
