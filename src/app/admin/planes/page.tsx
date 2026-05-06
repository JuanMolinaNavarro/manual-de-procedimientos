'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EMPRESAS } from '@/lib/empresas';
import type { Plan, PlanConfigData } from '@/lib/planes';

const DEFAULT_PLAN: Plan = {
  name: '',
  subtitle: 'Solo internet',
  price: 0,
  highlighted: false,
  badge: null,
};

export default function PlanesPage() {
  const [empresa, setEmpresa] = useState<string>(EMPRESAS[0]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tvAddonPrice, setTvAddonPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchPlans = useCallback(async (selectedEmpresa: string) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/admin/planes?empresa=${encodeURIComponent(selectedEmpresa)}`);
      if (!res.ok) throw new Error('Error al cargar los planes');
      const data = (await res.json()) as PlanConfigData;
      setPlans(data.plans);
      setTvAddonPrice(data.tvAddonPrice);
    } catch (err) {
      setError('No se pudieron cargar los planes');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans(empresa);
  }, [empresa, fetchPlans]);

  const handleEmpresaChange = (value: string) => {
    setEmpresa(value);
  };

  const updatePlan = (index: number, field: keyof Plan, value: string | number | boolean | null) => {
    setPlans((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const addPlan = () => {
    setPlans((prev) => [...prev, { ...DEFAULT_PLAN }]);
  };

  const removePlan = (index: number) => {
    setPlans((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/admin/planes?empresa=${encodeURIComponent(empresa)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans, tvAddonPrice }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar');
      }
      setSuccess('Planes guardados correctamente');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Planes de servicio</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Administre los planes y precios mostrados en el sitio web
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || loading}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>

      <div className="max-w-xs space-y-2">
        <Label htmlFor="empresa">Empresa</Label>
        <select
          id="empresa"
          value={empresa}
          onChange={(e) => handleEmpresaChange(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {EMPRESAS.map((emp) => (
            <option key={emp} value={emp}>
              {emp}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 p-4 text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md border border-green-900/50 bg-green-950/30 p-4 text-green-300">
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          Cargando...
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Planes de internet</CardTitle>
              <CardDescription>
                Los planes se muestran en el orden en que aparecen en esta lista
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {plans.map((plan, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Plan {index + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePlan(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      Eliminar
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor={`name-${index}`}>Nombre</Label>
                      <Input
                        id={`name-${index}`}
                        placeholder="Ej: Fibra 100 MB"
                        value={plan.name}
                        onChange={(e) => updatePlan(index, 'name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`subtitle-${index}`}>Subtítulo</Label>
                      <Input
                        id={`subtitle-${index}`}
                        placeholder="Ej: Solo internet"
                        value={plan.subtitle}
                        onChange={(e) => updatePlan(index, 'subtitle', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`price-${index}`}>Precio (ARS sin IVA)</Label>
                      <Input
                        id={`price-${index}`}
                        type="number"
                        min={0}
                        placeholder="Ej: 12999"
                        value={plan.price}
                        onChange={(e) => updatePlan(index, 'price', Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`badge-${index}`}>Badge (opcional)</Label>
                      <Input
                        id={`badge-${index}`}
                        placeholder="Ej: ¡El más elegido!"
                        value={plan.badge ?? ''}
                        onChange={(e) =>
                          updatePlan(index, 'badge', e.target.value || null)
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      checked={plan.highlighted}
                      onCheckedChange={(val) => updatePlan(index, 'highlighted', val)}
                    />
                    <span className="text-sm text-muted-foreground">Destacado</span>
                  </div>
                </div>
              ))}

              <Button variant="outline" onClick={addPlan} className="w-full">
                + Agregar plan
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Complemento de TV</CardTitle>
              <CardDescription>
                Precio adicional por agregar el paquete de televisión a cualquier plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-xs space-y-1">
                <Label htmlFor="tvAddon">Precio TV (ARS)</Label>
                <Input
                  id="tvAddon"
                  type="number"
                  min={0}
                  placeholder="Ej: 18000"
                  value={tvAddonPrice}
                  onChange={(e) => setTvAddonPrice(Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
