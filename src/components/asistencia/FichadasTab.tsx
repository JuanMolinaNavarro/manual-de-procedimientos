'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { tipoMarcaLabel, modoMarcaLabel, hoyLocal, inicioDeMes } from '@/lib/asistencia-datos';
import { asistFetch, mensajeError, type FichadaDetalle, type FichadaDia, type Reloj } from './api';

type Vista = 'detalle' | 'dia';

export default function FichadasTab() {
  const hoy = hoyLocal();
  const [desde, setDesde] = useState(inicioDeMes(hoy));
  const [hasta, setHasta] = useState(hoy);
  const [relojId, setRelojId] = useState('todos');
  const [q, setQ] = useState('');
  const [vista, setVista] = useState<Vista>('detalle');
  const [page, setPage] = useState(1);

  const [relojes, setRelojes] = useState<Reloj[]>([]);
  const [detalle, setDetalle] = useState<{ items: FichadaDetalle[]; total: number; pageSize: number } | null>(null);
  const [dias, setDias] = useState<FichadaDia[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    asistFetch<{ relojes: Reloj[] }>('/api/admin/asistencia/relojes').then((r) => setRelojes(r.relojes)).catch(() => {});
  }, []);

  const params = useCallback(() => {
    const p = new URLSearchParams({ desde, hasta, vista, page: String(page) });
    if (relojId !== 'todos') p.set('relojId', relojId);
    if (q.trim()) p.set('q', q.trim());
    return p;
  }, [desde, hasta, vista, page, relojId, q]);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await asistFetch<{ vista: Vista; items: (FichadaDetalle | FichadaDia)[]; total?: number; pageSize?: number }>(
        `/api/admin/asistencia/fichadas?${params()}`,
      );
      if (data.vista === 'dia') {
        setDias(data.items as FichadaDia[]);
        setDetalle(null);
      } else {
        setDetalle({ items: data.items as FichadaDetalle[], total: data.total ?? 0, pageSize: data.pageSize ?? 200 });
        setDias(null);
      }
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
  const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

  const exportar = () => {
    window.location.href = `/api/admin/asistencia/fichadas/export?${params()}`;
  };

  const totalPaginas = detalle ? Math.max(1, Math.ceil(detalle.total / detalle.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <Campo label="Desde"><Input type="date" value={desde} max={hasta} onChange={(e) => { setDesde(e.target.value); setPage(1); }} className="h-9 w-40" /></Campo>
          <Campo label="Hasta"><Input type="date" value={hasta} min={desde} onChange={(e) => { setHasta(e.target.value); setPage(1); }} className="h-9 w-40" /></Campo>
          <Campo label="Reloj">
            <Select value={relojId} onValueChange={(v) => { setRelojId(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {relojes.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Buscar persona"><Input value={q} placeholder="Nombre o legajo" onChange={(e) => { setQ(e.target.value); setPage(1); }} className="h-9 w-52" /></Campo>
          <Campo label="Vista">
            <Select value={vista} onValueChange={(v) => { setVista(v as Vista); setPage(1); }}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="detalle">Detalle</SelectItem>
                <SelectItem value="dia">Por día</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
          <Button variant="outline" onClick={() => cargar()} disabled={loading} className="h-9">{loading ? 'Cargando…' : 'Actualizar'}</Button>
          <Button variant="outline" onClick={exportar} className="h-9">Exportar XLSX</Button>
        </CardContent>
      </Card>

      {error && <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm">{error}</div>}

      {vista === 'detalle' && detalle && (
        <>
          <div className="text-xs text-muted-foreground">{detalle.total.toLocaleString('es-AR')} fichadas</div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha y hora</TableHead>
                  <TableHead>Legajo/ID</TableHead>
                  <TableHead>Persona</TableHead>
                  <TableHead>Reloj</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead>Origen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalle.items.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Sin fichadas en el período.</TableCell></TableRow>}
                {detalle.items.map((f) => (
                  <TableRow key={f.id} className={cn(f.sospechosa && 'bg-amber-500/10')}>
                    <TableCell className="tabular-nums">
                      {fechaHora(f.fechaHora)}
                      {f.sospechosa && <Badge variant="outline" className="ml-2 border-amber-500 text-amber-600">fecha dudosa</Badge>}
                    </TableCell>
                    <TableCell className="tabular-nums">{f.userId}</TableCell>
                    <TableCell className="font-medium">{f.nombre}</TableCell>
                    <TableCell>{f.reloj}</TableCell>
                    <TableCell>{tipoMarcaLabel(f.tipo)}</TableCell>
                    <TableCell className="text-muted-foreground">{modoMarcaLabel(f.modo)}</TableCell>
                    <TableCell><Badge variant="secondary">{f.origen}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <span className="text-sm text-muted-foreground">Página {page} de {totalPaginas}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPaginas} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
            </div>
          )}
        </>
      )}

      {vista === 'dia' && dias && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Legajo/ID</TableHead>
                <TableHead>Persona</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Salida</TableHead>
                <TableHead className="text-right">Marcas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dias.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Sin fichadas en el período.</TableCell></TableRow>}
              {dias.map((d) => (
                <TableRow key={`${d.userId}-${d.fecha}`}>
                  <TableCell className="tabular-nums">{d.fecha.split('-').reverse().join('/')}</TableCell>
                  <TableCell className="tabular-nums">{d.userId}</TableCell>
                  <TableCell className="font-medium">{d.nombre}</TableCell>
                  <TableCell className="tabular-nums">{d.entrada ? hora(d.entrada) : '—'}</TableCell>
                  <TableCell className="tabular-nums">{d.salida ? hora(d.salida) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.marcas}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
