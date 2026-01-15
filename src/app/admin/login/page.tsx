/**
 * Página de Login Admin
 *
 * Formulario simple para autenticación de administradores.
 * Pensado para usuarios no técnicos.
 */

'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const rawFrom = searchParams.get('from') || '/admin/bonificaciones';
  const from = rawFrom === '/admin/salir' ? '/admin/bonificaciones' : rawFrom;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al iniciar sesión');
        setLoading(false);
        return;
      }

      router.push(from);
      router.refresh();
    } catch {
      setError('Error de conexión. Intente nuevamente.');
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-center text-2xl font-bold">
          Panel de administración
        </CardTitle>
        <CardDescription className="text-center">
          Ingrese su contraseña para acceder
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="Ingrese la contraseña"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Suspense
        fallback={
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-center text-2xl font-bold">
                Panel de administración
              </CardTitle>
              <CardDescription className="text-center">
                Cargando...
              </CardDescription>
            </CardHeader>
          </Card>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
