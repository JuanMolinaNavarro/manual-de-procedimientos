'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { asistFetch, mensajeError, type Reloj, type ResultadoSync } from './api';

export default function RelojesTab() {
  const [relojes, setRelojes] = useState<Reloj[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | 'todos' | null>(null);
  const [nuevo, setNuevo] = useState({ nombre: '', ip: '', device_id: '' });
  const [importando, setImportando] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await asistFetch<{ relojes: Reloj[] }>('/api/admin/asistencia/relojes');
      setRelojes(r.relojes);
    } catch (e) {
      setError(mensajeError(e));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const patch = async (id: number, data: Partial<Reloj>) => {
    setRelojes((rs) => (rs ?? []).map((r) => (r.id === id ? { ...r, ...data } : r)));
    try {
      await asistFetch(`/api/admin/asistencia/relojes/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    } catch (e) {
      toast.error(mensajeError(e));
      cargar();
    }
  };

  const probar = async (id: number) => {
    setBusy(id);
    try {
      const r = await asistFetch<{ firmware: string | null; contadores: { registrosTotales: number; usuarios: number; registrosNuevos: number } }>(
        `/api/admin/asistencia/relojes/${id}/probar`,
        { method: 'POST' },
      );
      toast.success(`Conexión OK · ${r.contadores.usuarios} usuarios · ${r.contadores.registrosTotales} registros (${r.contadores.registrosNuevos} nuevos)`);
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setBusy(null);
    }
  };

  const sync = async (id: number, modo: 'nuevos' | 'todos') => {
    setBusy(id);
    try {
      const { resultado } = await asistFetch<{ resultado: ResultadoSync }>(`/api/admin/asistencia/relojes/${id}/sync`, { method: 'POST', body: JSON.stringify({ modo }) });
      if (resultado.error) toast.error(`${resultado.nombre}: ${resultado.error}`);
      else toast.success(`${resultado.nombre}: ${resultado.guardados} fichadas nuevas (de ${resultado.bajados} bajadas)`);
      cargar();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setBusy(null);
    }
  };

  const syncTodos = async () => {
    setBusy('todos');
    try {
      const { resultados } = await asistFetch<{ resultados: ResultadoSync[] }>('/api/admin/asistencia/sync', { method: 'POST', body: JSON.stringify({ modo: 'nuevos' }) });
      const guardados = resultados.reduce((a, r) => a + r.guardados, 0);
      const err = resultados.filter((r) => r.error).length;
      toast.success(`${guardados} fichadas nuevas` + (err ? `, ${err} reloj(es) con error` : ''));
      cargar();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setBusy(null);
    }
  };

  const crear = async () => {
    if (!nuevo.nombre || !nuevo.ip || !nuevo.device_id) {
      toast.error('Completá nombre, IP y device_id.');
      return;
    }
    try {
      await asistFetch('/api/admin/asistencia/relojes', { method: 'POST', body: JSON.stringify({ ...nuevo, device_id: Number(nuevo.device_id) }) });
      setNuevo({ nombre: '', ip: '', device_id: '' });
      toast.success('Reloj agregado.');
      cargar();
    } catch (e) {
      toast.error(mensajeError(e));
    }
  };

  const borrar = async (id: number, nombre: string) => {
    if (!confirm(`¿Borrar el reloj "${nombre}" y sus fichadas?`)) return;
    try {
      await asistFetch(`/api/admin/asistencia/relojes/${id}`, { method: 'DELETE' });
      toast.success('Reloj borrado.');
      cargar();
    } catch (e) {
      toast.error(mensajeError(e));
    }
  };

  const importar = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error('Elegí un archivo .mdb.');
      return;
    }
    setImportando(true);
    setImportMsg(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const r = await asistFetch<{ relojes: number; personas: number; fichadas: number; fichadasNuevas: number }>('/api/admin/asistencia/importar-mdb', { method: 'POST', body });
      setImportMsg(`Importado: ${r.fichadasNuevas.toLocaleString('es-AR')} fichadas nuevas (de ${r.fichadas.toLocaleString('es-AR')}), ${r.personas} personas, ${r.relojes} relojes.`);
      if (fileRef.current) fileRef.current.value = '';
      cargar();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setImportando(false);
    }
  };

  const fmtFecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }) : '—');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={syncTodos} disabled={busy != null}>{busy === 'todos' ? 'Sincronizando…' : 'Sincronizar todos (nuevos)'}</Button>
        <span className="text-sm text-muted-foreground">Se sincronizan solos cada 10 minutos.</span>
      </div>

      {error && <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm">{error}</div>}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Último sync</TableHead>
              <TableHead className="text-right">Registros</TableHead>
              <TableHead className="text-center">Activo</TableHead>
              <TableHead className="text-center">Limpiar nuevos</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {relojes == null && <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Cargando…</TableCell></TableRow>}
            {relojes?.length === 0 && <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Sin relojes. Agregá uno abajo o importá la base de CrossChex.</TableCell></TableRow>}
            {relojes?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="tabular-nums">{r.device_id}</TableCell>
                <TableCell className="font-medium">{r.nombre}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{r.ip}:{r.puerto}</TableCell>
                <TableCell>
                  {r.ultimo_error
                    ? <Badge variant="outline" className="border-red-500 text-red-600" title={r.ultimo_error}>error</Badge>
                    : r.ultimo_sync ? <Badge variant="outline" className="border-emerald-500 text-emerald-600">ok</Badge> : <Badge variant="secondary">sin sync</Badge>}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{fmtFecha(r.ultimo_sync)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.reg_total?.toLocaleString('es-AR') ?? '—'}{r.reg_nuevos ? <span className="ml-1 text-amber-600">(+{r.reg_nuevos})</span> : null}</TableCell>
                <TableCell className="text-center"><Switch checked={r.activo} onCheckedChange={(v) => patch(r.id, { activo: v })} /></TableCell>
                <TableCell className="text-center"><Switch checked={r.limpiar_nuevos} onCheckedChange={(v) => patch(r.id, { limpiar_nuevos: v })} /></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="sm" disabled={busy != null} onClick={() => probar(r.id)}>Probar</Button>
                    <Button variant="outline" size="sm" disabled={busy != null} onClick={() => sync(r.id, 'nuevos')}>Sync</Button>
                    <Button variant="outline" size="sm" disabled={busy != null} onClick={() => sync(r.id, 'todos')} title="Descarga completa (todos los registros del reloj)">Todo</Button>
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => borrar(r.id, r.nombre)}>✕</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Agregar reloj</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nombre</span><Input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} className="h-9 w-40" /></label>
            <label className="flex flex-col gap-1"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">IP</span><Input value={nuevo.ip} placeholder="192.168.0.10" onChange={(e) => setNuevo({ ...nuevo, ip: e.target.value })} className="h-9 w-36" /></label>
            <label className="flex flex-col gap-1"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Device ID</span><Input type="number" value={nuevo.device_id} onChange={(e) => setNuevo({ ...nuevo, device_id: e.target.value })} className="h-9 w-24" /></label>
            <Button onClick={crear} className="h-9">Agregar</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Importar base de CrossChex (.mdb)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Respaldo/histórico: sube el <code>.mdb</code> de CrossChex y carga sus fichadas. No pisa las ya guardadas (deduplica).</p>
            <div className="flex flex-wrap items-center gap-3">
              <Input ref={fileRef} type="file" accept=".mdb,.accdb" className="h-9 w-64" />
              <Button variant="outline" onClick={importar} disabled={importando} className="h-9">{importando ? 'Importando…' : 'Importar'}</Button>
            </div>
            {importMsg && <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">{importMsg}</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
