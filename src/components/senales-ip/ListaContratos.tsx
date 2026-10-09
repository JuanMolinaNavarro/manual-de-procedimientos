'use client';

/** Lista de contratos de comprador o de vendedor: activar/desactivar, ver, editar y eliminar. */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/components/comunes/api';
import { CONTRATO, ErrorForm, vigenciaTexto, type Contrato, type TipoContrato } from './piezas';

export default function ListaContratos({ tipo }: { tipo: TipoContrato }) {
  const router = useRouter();
  const cfg = CONTRATO[tipo];
  const api = `/api/admin/senales-ip/${tipo}`;
  const ruta = `/admin/senales-ip/${tipo}`;
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchContratos = useCallback(async () => {
    try {
      setContratos(await apiFetch<Contrato[]>(api));
    } catch {
      setError(`No se pudieron cargar los contratos de ${tipo}.`);
    } finally {
      setLoading(false);
    }
  }, [api, tipo]);

  useEffect(() => { fetchContratos(); }, [fetchContratos]);

  const toggleActiva = async (id: number, activa: boolean) => {
    await fetch(`${api}/${id}`, {
      method: activa ? 'DELETE' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: activa ? undefined : JSON.stringify({ activa: true }),
    });
    fetchContratos();
  };

  const eliminar = async (id: number) => {
    if (!window.confirm('¿Eliminar este contrato de forma permanente? Esta acción no se puede deshacer.')) return;
    await fetch(`${api}/${id}?hard=true`, { method: 'DELETE' });
    fetchContratos();
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Cargando...</div>;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Contratos {cfg.titulo}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{cfg.subtitulo}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/admin/senales-ip')}>← Volver</Button>
          <Button onClick={() => router.push(`${ruta}/nueva`)}>+ Nuevo contrato</Button>
        </div>
      </div>

      <ErrorForm error={error} />

      {contratos.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sin contratos</CardTitle>
            <CardDescription>
              No hay contratos de {cfg.singular} registrados. Haga clic en &quot;+ Nuevo contrato&quot; para agregar uno.
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
                      {cfg.mail(c) && <div className="text-xs text-muted-foreground">{cfg.mail(c)}</div>}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{cfg.ejecutivo(c) ?? '-'}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{vigenciaTexto(c)}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {c.precio_tipo && c.precio_valor ? <Badge variant="secondary">{c.precio_tipo}: {c.precio_valor}</Badge> : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch checked={c.activa} onCheckedChange={() => toggleActiva(c.id, c.activa)} />
                        <span className="text-sm text-muted-foreground">{c.activa ? 'Activo' : 'Inactivo'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`${ruta}/${c.id}`)}>Ver</Button>
                        <Button variant="ghost" size="sm" onClick={() => router.push(`${ruta}/${c.id}/editar`)}>Editar</Button>
                        <Button variant="ghost" size="sm" onClick={() => eliminar(c.id)}>Eliminar</Button>
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
