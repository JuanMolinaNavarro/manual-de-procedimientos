/**
 * Página para crear nueva bonificación
 *
 * Formulario simple con labels claros para usuarios no técnicos.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function NuevaBonificacionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    tipo: 'A' as 'A' | 'B',
    titulo: '',
    descripcion: '',
    condiciones: '',
    vigencia_desde: '',
    vigencia_hasta: '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/bonificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          vigencia_desde: formData.vigencia_desde || null,
          vigencia_hasta: formData.vigencia_hasta || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al crear la bonificación');
      }

      router.push('/admin/bonificaciones');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Nueva bonificación</CardTitle>
          <CardDescription>
            Complete los datos para crear una nueva bonificación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de bonificación</Label>
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="tipo"
                    value="A"
                    checked={formData.tipo === 'A'}
                    onChange={(event) => handleChange('tipo', event.target.value)}
                    className="h-4 w-4"
                  />
                  <span>Tipo A</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="tipo"
                    value="B"
                    checked={formData.tipo === 'B'}
                    onChange={(event) => handleChange('tipo', event.target.value)}
                    className="h-4 w-4"
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
                value={formData.descripcion}
                onChange={(event) => handleChange('descripcion', event.target.value)}
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

            {error && (
              <div className="rounded-md border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Guardando...' : 'Crear bonificación'}
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
