/**
 * Pagina para crear y listar usuarios del sitio.
 * Las credenciales se guardan en texto plano por requisito.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Usuario {
  id: number;
  usuario: string;
  password: string;
  nombre: string | null;
  apellido: string | null;
  rol: string;
  isActive: boolean;
  created_at: string;
}

export default function UsuariosAdminPage() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [rol, setRol] = useState('agente');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchUsuarios = async () => {
    try {
      const response = await fetch('/api/admin/usuarios');
      if (!response.ok) {
        throw new Error('No se pudieron cargar los usuarios');
      }
      const data = await response.json();
      setUsuarios(data);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los usuarios');
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const toggleActivo = async (id: number, isActive: boolean) => {
    try {
      await fetch(`/api/admin/usuarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      fetchUsuarios();
    } catch (err) {
      console.error('Error al actualizar estado:', err);
    }
  };

  const editarUsuario = (id: number) => {
    router.push(`/admin/usuarios/${id}/editar`);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password, rol, nombre, apellido }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'No se pudo crear el usuario');
      }

      setUsuario('');
      setPassword('');
      setNombre('');
      setApellido('');
      setRol('agente');
      fetchUsuarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Crear usuario</CardTitle>
          <CardDescription>
            Las credenciales se guardan en texto plano por requisito.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="usuario">Usuario</Label>
              <Input
                id="usuario"
                value={usuario}
                onChange={(event) => setUsuario(event.target.value)}
                placeholder="Ej: agente01"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contrasena</Label>
              <Input
                id="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Ej: clave123"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                placeholder="Ej: Juan"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apellido">Apellido</Label>
              <Input
                id="apellido"
                value={apellido}
                onChange={(event) => setApellido(event.target.value)}
                placeholder="Ej: Perez"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rol">Rol</Label>
              <select
                id="rol"
                value={rol}
                onChange={(event) => setRol(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="agente">Agente</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {error && (
              <div className="rounded-md border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Crear usuario'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios existentes</CardTitle>
          <CardDescription>Listado de usuarios registrados</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Apellido</TableHead>
                <TableHead>Contrasena</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
                <TableHead>Creado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No hay usuarios creados.
                  </TableCell>
                </TableRow>
              ) : (
                usuarios.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.usuario}</TableCell>
                    <TableCell>{item.nombre ?? "-"}</TableCell>
                    <TableCell>{item.apellido ?? "-"}</TableCell>
                    <TableCell>{item.password}</TableCell>
                    <TableCell>{item.rol}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={item.isActive}
                          onCheckedChange={() => toggleActivo(item.id, item.isActive)}
                        />
                        <span className="text-xs text-muted-foreground">{item.isActive ? "Activo" : "Inactivo"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => editarUsuario(item.id)}>
                        Editar
                      </Button>
                    </TableCell>
                    <TableCell>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString('es-AR') : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
