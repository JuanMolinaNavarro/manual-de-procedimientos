'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CONCEPTO_CALCULOS, CONCEPTO_TIPOS, EMPRESA_CAMPOS, METRICAS, METRICA_META, PARAM_KEYS, PARAM_META,
  type Bono, type Concepto, type EmpresaKey, type ParamKey,
} from '@/lib/nomina-datos';
import type { Config } from '@/lib/nomina';
import { mensajeError, nominaFetch } from './api';
import { useNomina, useNominaData } from './NominaContext';
import { useLocal } from './useLocal';
import { Banner, Estado, PageTitle } from './ui';

export default function ParametrosPage() {
  const { organigramaId, listo, refrescar } = useNomina();
  const q = organigramaId != null ? `organigramaId=${organigramaId}` : null;
  const config = useNominaData<Config>(q ? `/api/admin/nomina/config?${q}` : null);
  const conceptos = useNominaData<Concepto[]>(q ? `/api/admin/nomina/conceptos?${q}` : null);
  const bonos = useNominaData<{ bonos: Bono[]; areas: string[] }>(q ? `/api/admin/nomina/bonos?${q}` : null);

  const [cfg, setCfg] = useLocal(config.data);
  const [concs, setConcs] = useLocal(conceptos.data);
  const [bns, setBns] = useLocal(bonos.data);
  const [confirmar, setConfirmar] = useState<{ titulo: string; desc: string; onOk: () => Promise<void> } | null>(null);

  const estado = <Estado loading={config.loading} error={config.error} sinOrg={listo && organigramaId == null} />;
  if (!cfg || organigramaId == null) return <><PageTitle title="Parámetros del motor" />{estado}</>;

  async function guardarEmpresa(k: EmpresaKey, v: string) {
    if (config.data?.empresa[k] === v) return;
    try {
      const r = await nominaFetch<Config>('/api/admin/nomina/config', { method: 'PUT', body: JSON.stringify({ organigramaId, empresa: { [k]: v } }) });
      setCfg(r); toast.success('Datos del empleador actualizados'); refrescar();
    } catch (e) { toast.error(mensajeError(e)); }
  }
  async function guardarParam(k: ParamKey, v: string) {
    const n = Number(v);
    if (!Number.isFinite(n) || config.data?.params[k] === n) return;
    try {
      const r = await nominaFetch<Config>('/api/admin/nomina/config', { method: 'PUT', body: JSON.stringify({ organigramaId, params: { [k]: n } }) });
      setCfg(r); toast.success('Parámetro actualizado');
    } catch (e) { toast.error(mensajeError(e)); }
  }
  async function restaurar() {
    try {
      const r = await nominaFetch<Config>('/api/admin/nomina/config', { method: 'PUT', body: JSON.stringify({ organigramaId, resetParams: true }) });
      setCfg(r); toast.success('Parámetros restaurados');
    } catch (e) { toast.error(mensajeError(e)); }
  }

  // ── Conceptos ──
  async function addConcepto() {
    try {
      const c = await nominaFetch<Concepto>('/api/admin/nomina/conceptos', { method: 'POST', body: JSON.stringify({ organigramaId }) });
      setConcs((l) => [...(l ?? []), c]);
    } catch (e) { toast.error(mensajeError(e)); }
  }
  async function setConcepto(id: number, patch: Partial<Concepto>) {
    setConcs((l) => (l ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c)));
    try {
      const c = await nominaFetch<Concepto>(`/api/admin/nomina/conceptos/${id}`, { method: 'PUT', body: JSON.stringify({ organigramaId, ...patch }) });
      setConcs((l) => (l ?? []).map((x) => (x.id === id ? c : x)));
    } catch (e) { toast.error(mensajeError(e)); conceptos.reload(); }
  }
  async function delConcepto(c: Concepto) {
    try {
      await nominaFetch(`/api/admin/nomina/conceptos/${c.id}?organigramaId=${organigramaId}`, { method: 'DELETE' });
      setConcs((l) => (l ?? []).filter((x) => x.id !== c.id));
    } catch (e) { toast.error(mensajeError(e)); }
  }

  // ── Bonos ──
  async function addBono() {
    try {
      const b = await nominaFetch<Bono>('/api/admin/nomina/bonos', { method: 'POST', body: JSON.stringify({ organigramaId }) });
      setBns((d) => d ? { ...d, bonos: [...d.bonos, b] } : d);
    } catch (e) { toast.error(mensajeError(e)); }
  }
  async function setBono(id: number, patch: Partial<Bono>) {
    setBns((d) => d ? { ...d, bonos: d.bonos.map((b) => (b.id === id ? { ...b, ...patch } : b)) } : d);
    try {
      const b = await nominaFetch<Bono>(`/api/admin/nomina/bonos/${id}`, { method: 'PUT', body: JSON.stringify({ organigramaId, ...patch }) });
      setBns((d) => d ? { ...d, bonos: d.bonos.map((x) => (x.id === id ? b : x)) } : d);
    } catch (e) { toast.error(mensajeError(e)); bonos.reload(); }
  }
  async function delBono(b: Bono) {
    try {
      await nominaFetch(`/api/admin/nomina/bonos/${b.id}?organigramaId=${organigramaId}`, { method: 'DELETE' });
      setBns((d) => d ? { ...d, bonos: d.bonos.filter((x) => x.id !== b.id) } : d);
    } catch (e) { toast.error(mensajeError(e)); }
  }

  const areas = bns?.areas ?? [];

  return (
    <div className="space-y-6">
      <PageTitle
        title="Parámetros del motor"
        sub={<>Como todavía no definimos el proceso con quien liquida, <b>todo es modificable</b>. Los cierres guardan una copia de los parámetros usados, así que cambiarlos no altera períodos ya cerrados.</>}
      />
      <Banner><b>Importante:</b> los valores por defecto son los habituales del régimen general argentino, pero las alícuotas y escalas cambian seguido. Validá siempre los porcentajes con el contador antes de cerrar un período real.</Banner>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Datos del empleador <Badge className="bg-violet-600 text-white hover:bg-violet-600">Recibo · sección 1</Badge></CardTitle>
          <p className="text-sm text-muted-foreground">Obligatorios en el recibo (art. 140 inc. a y d, y art. 12 del Decreto-Ley 17.250/67). El último depósito de aportes se actualiza mes a mes.</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EMPRESA_CAMPOS.map(([k, label, desc]) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={`emp-${k}`}>{label}</Label>
              <Input
                id={`emp-${k}`}
                type={k === 'ultimoDepositoFecha' ? 'date' : 'text'}
                value={cfg.empresa[k]}
                onChange={(e) => setCfg({ ...cfg, empresa: { ...cfg.empresa, [k]: e.target.value } })}
                onBlur={(e) => guardarEmpresa(k, e.target.value.trim())}
              />
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Porcentajes y reglas generales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PARAM_KEYS.map((k) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={`p-${k}`}>{PARAM_META[k][0]}</Label>
                <Input
                  id={`p-${k}`}
                  type="number"
                  step="0.01"
                  value={cfg.params[k]}
                  onChange={(e) => setCfg({ ...cfg, params: { ...cfg.params, [k]: e.target.value === '' ? ('' as unknown as number) : Number(e.target.value) } })}
                  onBlur={(e) => guardarParam(k, e.target.value)}
                  className="tabular-nums"
                />
                <p className="text-xs text-muted-foreground">{PARAM_META[k][1]}</p>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={() => setConfirmar({ titulo: 'Restaurar parámetros', desc: '¿Restaurar todos los parámetros a los valores por defecto del régimen general? Los datos del empleador no se tocan.', onOk: restaurar })}>
            <RotateCcw className="mr-1 h-4 w-4" /> Restaurar valores por defecto
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conceptos adicionales</CardTitle>
          <p className="text-sm text-muted-foreground">Conceptos propios de tu empresa (premios fijos, viáticos, descuentos de comedor, etc.). Los activos se aplican a TODOS los empleados incluidos; lo individual va por Novedades.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">Activo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cálculo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(concs ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-center"><Checkbox checked={c.activo} onCheckedChange={(v) => setConcepto(c.id, { activo: v === true })} aria-label="Activo" /></TableCell>
                    <TableCell><Input value={c.nombre} onChange={(e) => setConcs((l) => (l ?? []).map((x) => (x.id === c.id ? { ...x, nombre: e.target.value } : x)))} onBlur={(e) => e.target.value !== conceptos.data?.find((x) => x.id === c.id)?.nombre && setConcepto(c.id, { nombre: e.target.value })} className="min-w-44" /></TableCell>
                    <TableCell>
                      <Select value={c.tipo} onValueChange={(v) => setConcepto(c.id, { tipo: v as Concepto['tipo'] })}>
                        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                        <SelectContent>{CONCEPTO_TIPOS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={c.calculo} onValueChange={(v) => setConcepto(c.id, { calculo: v as Concepto['calculo'] })}>
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>{CONCEPTO_CALCULOS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input type="number" step="0.01" value={c.valor} onChange={(e) => setConcs((l) => (l ?? []).map((x) => (x.id === c.id ? { ...x, valor: Number(e.target.value) } : x)))} onBlur={(e) => Number(e.target.value) !== conceptos.data?.find((x) => x.id === c.id)?.valor && setConcepto(c.id, { valor: Number(e.target.value) })} className="w-28 text-right tabular-nums" /></TableCell>
                    <TableCell><Button variant="ghost" size="icon" aria-label="Eliminar" onClick={() => setConfirmar({ titulo: 'Eliminar concepto', desc: `¿Eliminar el concepto "${c.nombre}"?`, onOk: () => delConcepto(c) })}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
                {!concs?.length && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Sin conceptos adicionales.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          <Button variant="secondary" onClick={addConcepto}><Plus className="mr-1 h-4 w-4" /> Nuevo concepto</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Bonos y reconocimientos <Badge className="bg-violet-600 text-white hover:bg-violet-600">Gamification</Badge></CardTitle>
          <p className="text-sm text-muted-foreground">Catálogo del sistema de reconocimientos del Tablero. <b>Ámbito «Toda la empresa»</b> = bono común; <b>un área específica</b> = bono exclusivo de esa área (las áreas llegan del organigrama). Si cargás un <b>premio $</b>, al otorgar el bono ese monto se suma como premio en las novedades del ganador; con $ 0 es honorífico.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">Activo</TableHead>
                  <TableHead>Nombre del bono</TableHead>
                  <TableHead>Ámbito</TableHead>
                  <TableHead>Métrica</TableHead>
                  <TableHead className="text-right">Premio $</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(bns?.bonos ?? []).map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="text-center"><Checkbox checked={b.activo} onCheckedChange={(v) => setBono(b.id, { activo: v === true })} aria-label="Activo" /></TableCell>
                    <TableCell><Input value={b.nombre} onChange={(e) => setBns((d) => d ? { ...d, bonos: d.bonos.map((x) => (x.id === b.id ? { ...x, nombre: e.target.value } : x)) } : d)} onBlur={(e) => e.target.value !== bonos.data?.bonos.find((x) => x.id === b.id)?.nombre && setBono(b.id, { nombre: e.target.value })} className="min-w-44" /></TableCell>
                    <TableCell>
                      <Select value={b.ambito} onValueChange={(v) => setBono(b.id, { ambito: v })}>
                        <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="empresa">Toda la empresa</SelectItem>
                          {areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                          {b.ambito !== 'empresa' && !areas.includes(b.ambito) && <SelectItem value={b.ambito}>{b.ambito}</SelectItem>}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={b.metrica} onValueChange={(v) => setBono(b.id, { metrica: v as Bono['metrica'] })}>
                        <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                        <SelectContent>{METRICAS.map((m) => <SelectItem key={m} value={m}>{METRICA_META[m][0]}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input type="number" min={0} step={1000} value={b.monto || ''} placeholder="0" onChange={(e) => setBns((d) => d ? { ...d, bonos: d.bonos.map((x) => (x.id === b.id ? { ...x, monto: Number(e.target.value) } : x)) } : d)} onBlur={(e) => Number(e.target.value) !== bonos.data?.bonos.find((x) => x.id === b.id)?.monto && setBono(b.id, { monto: Number(e.target.value) })} className="w-32 text-right tabular-nums" /></TableCell>
                    <TableCell><Button variant="ghost" size="icon" aria-label="Eliminar" onClick={() => setConfirmar({ titulo: 'Eliminar bono', desc: `¿Eliminar el bono "${b.nombre}"? El historial de otorgamientos pasados se conserva.`, onOk: () => delBono(b) })}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
                {!bns?.bonos.length && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Sin bonos.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          <Button variant="secondary" onClick={addBono}><Plus className="mr-1 h-4 w-4" /> Nuevo bono</Button>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmar?.titulo}</AlertDialogTitle>
            <AlertDialogDescription>{confirmar?.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const f = confirmar?.onOk; setConfirmar(null); f?.(); }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
