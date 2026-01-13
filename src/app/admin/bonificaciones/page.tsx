/**
 * Página principal de Bonificaciones (Admin)
 *
 * Lista todas las bonificaciones con opciones para crear, editar y activar/desactivar.
 * Diseñada para usuarios no técnicos.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Bonificacion {
  id: number;
  empresa: string;
  titulo: string;
  descripcion: string | null;
  condiciones: string | null;
  activa: boolean;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
}

export default function BonificacionesPage() {
  const router = useRouter();
  const [bonificaciones, setBonificaciones] = useState<Bonificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchBonificaciones = useCallback(async () => {
    try {
      const response = await fetch('/api/bonificaciones?all=true');
      if (!response.ok) {
        throw new Error('Error al cargar las bonificaciones');
      }
      const data = await response.json();
      setBonificaciones(data);
    } catch (err) {
      setError('No se pudieron cargar las bonificaciones');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBonificaciones();
  }, [fetchBonificaciones]);

  const toggleActiva = async (id: number, activa: boolean) => {
    try {
      if (activa) {
        await fetch(`/api/bonificaciones/${id}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/bonificaciones/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activa: true }),
        });
      }
      fetchBonificaciones();
    } catch (err) {
      console.error('Error al cambiar estado:', err);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-AR');
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Cargando...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Bonificaciones</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Administre las bonificaciones disponibles para los agentes
          </p>
        </div>
        <Button onClick={() => router.push('/admin/bonificaciones/nueva')}>
          + Nueva bonificación
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 p-4 text-red-300">
          {error}
        </div>
      )}

      {bonificaciones.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sin bonificaciones</CardTitle>
            <CardDescription>
              Aún no hay bonificaciones creadas. Haga clic en “Nueva bonificación”
              para agregar una.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Empresa</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead className="hidden md:table-cell">Vigencia</TableHead>
                  <TableHead className="w-32 text-center">Estado</TableHead>
                  <TableHead className="w-32 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bonificaciones.map((bonificacion) => (
                  <TableRow key={bonificacion.id}>
                    <TableCell>
                      <Badge variant="secondary">
                        {bonificacion.empresa}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{bonificacion.titulo}</div>
                      {bonificacion.descripcion && (
                        <div className="max-w-xs truncate text-sm text-muted-foreground">
                          {bonificacion.descripcion}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {bonificacion.vigencia_desde || bonificacion.vigencia_hasta ? (
                        <>
                          {formatDate(bonificacion.vigencia_desde)} - {formatDate(bonificacion.vigencia_hasta)}
                        </>
                      ) : (
                        'Sin límite'
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch
                          checked={bonificacion.activa}
                          onCheckedChange={() => toggleActiva(bonificacion.id, bonificacion.activa)}
                        />
                        <span className="text-sm text-muted-foreground">
                          {bonificacion.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/admin/bonificaciones/${bonificacion.id}/editar`)}
                      >
                        Editar
                      </Button>
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
