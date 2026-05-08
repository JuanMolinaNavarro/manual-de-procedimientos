'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { ContratoVendedor, ArchivoContrato, SaltoImporte } from '@/lib/senales-ip';

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-border py-2 last:border-0">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="col-span-2 text-sm text-foreground">{value ?? <span className="text-muted-foreground">-</span>}</dd>
    </div>
  );
}

export default function DetalleContratoVendedorPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [contrato, setContrato] = useState<ContratoVendedor | null>(null);
  const [archivos, setArchivos] = useState<ArchivoContrato[]>([]);
  const [saltos, setSaltos] = useState<SaltoImporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [cRes, aRes, sRes] = await Promise.all([
        fetch(`/api/admin/senales-ip/vendedores/${id}`),
        fetch(`/api/admin/senales-ip/archivos?contrato_vendedor_id=${id}`),
        fetch('/api/admin/senales-ip/saltos'),
      ]);
      if (!cRes.ok) throw new Error('No encontrado');
      setContrato(await cRes.json());
      if (aRes.ok) setArchivos(await aRes.json());
      if (sRes.ok) {
        const all: SaltoImporte[] = await sRes.json();
        setSaltos(all.filter((s) => s.contrato_vendedor_id === id));
      }
    } catch {
      setError('No se pudo cargar el contrato.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('contrato_vendedor_id', String(id));
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

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('es-AR') : '-';
  const formatBytes = (b: number | null) => b ? `${(b / 1024).toFixed(1)} KB` : '';

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Cargando...</div>;
  if (error || !contrato) return (
    <div className="space-y-4">
      <Button variant="outline" onClick={() => router.push('/admin/senales-ip/vendedores')}>← Volver</Button>
      <div className="rounded-md border border-red-900/50 bg-red-950/30 p-4 text-red-300">{error || 'No encontrado'}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push('/admin/senales-ip/vendedores')}>← Volver</Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{contrato.nombre_empresa}</h2>
            <p className="text-sm text-muted-foreground">Contrato Vendedor #{contrato.id}</p>
          </div>
        </div>
        <Button onClick={() => router.push(`/admin/senales-ip/vendedores/${id}/editar`)}>Editar</Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Datos de contacto</CardTitle></CardHeader>
          <CardContent>
            <dl>
              <InfoRow label="Documentación" value={contrato.documentacion_empresa} />
              <InfoRow label="Ejecutivo (Señales IP)" value={contrato.ejecutivo_cargo} />
              <InfoRow label="Mail comercial cliente" value={contrato.mail_comercial_cliente} />
              <InfoRow label="Teléfono comercial" value={contrato.telefono_comercial_cliente} />
              <InfoRow label="Mail técnico cliente" value={contrato.mail_tecnico_cliente} />
              <InfoRow label="Teléfono técnico" value={contrato.telefono_tecnico_cliente} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Condiciones comerciales</CardTitle></CardHeader>
          <CardContent>
            <dl>
              <InfoRow label="Vigencia" value={contrato.vigencia_desde || contrato.vigencia_hasta
                ? `${formatDate(contrato.vigencia_desde)} – ${formatDate(contrato.vigencia_hasta)}`
                : 'Sin límite'} />
              <InfoRow label="Precio" value={contrato.precio_tipo && contrato.precio_valor
                ? `${contrato.precio_tipo === 'subs' ? 'Por subs' : 'Fee'}: ${contrato.precio_valor}`
                : null} />
              <InfoRow label="Subs. mín. garantizado" value={contrato.subs_minimo_garantizado} />
              <InfoRow label="Subs. reportados señales" value={contrato.subs_reportados_senales} />
              <InfoRow label="Plazas contrato" value={contrato.plazas_incluidas_contrato} />
              <InfoRow label="Plazas reportadas" value={contrato.plazas_reportadas_senales} />
              <InfoRow label="TNB aplicada" value={contrato.tnb_aplicada} />
              <InfoRow label="Recepción/entrega" value={contrato.forma_recepcion_entrega} />
              <InfoRow label="Estado" value={
                <Badge variant={contrato.activa ? 'default' : 'secondary'}>
                  {contrato.activa ? 'Activo' : 'Inactivo'}
                </Badge>
              } />
            </dl>
          </CardContent>
        </Card>

        {contrato.grilla && (
          <Card>
            <CardHeader><CardTitle>Grilla</CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-wrap text-sm">{contrato.grilla}</p></CardContent>
          </Card>
        )}

        {contrato.condiciones_pago && (
          <Card>
            <CardHeader><CardTitle>Condiciones de pago</CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-wrap text-sm">{contrato.condiciones_pago}</p></CardContent>
          </Card>
        )}

        {contrato.condiciones_entrega_equipamiento && (
          <Card>
            <CardHeader><CardTitle>Condiciones de entrega de equipamiento</CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-wrap text-sm">{contrato.condiciones_entrega_equipamiento}</p></CardContent>
          </Card>
        )}

        {contrato.equipos_por_senal && contrato.equipos_por_senal.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Equipos por señal habilitados</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Señal</TableHead>
                    <TableHead>Equipo habilitado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contrato.equipos_por_senal.map((eq, i) => (
                    <TableRow key={i}>
                      <TableCell>{eq.signal}</TableCell>
                      <TableCell>{eq.equipment}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
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
            <Button variant="outline" size="sm" onClick={() => router.push(`/admin/senales-ip/saltos/nuevo?vendedor=${id}`)}>
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
