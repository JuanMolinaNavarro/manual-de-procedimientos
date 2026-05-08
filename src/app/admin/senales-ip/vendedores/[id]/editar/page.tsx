'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2 } from 'lucide-react';
import type { EquipoPorSenal } from '@/lib/senales-ip';

interface FormData {
  nombre_empresa: string;
  documentacion_empresa: string;
  ejecutivo_cargo: string;
  mail_comercial_cliente: string;
  telefono_comercial_cliente: string;
  mail_tecnico_cliente: string;
  telefono_tecnico_cliente: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  precio_tipo: string;
  precio_valor: string;
  grilla: string;
  subs_minimo_garantizado: string;
  subs_reportados_senales: string;
  plazas_incluidas_contrato: string;
  plazas_reportadas_senales: string;
  condiciones_pago: string;
  tnb_aplicada: string;
  forma_recepcion_entrega: string;
  equipos_por_senal: EquipoPorSenal[];
  condiciones_entrega_equipamiento: string;
  activa: boolean;
}

export default function EditarContratoVendedorPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [equipoInput, setEquipoInput] = useState<EquipoPorSenal>({ signal: '', equipment: '' });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<FormData>({
    nombre_empresa: '', documentacion_empresa: '', ejecutivo_cargo: '',
    mail_comercial_cliente: '', telefono_comercial_cliente: '',
    mail_tecnico_cliente: '', telefono_tecnico_cliente: '',
    vigencia_desde: '', vigencia_hasta: '', precio_tipo: '', precio_valor: '',
    grilla: '', subs_minimo_garantizado: '', subs_reportados_senales: '',
    plazas_incluidas_contrato: '', plazas_reportadas_senales: '',
    condiciones_pago: '', tnb_aplicada: '', forma_recepcion_entrega: '',
    equipos_por_senal: [], condiciones_entrega_equipamiento: '', activa: true,
  });

  useEffect(() => {
    setLogoUrl(`/api/admin/senales-ip/vendedores/${id}/logo?t=${Date.now()}`);
  }, [id]);

  useEffect(() => {
    fetch(`/api/admin/senales-ip/vendedores/${id}`)
      .then((r) => r.json())
      .then((c) => setFormData({
        nombre_empresa: c.nombre_empresa ?? '',
        documentacion_empresa: c.documentacion_empresa ?? '',
        ejecutivo_cargo: c.ejecutivo_cargo ?? '',
        mail_comercial_cliente: c.mail_comercial_cliente ?? '',
        telefono_comercial_cliente: c.telefono_comercial_cliente ?? '',
        mail_tecnico_cliente: c.mail_tecnico_cliente ?? '',
        telefono_tecnico_cliente: c.telefono_tecnico_cliente ?? '',
        vigencia_desde: c.vigencia_desde ?? '',
        vigencia_hasta: c.vigencia_hasta ?? '',
        precio_tipo: c.precio_tipo ?? '',
        precio_valor: c.precio_valor ?? '',
        grilla: c.grilla ?? '',
        subs_minimo_garantizado: c.subs_minimo_garantizado ?? '',
        subs_reportados_senales: c.subs_reportados_senales ?? '',
        plazas_incluidas_contrato: c.plazas_incluidas_contrato ?? '',
        plazas_reportadas_senales: c.plazas_reportadas_senales ?? '',
        condiciones_pago: c.condiciones_pago ?? '',
        tnb_aplicada: c.tnb_aplicada ?? '',
        forma_recepcion_entrega: c.forma_recepcion_entrega ?? '',
        equipos_por_senal: c.equipos_por_senal ?? [],
        condiciones_entrega_equipamiento: c.condiciones_entrega_equipamiento ?? '',
        activa: c.activa ?? true,
      }))
      .catch(() => setError('No se pudo cargar el contrato.'))
      .finally(() => setFetching(false));
  }, [id]);

  const set = (field: keyof FormData, value: string | boolean | EquipoPorSenal[]) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleLogoUpload = async (file: File) => {
    setLogoLoading(true);
    const fd = new FormData();
    fd.append('logo', file);
    const res = await fetch(`/api/admin/senales-ip/vendedores/${id}/logo`, { method: 'POST', body: fd });
    if (res.ok) setLogoUrl(`/api/admin/senales-ip/vendedores/${id}/logo?t=${Date.now()}`);
    setLogoLoading(false);
  };

  const handleLogoDelete = async () => {
    setLogoLoading(true);
    await fetch(`/api/admin/senales-ip/vendedores/${id}/logo`, { method: 'DELETE' });
    setLogoUrl(null);
    setLogoLoading(false);
  };

  const agregarEquipo = () => {
    if (equipoInput.signal.trim() && equipoInput.equipment.trim()) {
      set('equipos_por_senal', [...formData.equipos_por_senal, { ...equipoInput }]);
      setEquipoInput({ signal: '', equipment: '' });
    }
  };

  const quitarEquipo = (index: number) =>
    set('equipos_por_senal', formData.equipos_por_senal.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre_empresa.trim()) { setError('El nombre de empresa es requerido.'); return; }
    setLoading(true);
    setError('');
    try {
      const body = {
        ...formData,
        documentacion_empresa: formData.documentacion_empresa || null,
        ejecutivo_cargo: formData.ejecutivo_cargo || null,
        mail_comercial_cliente: formData.mail_comercial_cliente || null,
        telefono_comercial_cliente: formData.telefono_comercial_cliente || null,
        mail_tecnico_cliente: formData.mail_tecnico_cliente || null,
        telefono_tecnico_cliente: formData.telefono_tecnico_cliente || null,
        vigencia_desde: formData.vigencia_desde || null,
        vigencia_hasta: formData.vigencia_hasta || null,
        precio_tipo: formData.precio_tipo || null,
        precio_valor: formData.precio_valor || null,
        grilla: formData.grilla || null,
        subs_minimo_garantizado: formData.subs_minimo_garantizado || null,
        subs_reportados_senales: formData.subs_reportados_senales || null,
        plazas_incluidas_contrato: formData.plazas_incluidas_contrato || null,
        plazas_reportadas_senales: formData.plazas_reportadas_senales || null,
        condiciones_pago: formData.condiciones_pago || null,
        tnb_aplicada: formData.tnb_aplicada || null,
        forma_recepcion_entrega: formData.forma_recepcion_entrega || null,
        equipos_por_senal: formData.equipos_por_senal.length > 0 ? formData.equipos_por_senal : null,
        condiciones_entrega_equipamiento: formData.condiciones_entrega_equipamiento || null,
      };
      const res = await fetch(`/api/admin/senales-ip/vendedores/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Error al guardar'); }
      router.push(`/admin/senales-ip/vendedores/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="flex h-64 items-center justify-center text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.push(`/admin/senales-ip/vendedores/${id}`)}>← Volver</Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Editar Contrato Vendedor</h2>
          <p className="text-sm text-muted-foreground">#{id}</p>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-900/50 bg-red-950/30 p-4 text-red-300">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Datos de la empresa cliente</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nombre_empresa">Nombre de empresa *</Label>
              <Input id="nombre_empresa" value={formData.nombre_empresa} onChange={(e) => set('nombre_empresa', e.target.value)} required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="documentacion_empresa">Documentación (licencia, CUIT, etc.)</Label>
              <Textarea id="documentacion_empresa" rows={2} value={formData.documentacion_empresa} onChange={(e) => set('documentacion_empresa', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ejecutivo_cargo">Ejecutivo a cargo (Señales IP)</Label>
              <Input id="ejecutivo_cargo" value={formData.ejecutivo_cargo} onChange={(e) => set('ejecutivo_cargo', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contacto comercial del cliente</Label>
              <Input placeholder="Mail comercial" value={formData.mail_comercial_cliente} onChange={(e) => set('mail_comercial_cliente', e.target.value)} />
              <Input placeholder="Teléfono comercial" value={formData.telefono_comercial_cliente} onChange={(e) => set('telefono_comercial_cliente', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contacto técnico del cliente</Label>
              <Input placeholder="Mail técnico" value={formData.mail_tecnico_cliente} onChange={(e) => set('mail_tecnico_cliente', e.target.value)} />
              <Input placeholder="Teléfono técnico" value={formData.telefono_tecnico_cliente} onChange={(e) => set('telefono_tecnico_cliente', e.target.value)} />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch id="activa" checked={formData.activa} onCheckedChange={(v) => set('activa', v)} />
              <Label htmlFor="activa">Contrato activo</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Condiciones comerciales</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vigencia_desde">Vigencia desde</Label>
              <Input id="vigencia_desde" type="date" value={formData.vigencia_desde} onChange={(e) => set('vigencia_desde', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vigencia_hasta">Vigencia hasta</Label>
              <Input id="vigencia_hasta" type="date" value={formData.vigencia_hasta} onChange={(e) => set('vigencia_hasta', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="precio_tipo">Tipo de precio</Label>
              <select
                id="precio_tipo"
                value={formData.precio_tipo}
                onChange={(e) => set('precio_tipo', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Sin especificar</option>
                <option value="subs">Por suscriptores (subs)</option>
                <option value="fee">Fee fijo</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="precio_valor">Precio / valor</Label>
              <Input id="precio_valor" value={formData.precio_valor} onChange={(e) => set('precio_valor', e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="grilla">Grilla</Label>
              <Textarea id="grilla" rows={2} value={formData.grilla} onChange={(e) => set('grilla', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subs_minimo_garantizado">Subs. mínimo garantizado</Label>
              <Input id="subs_minimo_garantizado" value={formData.subs_minimo_garantizado} onChange={(e) => set('subs_minimo_garantizado', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subs_reportados_senales">Subs. reportados a las señales</Label>
              <Input id="subs_reportados_senales" value={formData.subs_reportados_senales} onChange={(e) => set('subs_reportados_senales', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plazas_incluidas_contrato">Plazas incluidas en el contrato</Label>
              <Input id="plazas_incluidas_contrato" value={formData.plazas_incluidas_contrato} onChange={(e) => set('plazas_incluidas_contrato', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plazas_reportadas_senales">Plazas reportadas a las señales</Label>
              <Input id="plazas_reportadas_senales" value={formData.plazas_reportadas_senales} onChange={(e) => set('plazas_reportadas_senales', e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="condiciones_pago">Condiciones de pago</Label>
              <Textarea id="condiciones_pago" rows={3} value={formData.condiciones_pago} onChange={(e) => set('condiciones_pago', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tnb_aplicada">TNB aplicada</Label>
              <Input id="tnb_aplicada" value={formData.tnb_aplicada} onChange={(e) => set('tnb_aplicada', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="forma_recepcion_entrega">Forma de recepción/entrega de señales</Label>
              <Input id="forma_recepcion_entrega" value={formData.forma_recepcion_entrega} onChange={(e) => set('forma_recepcion_entrega', e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="condiciones_entrega_equipamiento">Condiciones de entrega de equipamiento</Label>
              <Textarea id="condiciones_entrega_equipamiento" rows={2} value={formData.condiciones_entrega_equipamiento} onChange={(e) => set('condiciones_entrega_equipamiento', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Equipos por señal habilitados</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input placeholder="Señal (ej: ESPN)" value={equipoInput.signal} onChange={(e) => setEquipoInput((p) => ({ ...p, signal: e.target.value }))} />
              <div className="flex gap-2">
                <Input
                  placeholder="Equipo/modelo habilitado"
                  value={equipoInput.equipment}
                  onChange={(e) => setEquipoInput((p) => ({ ...p, equipment: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarEquipo(); } }}
                />
                <Button type="button" variant="outline" onClick={agregarEquipo}>Agregar</Button>
              </div>
            </div>
            {formData.equipos_por_senal.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-1 text-left text-muted-foreground">Señal</th>
                    <th className="py-1 text-left text-muted-foreground">Equipo</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.equipos_por_senal.map((eq, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1">{eq.signal}</td>
                      <td className="py-1">{eq.equipment}</td>
                      <td className="py-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => quitarEquipo(i)}>✕</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar cambios'}</Button>
          <Button type="button" variant="outline" onClick={() => router.push(`/admin/senales-ip/vendedores/${id}`)}>Cancelar</Button>
        </div>
      </form>

      <Card>
        <CardHeader><CardTitle>Logo de la empresa</CardTitle></CardHeader>
        <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-28 w-44 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo"
                className="max-h-full max-w-full object-contain p-2"
                onError={() => setLogoUrl(null)}
              />
            ) : (
              <Building2 className="h-12 w-12 text-muted-foreground/40" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={logoLoading}
              onClick={() => logoInputRef.current?.click()}
            >
              {logoLoading ? 'Subiendo...' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
            </Button>
            {logoUrl && (
              <Button type="button" variant="ghost" size="sm" disabled={logoLoading} onClick={handleLogoDelete}>
                Eliminar logo
              </Button>
            )}
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP, SVG o GIF.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
