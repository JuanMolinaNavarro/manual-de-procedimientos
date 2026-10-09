'use client';

/**
 * Detalle de un contrato de comprador o de vendedor. Carga el contrato, sus archivos y sus saltos
 * de precio y dibuja lo común; cada tipo pasa sus filas de contacto, sus condiciones propias y sus
 * tarjetas extra.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ArchivoContrato, SaltoImporte } from '@/lib/senales-ip';
import { apiFetch } from '@/components/comunes/api';
import { CONTRATO, ErrorForm, vigenciaTexto, type Contrato, type TipoContrato } from './piezas';

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-border py-2 last:border-0">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="col-span-2 text-sm text-foreground">{value ?? <span className="text-muted-foreground">-</span>}</dd>
    </div>
  );
}

/** Tarjeta de texto libre (condiciones, grilla…); no se muestra si está vacío. */
export function TextoCard({ titulo, texto }: { titulo: string; texto: string | null }) {
  if (!texto) return null;
  return (
    <Card>
      <CardHeader><CardTitle>{titulo}</CardTitle></CardHeader>
      <CardContent><p className="whitespace-pre-wrap text-sm text-foreground">{texto}</p></CardContent>
    </Card>
  );
}

export default function DetalleContrato<T extends Contrato>({ tipo, contacto, condiciones, extra }: {
  tipo: TipoContrato;
  /** Filas de "Datos de contacto". */
  contacto: (c: T) => ReactNode;
  /** Filas propias de "Condiciones comerciales" (entre Precio y Estado). */
  condiciones: (c: T) => ReactNode;
  /** Tarjetas propias debajo de las condiciones. */
  extra: (c: T) => ReactNode;
}) {
  const router = useRouter();
  const id = Number(useParams().id);
  const cfg = CONTRATO[tipo];
  const ruta = `/admin/senales-ip/${tipo}`;
  const campoId = `contrato_${cfg.singular}_id` as const;

  const [contrato, setContrato] = useState<T | null>(null);
  const [archivos, setArchivos] = useState<ArchivoContrato[]>([]);
  const [saltos, setSaltos] = useState<SaltoImporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [c, a, s] = await Promise.all([
        apiFetch<T>(`/api/admin/senales-ip/${tipo}/${id}`),
        apiFetch<ArchivoContrato[]>(`/api/admin/senales-ip/archivos?${campoId}=${id}`).catch(() => []),
        apiFetch<SaltoImporte[]>('/api/admin/senales-ip/saltos').catch(() => []),
      ]);
      setContrato(c);
      setArchivos(a);
      setSaltos(s.filter((x) => x[campoId] === id));
    } catch {
      setError('No se pudo cargar el contrato.');
    } finally {
      setLoading(false);
    }
  }, [tipo, id, campoId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append(campoId, String(id));
    try {
      const res = await fetch('/api/admin/senales-ip/archivos', { method: 'POST', body: fd });
      if (res.ok) {
        const archivo = await res.json();
        setArchivos((prev) => [...prev, archivo]);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const eliminarArchivo = async (archivoId: number) => {
    if (!window.confirm('¿Eliminar este archivo?')) return;
    await fetch(`/api/admin/senales-ip/archivos/${archivoId}`, { method: 'DELETE' });
    setArchivos((prev) => prev.filter((a) => a.id !== archivoId));
  };

  const formatBytes = (b: number | null) => b ? `${(b / 1024).toFixed(1)} KB` : '';

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Cargando...</div>;
  if (error || !contrato) return (
    <div className="space-y-4">
      <Button variant="outline" onClick={() => router.push(ruta)}>← Volver</Button>
      <ErrorForm error={error || 'No encontrado'} />
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push(ruta)}>← Volver</Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{contrato.nombre_empresa}</h2>
            <p className="text-sm text-muted-foreground">Contrato {cfg.titulo} #{contrato.id}</p>
          </div>
        </div>
        <Button onClick={() => router.push(`${ruta}/${id}/editar`)}>Editar</Button>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Datos de contacto</CardTitle></CardHeader>
          <CardContent><dl>{contacto(contrato)}</dl></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Condiciones comerciales</CardTitle></CardHeader>
          <CardContent>
            <dl>
              <InfoRow label="Vigencia" value={vigenciaTexto(contrato)} />
              <InfoRow label="Precio" value={contrato.precio_tipo && contrato.precio_valor
                ? `${contrato.precio_tipo === 'subs' ? 'Por subs' : 'Fee'}: ${contrato.precio_valor}`
                : null} />
              {condiciones(contrato)}
              <InfoRow label="Estado" value={
                <Badge variant={contrato.activa ? 'default' : 'secondary'}>{contrato.activa ? 'Activo' : 'Inactivo'}</Badge>
              } />
            </dl>
          </CardContent>
        </Card>

        {extra(contrato)}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Documentación adjunta</CardTitle>
            <label className="cursor-pointer">
              <span className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">
                {uploading ? 'Subiendo...' : '+ Adjuntar archivo'}
              </span>
              <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {archivos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin archivos adjuntos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                  <TableHead className="hidden sm:table-cell">Tamaño</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivos.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.nombre_original}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{a.tipo_mime ?? '-'}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{formatBytes(a.tamano)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/api/admin/senales-ip/archivos/${a.id}`} download={a.nombre_original}>Descargar</a>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => eliminarArchivo(a.id)}>Eliminar</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Saltos de precio</CardTitle>
            <Button variant="outline" size="sm" onClick={() => router.push(`/admin/senales-ip/saltos/nuevo?${cfg.singular}=${id}`)}>
              + Agregar salto
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {saltos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin saltos de precio registrados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Fecha efectiva</TableHead>
                  <TableHead>Nuevo precio</TableHead>
                  <TableHead>Aviso (días)</TableHead>
                  <TableHead>Notificado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saltos.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.descripcion}</TableCell>
                    <TableCell>{s.fecha_efectiva}</TableCell>
                    <TableCell>{s.nuevo_precio ?? '-'}</TableCell>
                    <TableCell>{s.dias_aviso_previo}</TableCell>
                    <TableCell>{s.notificado_at ? new Date(s.notificado_at).toLocaleDateString('es-AR') : 'No'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Creado por: {contrato.created_by ?? '-'} · Última modificación por: {contrato.updated_by ?? '-'}
      </p>
    </div>
  );
}
