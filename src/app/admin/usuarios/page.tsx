/**
 * Pagina para crear y listar usuarios del sitio.
 * Las credenciales se guardan en texto plano por requisito.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
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
import { isSuperadmin } from '@/lib/roles';

interface EmpleadoVinculado {
  id: number;
  nombre: string;
  area: string;
}

interface Usuario {
  id: number;
  usuario: string;
  password: string;
  nombre: string | null;
  apellido: string | null;
  rol: string;
  isActive: boolean;
  created_at: string;
  empleado_id: number | null;
  empleado: EmpleadoVinculado | null;
}

interface EmpleadoOpcion {
  id: number;
  nombre: string;
  area: string;
}

interface AreaOpcion {
  id: number;
  nombre: string;
}

const PAGE_SIZE = 10;
const SELECT_CLASS =
  'h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

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

  // Vinculo con el organigrama
  const [modoVinculo, setModoVinculo] = useState<'ninguno' | 'existente' | 'area'>('ninguno');
  const [empleadoId, setEmpleadoId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [empleados, setEmpleados] = useState<EmpleadoOpcion[]>([]);
  const [areas, setAreas] = useState<AreaOpcion[]>([]);

  const [esSuperadmin, setEsSuperadmin] = useState(false);

  // Busqueda + paginacion
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

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
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => setEsSuperadmin(isSuperadmin(me?.rol)))
      .catch(() => {});
    fetch('/api/admin/organigrama/empleados')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: EmpleadoOpcion[]) =>
        setEmpleados(data.map((e) => ({ id: e.id, nombre: e.nombre, area: e.area })))
      )
      .catch(() => {});
    fetch('/api/admin/organigrama/areas')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: AreaOpcion[]) => setAreas(data.map((a) => ({ id: a.id, nombre: a.nombre }))))
      .catch(() => {});
  }, []);

  // Fichas que todavia no tienen usuario vinculado.
  const empleadosLibres = useMemo(() => {
    const vinculados = new Set(usuarios.map((u) => u.empleado_id).filter(Boolean));
    return empleados.filter((e) => !vinculados.has(e.id));
  }, [empleados, usuarios]);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return usuarios;
    return usuarios.filter((u) =>
      [u.usuario, u.nombre ?? '', u.apellido ?? '']
        .some((v) => v.toLowerCase().includes(term))
    );
  }, [usuarios, q]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const visibles = filtrados.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  const rangeStart = filtrados.length === 0 ? 0 : (pageSafe - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(pageSafe * PAGE_SIZE, filtrados.length);

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

    if (modoVinculo === 'existente' && !empleadoId) {
      setError('Elegi la ficha del organigrama a vincular');
      return;
    }
    if (modoVinculo === 'area' && !areaId) {
      setError('Elegi el area donde crear la ficha');
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = { usuario, password, rol, nombre, apellido };
      if (modoVinculo === 'existente') body.empleado_id = Number(empleadoId);
      if (modoVinculo === 'area') body.area_id = Number(areaId);

      const response = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
      setModoVinculo('ninguno');
      setEmpleadoId('');
      setAreaId('');
      setPage(1);
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
                className={SELECT_CLASS}
              >
                <option value="agente">Agente</option>
                <option value="admin">Admin</option>
                {esSuperadmin && <option value="superadmin">Superadmin</option>}
              </select>
            </div>

            <div className="space-y-2 rounded-md border border-border p-3">
              <Label htmlFor="modo-vinculo">Organigrama</Label>
              <select
                id="modo-vinculo"
                value={modoVinculo}
                onChange={(event) => {
                  setModoVinculo(event.target.value as typeof modoVinculo);
                  setEmpleadoId('');
                  setAreaId('');
                }}
                className={SELECT_CLASS}
              >
                <option value="ninguno">Sin vincular</option>
                <option value="existente">Vincular a una ficha existente</option>
                <option value="area">Crear ficha nueva en un area</option>
              </select>

              {modoVinculo === 'existente' && (
                <select
                  aria-label="Ficha del organigrama"
                  value={empleadoId}
                  onChange={(event) => setEmpleadoId(event.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">Elegir ficha…</option>
                  {empleadosLibres.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre} — {e.area}
                    </option>
                  ))}
                </select>
              )}

              {modoVinculo === 'area' && (
                <>
                  <select
                    aria-label="Area"
                    value={areaId}
                    onChange={(event) => setAreaId(event.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="">Elegir area…</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Se crea una ficha nueva en el organigrama con el nombre y apellido del usuario.
                  </p>
                </>
              )}
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
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar por usuario, nombre o apellido…"
              className="pl-9"
            />
          </div>
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
                <TableHead>Área</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
                <TableHead>Creado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    {usuarios.length === 0 ? 'No hay usuarios creados.' : 'Sin resultados para la busqueda.'}
                  </TableCell>
                </TableRow>
              ) : (
                visibles.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.usuario}</TableCell>
                    <TableCell>{item.nombre ?? "-"}</TableCell>
                    <TableCell>{item.apellido ?? "-"}</TableCell>
                    <TableCell>{item.password}</TableCell>
                    <TableCell>{item.rol}</TableCell>
                    <TableCell>
                      {item.empleado ? (
                        item.empleado.area
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin vincular</span>
                      )}
                    </TableCell>
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
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <span>
              Mostrando {rangeStart}–{rangeEnd} de {filtrados.length} usuarios
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageSafe === 1}
              >
                Anterior
              </Button>
              <span className="text-foreground">
                Página {pageSafe} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageSafe === totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
