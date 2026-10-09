'use client';

/**
 * Alta (sin `id`) y edición (con `id`) de una bonificación. Formulario simple con labels claros
 * para usuarios no técnicos.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { apiFetch, mensajeError } from '@/components/comunes/api';
import { EMPRESAS } from '@/lib/empresas';
import { vaciosANull } from '@/lib/utils';

interface Datos {
  empresa: string;
  titulo: string;
  descripcion: string;
  mensaje_sugerido: string;
  condiciones: string;
  activa: boolean;
  vigencia_desde: string;
  vigencia_hasta: string;
}

type Bonificacion = { id: number } & { [K in keyof Datos]: Datos[K] | null };

const VACIO: Datos = {
  empresa: EMPRESAS[0], titulo: '', descripcion: '', mensaje_sugerido: '', condiciones: '',
  activa: true, vigencia_desde: '', vigencia_hasta: '',
};

export default function FormularioBonificacion({ id }: { id?: number }) {
  const router = useRouter();
  const [formData, setFormData] = useState<Datos | null>(id ? null : VACIO);
  const [errorCarga, setErrorCarga] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    // No hay GET por id: se busca en la lista completa (también inactivas).
    apiFetch<Bonificacion[]>('/api/bonificaciones?all=true')
      .then((lista) => {
        const b = lista.find((item) => item.id === id);
        if (!b) return setErrorCarga('No se encontró la bonificación');
        setFormData({
          empresa: b.empresa ?? VACIO.empresa,
          titulo: b.titulo ?? '',
          descripcion: b.descripcion ?? '',
          mensaje_sugerido: b.mensaje_sugerido ?? '',
          condiciones: b.condiciones ?? '',
          activa: b.activa ?? true,
          vigencia_desde: b.vigencia_desde ?? '',
          vigencia_hasta: b.vigencia_hasta ?? '',
        });
      })
      .catch(() => setErrorCarga('No se pudo cargar la bonificación'));
  }, [id]);

  const handleChange = (field: keyof Datos, value: string | boolean) =>
    setFormData((prev) => (prev ? { ...prev, [field]: value } : prev));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData) return;
    setError('');
    setSaving(true);
    // Un alta nace activa: el switch solo existe al editar.
    const { activa, ...resto } = formData;
    const body = vaciosANull(id ? { ...resto, activa } : resto);
    try {
      await apiFetch(id ? `/api/bonificaciones/${id}` : '/api/bonificaciones', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      });
      router.push('/admin/bonificaciones');
    } catch (err) {
      setError(mensajeError(err, id ? 'Error al actualizar la bonificación' : 'Error al crear la bonificación'));
      setSaving(false);
    }
  };

  if (errorCarga) {
    return <div className="rounded-md border border-red-900/60 bg-red-950/30 p-4 text-red-500">{errorCarga}</div>;
  }
  if (!formData) return <div className="flex h-64 items-center justify-center text-muted-foreground">Cargando...</div>;

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{id ? 'Editar bonificación' : 'Nueva bonificación'}</CardTitle>
          <CardDescription>
            {id ? 'Modifique los datos y guarde los cambios' : 'Complete los datos para crear una nueva bonificación'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa</Label>
              <select
                id="empresa"
                value={formData.empresa}
                onChange={(event) => handleChange('empresa', event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {EMPRESAS.map((empresa) => (
                  <option key={empresa} value={empresa}>{empresa}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="titulo">Nombre de la bonificación *</Label>
              <Input
                id="titulo"
                placeholder="Ej: Descuento por permanencia"
                value={formData.titulo}
                onChange={(event) => handleChange('titulo', event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                placeholder="Describa brevemente en qué consiste esta bonificación"
                value={formData.descripcion}
                onChange={(event) => handleChange('descripcion', event.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mensaje_sugerido">Mensaje sugerido (opcional)</Label>
              <Textarea
                id="mensaje_sugerido"
                placeholder="Ej: Esta bonificacion aplica en el proximo ciclo."
                value={formData.mensaje_sugerido}
                onChange={(event) => handleChange('mensaje_sugerido', event.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="condiciones">Condiciones de aplicación</Label>
              <Textarea
                id="condiciones"
                placeholder="¿Cuándo se puede ofrecer esta bonificación?"
                value={formData.condiciones}
                onChange={(event) => handleChange('condiciones', event.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vigencia_desde">Disponible desde</Label>
                <Input
                  id="vigencia_desde"
                  type="date"
                  value={formData.vigencia_desde}
                  onChange={(event) => handleChange('vigencia_desde', event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Dejar vacío para sin límite</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vigencia_hasta">Disponible hasta</Label>
                <Input
                  id="vigencia_hasta"
                  type="date"
                  value={formData.vigencia_hasta}
                  onChange={(event) => handleChange('vigencia_hasta', event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Dejar vacío para sin límite</p>
              </div>
            </div>

            {id && (
              <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                <div>
                  <p className="font-medium">Bonificación activa</p>
                  <p className="text-sm text-muted-foreground">Visible en el manual de retención</p>
                </div>
                <Switch checked={formData.activa} onCheckedChange={(value) => handleChange('activa', value)} />
              </div>
            )}

            {error && (
              <div className="rounded-md border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">{error}</div>
            )}

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : id ? 'Guardar cambios' : 'Crear bonificación'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
