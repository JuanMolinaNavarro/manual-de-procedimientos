'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ContratoComprador, ContratoVendedor } from '@/lib/senales-ip';

export default function NuevoSaltoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [compradores, setCompradores] = useState<ContratoComprador[]>([]);
  const [vendedores, setVendedores] = useState<ContratoVendedor[]>([]);

  const initialComprador = searchParams.get('comprador') ?? '';
  const initialVendedor = searchParams.get('vendedor') ?? '';

  const [formData, setFormData] = useState({
    descripcion: '',
    fecha_efectiva: '',
    dias_aviso_previo: '30',
    nuevo_precio: '',
    contrato_comprador_id: initialComprador,
    contrato_vendedor_id: initialVendedor,
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/senales-ip/compradores').then((r) => r.ok ? r.json() : []),
      fetch('/api/admin/senales-ip/vendedores').then((r) => r.ok ? r.json() : []),
    ]).then(([c, v]) => { setCompradores(c); setVendedores(v); });
  }, []);

  const set = (field: keyof typeof formData, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.descripcion.trim() || !formData.fecha_efectiva) {
      setError('Descripción y fecha efectiva son requeridas.');
      return;
    }
    if (!formData.contrato_comprador_id && !formData.contrato_vendedor_id) {
      setError('Debe seleccionar un contrato comprador o vendedor.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const body = {
        descripcion: formData.descripcion,
        fecha_efectiva: formData.fecha_efectiva,
        dias_aviso_previo: Number(formData.dias_aviso_previo) || 30,
        nuevo_precio: formData.nuevo_precio || null,
        contrato_comprador_id: formData.contrato_comprador_id ? Number(formData.contrato_comprador_id) : null,
        contrato_vendedor_id: formData.contrato_vendedor_id ? Number(formData.contrato_vendedor_id) : null,
      };
      const res = await fetch('/api/admin/senales-ip/saltos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Error al crear'); }
      router.push('/admin/senales-ip/saltos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.push('/admin/senales-ip/saltos')}>← Volver</Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Nuevo salto de precio</h2>
          <p className="text-sm text-muted-foreground">Configurar alerta para un cambio de precio en un contrato</p>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-900/50 bg-red-950/30 p-4 text-red-300">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Contrato asociado</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contrato_comprador_id">Contrato Comprador</Label>
              <select
                id="contrato_comprador_id"
                value={formData.contrato_comprador_id}
                onChange={(e) => { set('contrato_comprador_id', e.target.value); if (e.target.value) set('contrato_vendedor_id', ''); }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Sin seleccionar</option>
                {compradores.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.nombre_empresa} (#{c.id})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contrato_vendedor_id">Contrato Vendedor</Label>
              <select
                id="contrato_vendedor_id"
                value={formData.contrato_vendedor_id}
                onChange={(e) => { set('contrato_vendedor_id', e.target.value); if (e.target.value) set('contrato_comprador_id', ''); }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Sin seleccionar</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={String(v.id)}>{v.nombre_empresa} (#{v.id})</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Detalle del salto</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="descripcion">Descripción *</Label>
              <Input
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => set('descripcion', e.target.value)}
                placeholder="Ej: Salto de precio al período 6 — nuevo importe según cláusula 3.2"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha_efectiva">Fecha efectiva *</Label>
              <Input id="fecha_efectiva" type="date" value={formData.fecha_efectiva} onChange={(e) => set('fecha_efectiva', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nuevo_precio">Nuevo precio</Label>
              <Input id="nuevo_precio" value={formData.nuevo_precio} onChange={(e) => set('nuevo_precio', e.target.value)} placeholder="Ej: $2.00 por subs" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dias_aviso_previo">Días de aviso previo</Label>
              <Input
                id="dias_aviso_previo"
                type="number"
                min="1"
                max="365"
                value={formData.dias_aviso_previo}
                onChange={(e) => set('dias_aviso_previo', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                La alerta se mostrará este número de días antes de la fecha efectiva.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Crear salto'}</Button>
          <Button type="button" variant="outline" onClick={() => router.push('/admin/senales-ip/saltos')}>Cancelar</Button>
        </div>
      </form>
    </div>
  );
}
