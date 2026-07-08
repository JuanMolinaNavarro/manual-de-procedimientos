'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, FileText, Upload, RefreshCw, RotateCcw, ChevronLeft, ChevronRight, X, Download } from 'lucide-react';
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

const PAGE_SIZE = 15;

// A partir de cuántos caracteres el error se recorta y aparece el botón "Ver más".
const ERROR_PREVIEW_MAX = 80;

// ── Filtros ────────────────────────────────────────────────────────────────
type DateFilter = 'hoy' | 'ayer' | '7d' | 'mes' | 'todas';
type StatusFilter = 'todas' | 'cargada' | 'repetida' | 'error';

const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'ayer', label: 'Ayer' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: 'mes', label: 'Último mes' },
  { value: 'todas', label: 'Todas' },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'cargada', label: 'Cargada' },
  { value: 'repetida', label: 'Repetida' },
  { value: 'error', label: 'Error' },
];

/** Filtra por fecha de carga (`created_at`). */
function matchesDate(createdAt: string | Date, filter: DateFilter): boolean {
  if (filter === 'todas') return true;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return true;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (filter) {
    case 'hoy':
      return created >= startOfToday;
    case 'ayer': {
      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);
      return created >= startOfYesterday && created < startOfToday;
    }
    case '7d': {
      // Hoy + los 6 días previos (7 días calendario).
      const sevenDaysAgo = new Date(startOfToday);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      return created >= sevenDaysAgo;
    }
    case 'mes': {
      const monthAgo = new Date(startOfToday);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return created >= monthAgo;
    }
    default:
      return true;
  }
}

/** Filtra por estado. 'error' agrupa los estados `error` y `revision` (ambos se
 *  muestran como "Error"); 'repetida' corresponde al estado `duplicada`. */
function matchesStatus(estado: FacturaEstadoCarga, filter: StatusFilter): boolean {
  switch (filter) {
    case 'todas':
      return true;
    case 'cargada':
      return estado === 'cargada';
    case 'repetida':
      return estado === 'duplicada';
    case 'error':
      return estado === 'error' || estado === 'revision';
    default:
      return true;
  }
}

function formatMonto(monto: string | null): string | null {
  if (!monto) return null;
  const n = Number(monto);
  if (Number.isNaN(n)) return monto;
  return n.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function EstadoBadge({ estado }: { estado: FacturaEstadoCarga }) {
  const map: Record<FacturaEstadoCarga, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pendiente: { label: 'Pendiente',  variant: 'secondary' },
    cargando:  { label: 'Cargando…',  variant: 'outline'   },
    cargada:   { label: 'Cargada',    variant: 'default'   },
    duplicada: { label: 'Repetida',  variant: 'secondary' },
    revision:  { label: 'Error',      variant: 'destructive' },
    error:     { label: 'Error',      variant: 'destructive' },
  };
  const { label, variant } = map[estado] ?? map.error;
  return <Badge variant={variant}>{label}</Badge>;
}

