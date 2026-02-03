/**
 * Pagina para editar un usuario existente.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface Usuario {
  id: number;
  usuario: string;
  password: string;
  nombre: string | null;
  apellido: string | null;
  rol: string;
  isActive: boolean;
}

export default function EditarUsuarioPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const usuarioId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<Usuario | null>(null);

  useEffect(() => {
    const loadUsuario = async () => {
      try {
        if (Number.isNaN(usuarioId)) {
          setError('ID invalido');
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/admin/usuarios/${usuarioId}`);
        if (!response.ok) {
          throw new Error('Error al cargar el usuario');
        }

        const data = (await response.json()) as Usuario;
        setFormData(data);
      } catch (err) {
        console.error(err);
        setError('No se pudo cargar el usuario');
      } finally {
        setLoading(false);
      }
    };

    loadUsuario();
  }, [usuarioId]);

  const handleChange = (field: keyof Usuario, value: string | boolean) => {
    setFormData((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData) return;

    setError('');
    setSaving(true);

    try {
      const response = await fetch(`/api/admin/usuarios/${usuarioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: formData.usuario,
          password: formData.password,
          nombre: formData.nombre || null,
          apellido: formData.apellido || null,
          rol: formData.rol,
          isActive: formData.isActive,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al actualizar el usuario');
      }

      router.push('/admin/usuarios');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Cargando...
      </div>
    );
  }

  if (error || !formData) {
    return (
      <div className="rounded-md border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">
        {error || 'No se pudo cargar la informacion'}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Editar usuario</CardTitle>
          <CardDescription>Modifica los datos y guarda los cambios</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="usuario">Usuario</Label>
              <Input
                id="usuario"
                value={formData.usuario}
                onChange={(event) => handleChange('usuario', event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contrasena</Label>
              <Input
                id="password"
                value={formData.password}
                onChange={(event) => handleChange('password', event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={formData.nombre ?? ''}
                onChange={(event) => handleChange('nombre', event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apellido">Apellido</Label>
              <Input
                id="apellido"
                value={formData.apellido ?? ''}
                onChange={(event) => handleChange('apellido', event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rol">Rol</Label>
              <select
                id="rol"
                value={formData.rol}
                onChange={(event) => handleChange('rol', event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="agente">Agente</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <p className="font-medium">Usuario activo</p>
                <p className="text-sm text-muted-foreground">
                  Puede iniciar sesion en el manual
                </p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(value) => handleChange('isActive', value)}
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="flex gap-4 pt-2">
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
