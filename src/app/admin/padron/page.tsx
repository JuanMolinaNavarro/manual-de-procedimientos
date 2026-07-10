'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EMPRESAS } from '@/lib/empresas';

interface PadronItem {
  id: number;
  codigo: string | null;
  nombre_completo: string | null;
  estado: string | null;
  domicilio: string | null;
  domicilio_info_adic: string | null;
  documento_numero: string | null;
  saldo: number | null;
}

const formatSaldo = (v: number | null) =>
  v === null
    ? '—'
    : v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

interface Resultado {
  total: number;
  items: PadronItem[];
  page: number;
  pageSize: number;
  totalPages: number;
}

interface Query {
  dni: string;
  nombre: string;
  domicilio: string;
}

export default function PadronPage() {
  const [empresa, setEmpresa] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Carga
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Búsqueda
  const [dni, setDni] = useState('');
  const [nombre, setNombre] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [result, setResult] = useState<Resultado | null>(null);
  const [activeQuery, setActiveQuery] = useState<Query | null>(null);

  const refreshCounts = async () => {
    try {
      const res = await fetch('/api/admin/padron/cargar');
      if (res.ok) setCounts((await res.json()).counts ?? {});
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    refreshCounts();
  }, []);

  // Al cambiar de empresa, limpiamos la búsqueda previa.
  const onEmpresaChange = (value: string) => {
    setEmpresa(value);
    setResult(null);
    setActiveQuery(null);
    setSearchError('');
    setUploadMsg('');
    setUploadError('');
  };

  const cargar = async () => {
    const file = fileRef.current?.files?.[0];
    if (!empresa) {
      setUploadError('Seleccioná una empresa primero.');
      return;
    }
    if (!file) {
      setUploadError('Elegí un archivo .xlsx.');
      return;
    }
    setUploading(true);
    setUploadError('');
    setUploadMsg('');
    try {
      const body = new FormData();
      body.append('empresa', empresa);
      body.append('file', file);
      const res = await fetch('/api/admin/padron/cargar', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo cargar el padrón.');
      setUploadMsg(
        `Padrón de ${empresa} reemplazado: ${data.total.toLocaleString('es-AR')} abonados.`,
      );
      setCounts((prev) => ({ ...prev, [empresa]: data.total }));
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setUploading(false);
    }
  };

  const runSearch = async (q: Query, page: number) => {
    setSearching(true);
    setSearchError('');
    try {
      const params = new URLSearchParams({ empresa, page: String(page) });
      if (q.dni) params.set('dni', q.dni);
      if (q.nombre) params.set('nombre', q.nombre);
      if (q.domicilio) params.set('domicilio', q.domicilio);
      const res = await fetch(`/api/admin/padron/buscar?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo buscar.');
      setResult(data as Resultado);
      setActiveQuery(q);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Error inesperado.');
      setResult(null);
    } finally {
      setSearching(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa) {
      setSearchError('Seleccioná una empresa.');
      return;
    }
    const q: Query = { dni: dni.trim(), nombre: nombre.trim(), domicilio: domicilio.trim() };
    if (!q.dni && !q.nombre && !q.domicilio) {
      setSearchError('Ingresá al menos un criterio.');
      return;
    }
    runSearch(q, 1);
  };

  const goToPage = (p: number) => {
    if (activeQuery) runSearch(activeQuery, p);
  };

  const totalEmpresa = empresa ? counts[empresa] ?? 0 : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Padrón de abonados</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Control de duplicados por empresa: cargá el Excel de una empresa y buscá por documento,
          nombre o domicilio.
        </p>
      </div>

      {/* Selector de empresa (aplica a carga y búsqueda) */}
      <Card>
        <CardContent className="flex flex-col gap-2 pt-6 sm:flex-row sm:items-end sm:gap-4">
          <div className="flex-1 space-y-2">
            <Label htmlFor="empresa">Empresa</Label>
            <select
              id="empresa"
              value={empresa}
              onChange={(e) => onEmpresaChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Seleccioná una empresa…</option>
              {EMPRESAS.map((e) => (
                <option key={e} value={e}>
                  {e}
                  {counts[e] ? ` (${counts[e].toLocaleString('es-AR')})` : ''}
                </option>
              ))}
            </select>
          </div>
          {empresa && (
            <p className="text-sm text-muted-foreground sm:pb-2">
              Padrón actual:{' '}
              <span className="font-medium text-foreground">
                {(totalEmpresa ?? 0).toLocaleString('es-AR')}
              </span>{' '}
              abonados.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Carga del Excel */}
      <Card>
        <CardHeader>
          <CardTitle>Cargar padrón (Excel)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              disabled={!empresa}
              className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-2 file:text-sm file:text-foreground hover:file:bg-accent disabled:opacity-50"
            />
            <Button onClick={cargar} disabled={uploading || !empresa} className="shrink-0">
              {uploading ? 'Cargando… (puede tardar)' : 'Reemplazar padrón'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Reemplaza <span className="font-medium text-foreground">todo</span> el padrón de la
            empresa seleccionada.
          </p>
          {uploadMsg && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              {uploadMsg}
            </div>
          )}
          {uploadError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {uploadError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Búsqueda */}
      <Card>
        <CardHeader>
          <CardTitle>Buscar duplicados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="dni">DNI / CUIT</Label>
              <Input id="dni" value={dni} onChange={(e) => setDni(e.target.value)} placeholder="Documento" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Apellido, Nombre" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domicilio">Domicilio</Label>
              <Input id="domicilio" value={domicilio} onChange={(e) => setDomicilio(e.target.value)} placeholder="Calle y número" />
            </div>
            <Button type="submit" disabled={searching || !empresa}>
              {searching ? 'Buscando…' : 'Buscar'}
            </Button>
          </form>

          {searchError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {searchError}
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {result.total === 0
                  ? 'Sin coincidencias.'
                  : `${result.total.toLocaleString('es-AR')} coincidencia${result.total === 1 ? '' : 's'} en ${empresa}.`}
              </p>

              {result.items.length > 0 && (
                <>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Código</th>
                          <th className="px-3 py-2 font-medium">Nombre</th>
                          <th className="px-3 py-2 font-medium">Estado</th>
                          <th className="px-3 py-2 font-medium">Domicilio</th>
                          <th className="px-3 py-2 font-medium">Info adic.</th>
                          <th className="px-3 py-2 font-medium">Documento</th>
                          <th className="px-3 py-2 text-right font-medium">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.items.map((it) => (
                          <tr key={it.id} className="border-t border-border hover:bg-muted/30">
                            <td className="px-3 py-2 tabular-nums text-foreground">{it.codigo ?? '—'}</td>
                            <td className="px-3 py-2 text-foreground">{it.nombre_completo ?? '—'}</td>
                            <td className="px-3 py-2 text-foreground">{it.estado ?? '—'}</td>
                            <td className="px-3 py-2 text-foreground">{it.domicilio ?? '—'}</td>
                            <td className="px-3 py-2 text-muted-foreground">{it.domicilio_info_adic ?? '—'}</td>
                            <td className="px-3 py-2 tabular-nums text-foreground">{it.documento_numero ?? '—'}</td>
                            <td
                              className={`px-3 py-2 text-right tabular-nums ${
                                it.saldo ? 'font-medium text-foreground' : 'text-muted-foreground'
                              }`}
                            >
                              {formatSaldo(it.saldo)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginación (10 por página) */}
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={searching || result.page <= 1}
                      onClick={() => goToPage(result.page - 1)}
                    >
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Página {result.page} de {result.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={searching || result.page >= result.totalPages}
                      onClick={() => goToPage(result.page + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