/** Modal liviano para ver el texto completo de un error de carga. */
function ErrorDialog({
  nombre,
  mensaje,
  onClose,
}: {
  nombre: string;
  mensaje: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detalle del error"
        className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-border bg-card shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Detalle del error</h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground" title={nombre}>
              {nombre}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} title="Cerrar">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-auto px-5 py-4">
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-destructive">
            {mensaje}
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
          <Button size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function FacturasPage() {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState<DateFilter>('todas');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todas');
  const [errorDialog, setErrorDialog] = useState<{ nombre: string; mensaje: string } | null>(null);
  const [retrying, setRetrying] = useState<Set<number>>(() => new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Filtros (client-side) por fecha de carga y estado.
  const filtered = useMemo(
    () =>
      facturas.filter(
        (f) =>
          matchesDate(f.created_at, dateFilter) &&
          matchesStatus(f.estado_carga, statusFilter),
      ),
    [facturas, dateFilter, statusFilter],
  );

  // Al cambiar un filtro, volver a la primera página.
  useEffect(() => {
    setPage(1);
  }, [dateFilter, statusFilter]);

  // Paginación (client-side). currentPage queda clampeado por si la lista se achica.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const desde = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const hasta = Math.min(currentPage * PAGE_SIZE, filtered.length);

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
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = '';

    if (files.some((f) => f.type !== 'application/pdf')) {
      setError('Solo se aceptan archivos PDF.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('file', f));
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

  // Reintenta la carga de una factura en Error: la vuelve a 'pendiente' para que
  // el worker la retome. Actualiza la fila al instante y arranca el polling.
  async function handleRetry(id: number) {
    if (retrying.has(id)) return;
    setRetrying((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/facturas/${id}/reintentar`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Error al reintentar la carga');
      }
      setFacturas((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, estado_carga: 'pendiente', carga_error: null } : f,
        ),
      );
      startPolling();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reintentar la carga');
    } finally {
      setRetrying((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  // Descarga un ZIP con los PDFs de las facturas actualmente filtradas.
  async function handleDownloadFiltered() {
    if (filtered.length === 0 || downloading) return;
    setDownloading(true);
    try {
      const ids = filtered.map((f) => f.id);
      const res = await fetch('/api/admin/facturas/descargar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Error al descargar las facturas');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `facturas_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al descargar las facturas');
    } finally {
      setDownloading(false);
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
            multiple
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
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-muted-foreground">Fecha:</span>
              {DATE_FILTERS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={dateFilter === opt.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-muted-foreground">Estado:</span>
              {STATUS_FILTERS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={statusFilter === opt.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={handleDownloadFiltered}
              disabled={downloading || filtered.length === 0}
              title="Descargar en ZIP las facturas filtradas"
            >
              <Download className="mr-2 h-4 w-4" />
              {downloading ? 'Generando…' : `Descargar (${filtered.length})`}
            </Button>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
              <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No hay facturas que coincidan con los filtros.
              </p>
            </div>
          ) : (
          <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Emisión</TableHead>
                <TableHead>Nº Finnegans</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[120px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((f) => {
                const monto = formatMonto(f.monto_total);
                const tieneError =
                  (f.estado_carga === 'error' || f.estado_carga === 'revision') && !!f.carga_error;
                return (
                  <TableRow key={f.id}>
                    <TableCell className="text-muted-foreground">{f.id}</TableCell>
                    <TableCell className="max-w-[150px] truncate font-medium" title={f.nombre_original}>
                      {f.nombre_original}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate" title={f.proveedor ?? undefined}>
                      {f.proveedor ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>{f.empresa_destino ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      {f.tipo_flujo
                        ? TIPO_FLUJO_LABELS[f.tipo_flujo] ?? f.tipo_flujo
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {monto ? `$${monto}` : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>{f.fecha_emision ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{f.finnegans_numero_interno ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <EstadoBadge estado={f.estado_carga} />
                      {tieneError && (
                        <div className="mt-1 max-w-[190px]">
                          <p className="line-clamp-2 text-xs leading-snug break-words text-destructive">
                            {f.carga_error}
                          </p>
                          {f.carga_error!.length > ERROR_PREVIEW_MAX && (
                            <button
                              type="button"
                              onClick={() =>
                                setErrorDialog({ nombre: f.nombre_original, mensaje: f.carga_error! })
                              }
                              className="mt-0.5 text-xs font-medium text-destructive underline underline-offset-2 hover:no-underline"
                            >
                              Ver más
                            </button>
                          )}
                        </div>
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
                        {(f.estado_carga === 'error' || f.estado_carga === 'revision') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRetry(f.id)}
                            disabled={retrying.has(f.id)}
                            title="Reintentar carga"
                          >
                            <RotateCcw
                              className={`h-4 w-4 ${retrying.has(f.id) ? 'animate-spin' : ''}`}
                            />
                          </Button>
                        )}
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
                );
              })}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <span>
              Mostrando {desde}–{hasta} de {filtered.length}
            </span>
            <div className="flex items-center gap-3">
              <span>
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  title="Anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                  title="Siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
          )}
        </div>
      )}

      {errorDialog && (
        <ErrorDialog
          nombre={errorDialog.nombre}
          mensaje={errorDialog.mensaje}
          onClose={() => setErrorDialog(null)}
        />
      )}
    </div>
  );
}
