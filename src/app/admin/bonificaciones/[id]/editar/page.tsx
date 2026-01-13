/**
 * Página para editar una bonificación existente
 *
 * Formulario simple con labels claros para usuarios no técnicos.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

interface Bonificacion {
  id: number;
  tipo: 'A' | 'B';
  titulo: string;
  descripcion: string | null;
  condiciones: string | null;
  activa: boolean;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
}

export default function EditarBonificacionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const bonificacionId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<Bonificacion | null>(null);

  const handleChange = (field: keyof Bonificacion, value: string | boolean) => {
    setFormData((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  useEffect(() => {
    const loadBonificacion = async () => {
      try {
        if (Number.isNaN(bonificacionId)) {
          setError('ID inválido');
          setLoading(false);
          return;
        }

        const response = await fetch('/api/bonificaciones?all=true');
        if (!response.ok) {
          throw new Error('Error al cargar la bonificación');
        }

        const data = (await response.json()) as Bonificacion[];
        const bonificacion = data.find((item) => item.id === bonificacionId);

        if (!bonificacion) {
          setError('No se encontró la bonificación');
          setLoading(false);
          return;
        }

        setFormData({
          ...bonificacion,
          descripcion: bonificacion.descripcion ?? '',
          condiciones: bonificacion.condiciones ?? '',
          vigencia_desde: bonificacion.vigencia_desde ?? '',
          vigencia_hasta: bonificacion.vigencia_hasta ?? '',
        });
      } catch (err) {
        console.error(err);
        setError('No se pudo cargar la bonificación');
      } finally {
        setLoading(false);
      }
    };

    loadBonificacion();
  }, [bonificacionId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData) return;

    setError('');
    setSaving(true);

    try {
      const response = await fetch(`/api/bonificaciones/${bonificacionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: formData.tipo,
          titulo: formData.titulo,
          descripcion: formData.descripcion || null,
          condiciones: formData.condiciones || null,
          activa: formData.activa,
          vigencia_desde: formData.vigencia_desde || null,
          vigencia_hasta: formData.vigencia_hasta || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al actualizar la bonificación');
      }

      router.push('/admin/bonificaciones');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-muted-foreground">
        Cargando...
      </div>
    );
  }

  if (error || !formData) {
    return (
      <div className="p-4 text-red-500 bg-red-950/30 border border-red-900/60 rounded-md">
        {error || 'No se pudo cargar la información'}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Editar bonificación</CardTitle>
          <CardDescription>
            Modifique los datos y guarde los cambios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de bonificación</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tipo"
                    value="A"
                    checked={formData.tipo === 'A'}
                    onChange={(event) => handleChange('tipo', event.target.value)}
                    className="w-4 h-4"
                  />
                  <span>Tipo A</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tipo"
                    value="B"
                    checked={formData.tipo === 'B'}
                    onChange={(event) => handleChange('tipo', event.target.value)}
                    className="w-4 h-4"
                  />
                  <span>Tipo B</span>
                </label>
              </div>
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
                value={formData.descripcion ?? ''}
                onChange={(event) => handleChange('descripcion', event.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="condiciones">Condiciones de aplicación</Label>
              <Textarea
                id="condiciones"
                placeholder="¿Cuándo se puede ofrecer esta bonificación?"
                value={formData.condiciones ?? ''}
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
                  value={formData.vigencia_desde ?? ''}
                  onChange={(event) => handleChange('vigencia_desde', event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Dejar vacío para sin límite</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vigencia_hasta">Disponible hasta</Label>
                <Input
                  id="vigencia_hasta"
                  type="date"
                  value={formData.vigencia_hasta ?? ''}
                  onChange={(event) => handleChange('vigencia_hasta', event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Dejar vacío para sin límite</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <p className="font-medium">Bonificación activa</p>
                <p className="text-sm text-muted-foreground">
                  Visible para agentes en el manual
                </p>
              </div>
              <Switch
                checked={formData.activa}
                onCheckedChange={(value) => handleChange('activa', value)}
              />
            </div>

            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-950/30 border border-red-900/60 rounded-md">
                {error}
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
