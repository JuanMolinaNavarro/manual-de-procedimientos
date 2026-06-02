'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2, FileText, Upload, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Factura, FacturaEstadoCarga } from '@/lib/facturas';

const TIPO_FLUJO_LABELS: Record<string, string> = {
  arrendamiento_soportes: 'Soportes',
  energia_electrica: 'Energía',
  recaudacion: 'Recaudación GIRE',
  recaudacion_sepsa: 'Recaudación SEPSA',
};

function EstadoBadge({ estado }: { estado: FacturaEstadoCarga }) {
  const map: Record<FacturaEstadoCarga, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pendiente: { label: 'Pendiente',  variant: 'secondary' },
    cargando:  { label: 'Cargando…',  variant: 'outline'   },
    cargada:   { label: 'Cargada',    variant: 'default'   },
    duplicada: { label: 'Ya existía', variant: 'secondary' },
    revision:  { label: 'Revisión',   variant: 'outline'   },
    error:     { label: 'Error',      variant: 'destructive' },
  };
  const { label, variant } = map[estado] ?? map.error;
  return <Badge variant={variant}>{label}</Badge>;
}

export default function FacturasPage() {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchFacturas = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/facturas');
      if (!res.ok) throw new Error('Error al cargar facturas');
      const data: Factura[] = await res.json();
      setFacturas(data);
      setError('');
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll while any factura is being processed
  useEffect(() => {
    fetchFacturas().then((data) => {
      const hasPending = data.some(
        (f) => f.estado_carga === 'pendiente' || f.estado_carga === 'cargando',
      );
      if (hasPending) startPolling();
    });
    return () => stopPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startPolling() {
    if (pollIntervalRef.current) return;
    pollIntervalRef.current = setInterval(async () => {
      const data = await fetchFacturas();
      const hasPending = data.some(
        (f) => f.estado_carga === 'pendiente' || f.estado_carga === 'cargando',
      );
      if (!hasPending) stopPolling();
    }, 5000);
  }

  function stopPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.type !== 'application/pdf') {
      setError('Solo se aceptan archivos PDF.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/facturas', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Error al subir factura');
      }
      await fetchFacturas();
      startPolling();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir factura');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta factura?')) return;
    try {
      const res = await fetch(`/api/admin/facturas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      setFacturas((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar factura');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Facturas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cargá facturas en PDF para extracción y carga automática en FinnegansGO.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchFacturas()}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? 'Subiendo…' : 'Agregar factura'}
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : facturas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No hay facturas cargadas todavía.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="mr-2 h-4 w-4" />
            Subir primera factura
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Monto Total</TableHead>
                <TableHead>Fecha Emisión</TableHead>
                <TableHead>Nº Finnegans</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facturas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="text-muted-foreground">{f.id}</TableCell>
                  <TableCell className="max-w-[200px] truncate font-medium" title={f.nombre_original}>
                    {f.nombre_original}
                  </TableCell>
                  <TableCell>{f.proveedor ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {f.tipo_flujo
                      ? TIPO_FLUJO_LABELS[f.tipo_flujo] ?? f.tipo_flujo
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {f.monto_total
                      ? `$${f.monto_total}`
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>{f.fecha_emision ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{f.finnegans_numero_interno ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <EstadoBadge estado={f.estado_carga} />
                    {(f.estado_carga === 'error' || f.estado_carga === 'revision') && f.carga_error && (
                      <p className="mt-1 text-xs text-destructive">{f.carga_error}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a
                          href={`/api/admin/facturas/${f.id}/archivo`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ver PDF"
                        >
                          <FileText className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(f.id)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
