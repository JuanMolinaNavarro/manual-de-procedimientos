'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FormData {
  nombre_empresa: string;
  ejecutivo_a_cargo: string;
  mail_comercial: string;
  telefono_comercial: string;
  mail_tecnico: string;
  telefono_tecnico: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  precio_tipo: string;
  precio_valor: string;
  subs_minimo_garantizado: string;
  reportar_subs: boolean;
  plazas_reportadas: string;
  condiciones_pago_contrato: string;
  condiciones_pago_acordadas: string;
  tnb_aplicada: string;
  tecnologias_autorizadas: string[];
}

export default function NuevoContratoCompradorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tecnologiaInput, setTecnologiaInput] = useState('');
  const [formData, setFormData] = useState<FormData>({
    nombre_empresa: '',
    ejecutivo_a_cargo: '',
    mail_comercial: '',
    telefono_comercial: '',
    mail_tecnico: '',
    telefono_tecnico: '',
    vigencia_desde: '',
    vigencia_hasta: '',
    precio_tipo: '',
    precio_valor: '',
    subs_minimo_garantizado: '',
    reportar_subs: false,
    plazas_reportadas: '',
    condiciones_pago_contrato: '',
    condiciones_pago_acordadas: '',
    tnb_aplicada: '',
    tecnologias_autorizadas: [],
  });

  const set = (field: keyof FormData, value: string | boolean | string[]) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const agregarTecnologia = () => {
    const tech = tecnologiaInput.trim();
    if (tech && !formData.tecnologias_autorizadas.includes(tech)) {
      set('tecnologias_autorizadas', [...formData.tecnologias_autorizadas, tech]);
    }
    setTecnologiaInput('');
  };

  const quitarTecnologia = (tech: string) =>
    set('tecnologias_autorizadas', formData.tecnologias_autorizadas.filter((t) => t !== tech));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre_empresa.trim()) {
      setError('El nombre de empresa es requerido.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const body = {
        ...formData,
        ejecutivo_a_cargo: formData.ejecutivo_a_cargo || null,
        mail_comercial: formData.mail_comercial || null,
        telefono_comercial: formData.telefono_comercial || null,
        mail_tecnico: formData.mail_tecnico || null,
        telefono_tecnico: formData.telefono_tecnico || null,
        vigencia_desde: formData.vigencia_desde || null,
        vigencia_hasta: formData.vigencia_hasta || null,
        precio_tipo: formData.precio_tipo || null,
        precio_valor: formData.precio_valor || null,
        subs_minimo_garantizado: formData.subs_minimo_garantizado || null,
        plazas_reportadas: formData.plazas_reportadas || null,
        condiciones_pago_contrato: formData.condiciones_pago_contrato || null,
        condiciones_pago_acordadas: formData.condiciones_pago_acordadas || null,
        tnb_aplicada: formData.tnb_aplicada || null,
      };
      const res = await fetch('/api/admin/senales-ip/compradores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Error al crear el contrato');
      }
      router.push('/admin/senales-ip/compradores');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.push('/admin/senales-ip/compradores')}>← Volver</Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Nuevo Contrato Comprador</h2>
          <p className="text-sm text-muted-foreground">Adquisición de derechos de señales IP</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 p-4 text-red-300">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Datos de la empresa</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nombre_empresa">Nombre de empresa *</Label>
              <Input id="nombre_empresa" value={formData.nombre_empresa} onChange={(e) => set('nombre_empresa', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ejecutivo_a_cargo">Ejecutivo a cargo</Label>
              <Input id="ejecutivo_a_cargo" value={formData.ejecutivo_a_cargo} onChange={(e) => set('ejecutivo_a_cargo', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contacto comercial</Label>
              <Input placeholder="Mail comercial" value={formData.mail_comercial} onChange={(e) => set('mail_comercial', e.target.value)} />
              <Input placeholder="Teléfono comercial" value={formData.telefono_comercial} onChange={(e) => set('telefono_comercial', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contacto técnico</Label>
              <Input placeholder="Mail técnico" value={formData.mail_tecnico} onChange={(e) => set('mail_tecnico', e.target.value)} />
              <Input placeholder="Teléfono técnico" value={formData.telefono_tecnico} onChange={(e) => set('telefono_tecnico', e.target.value)} />
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
              <Input id="precio_valor" value={formData.precio_valor} onChange={(e) => set('precio_valor', e.target.value)} placeholder="Ej: $1.50 por subs" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subs_minimo_garantizado">Subs. mínimo garantizado</Label>
              <Input id="subs_minimo_garantizado" value={formData.subs_minimo_garantizado} onChange={(e) => set('subs_minimo_garantizado', e.target.value)} />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                id="reportar_subs"
                checked={formData.reportar_subs}
                onCheckedChange={(v) => set('reportar_subs', v)}
              />
              <Label htmlFor="reportar_subs">Reportar suscriptores</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plazas_reportadas">Plazas reportadas</Label>
              <Input id="plazas_reportadas" value={formData.plazas_reportadas} onChange={(e) => set('plazas_reportadas', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tnb_aplicada">TNB aplicada</Label>
              <Input id="tnb_aplicada" value={formData.tnb_aplicada} onChange={(e) => set('tnb_aplicada', e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="condiciones_pago_contrato">Condiciones de pago (contrato firmado)</Label>
              <Textarea id="condiciones_pago_contrato" rows={3} value={formData.condiciones_pago_contrato} onChange={(e) => set('condiciones_pago_contrato', e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="condiciones_pago_acordadas">Condiciones de pago (acordadas comercialmente)</Label>
              <Textarea id="condiciones_pago_acordadas" rows={3} value={formData.condiciones_pago_acordadas} onChange={(e) => set('condiciones_pago_acordadas', e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Tecnologías autorizadas</Label>
              <div className="flex gap-2">
                <Input
                  value={tecnologiaInput}
                  onChange={(e) => setTecnologiaInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarTecnologia(); } }}
                  placeholder="Escribir y presionar Enter o Agregar"
                />
                <Button type="button" variant="outline" onClick={agregarTecnologia}>Agregar</Button>
              </div>
              {formData.tecnologias_autorizadas.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {formData.tecnologias_autorizadas.map((t) => (
                    <Badge key={t} variant="secondary" className="cursor-pointer gap-1" onClick={() => quitarTecnologia(t)}>
                      {t} ✕
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Crear contrato'}</Button>
          <Button type="button" variant="outline" onClick={() => router.push('/admin/senales-ip/compradores')}>Cancelar</Button>
        </div>
      </form>
    </div>
  );
}
