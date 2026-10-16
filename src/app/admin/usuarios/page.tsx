/**
 * Gestión de Usuarios: lista con búsqueda, filtros por rol y estado, y acceso al alta y la edición.
 * Las contraseñas se guardan hasheadas (PBKDF2) y nunca se devuelven: solo se asignan.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, Paginacion } from '@/components/comunes/ui';
import { Chip } from '@/components/asistencia/piezas';
import { ROLES_INFO, rolLabel, useFichas } from '@/components/usuarios/piezas';
import { usePaginaLocal } from '@/hooks/usePaginaLocal';
import { coincide } from '@/lib/utils';

interface Usuario {
  id: number;
  usuario: string;
  nombre: string | null;
  apellido: string | null;
  rol: string;
  isActive: boolean;
  created_at: string;
  empleado_id: number | null;
  empleado: { id: number; nombre: string; area: string } | null;
}

const PAGE_SIZE = 10;
const TODOS = 'todos';

const ESTADOS: { clave: string; label: string; filtro: (u: Usuario) => boolean }[] = [
  { clave: 'todos', label: 'Todos', filtro: () => true },
  { clave: 'activos', label: 'Activos', filtro: (u) => u.isActive },
  { clave: 'inactivos', label: 'Inactivos', filtro: (u) => !u.isActive },
  { clave: 'sin-ficha', label: 'Sin ficha', filtro: (u) => u.empleado_id == null },
];

const nombreCompleto = (u: Usuario) => [u.nombre, u.apellido].filter(Boolean).join(' ') || u.usuario;

export default function UsuariosAdminPage() {
  // `null` mientras carga.
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [rol, setRol] = useState(TODOS);
  const [estado, setEstado] = useState('todos');
  const fichas = useFichas();
  const lugarDe = useMemo(() => new Map((fichas ?? []).map((f) => [f.id, f.lugar])), [fichas]);

  const cargar = () =>
    fetch('/api/admin/usuarios')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setUsuarios)
      .catch(() => setError('No se pudieron cargar los usuarios.'));

  useEffect(() => {
    cargar();
  }, []);

  const base = useMemo(
    () => (usuarios ?? []).filter((u) => (rol === TODOS || u.rol === rol) && coincide(q, u.usuario, nombreCompleto(u), u.empleado?.area)),
    [usuarios, q, rol],
  );
  const filtroEstado = ESTADOS.find((e) => e.clave === estado)!.filtro;
  const filtrados = base.filter(filtroEstado);
  // Buscar, filtrar o que se dé de alta/baja a alguien vuelve a la página 1.
  const pag = usePaginaLocal(filtrados, `${q.trim()}|${rol}|${estado}|${usuarios?.length}`, PAGE_SIZE);

  async function toggleActivo(u: Usuario) {
    await fetch(`/api/admin/usuarios/${u.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !u.isActive }),
    }).catch(() => {});
    cargar();
  }

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <h1 className="text-2xl font-bold text-foreground">Gestión de Usuarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">Quién entra al panel, con qué rol y a qué ficha del organigrama corresponde cada cuenta.</p>
        </div>
        <Button asChild>
          <Link href="/admin/usuarios/nuevo"><Plus className="h-4 w-4" /> Nuevo usuario</Link>
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <Card className="gap-0 overflow-hidden py-0">
        <div className="space-y-3 border-b border-border px-5 py-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-0 flex-[1_1_280px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                aria-label="Buscar usuario"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre, usuario o área…"
                className="pl-9"
              />
            </div>
            <Select value={rol} onValueChange={setRol}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Rol"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos los roles</SelectItem>
                {ROLES_INFO.map((r) => <SelectItem key={r.valor} value={r.valor}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
            {ESTADOS.map((e) => (
              <Chip key={e.clave} activo={estado === e.clave} onClick={() => setEstado(e.clave)}>
                {e.label} <span className="font-mono opacity-75">{base.filter(e.filtro).length}</span>
              </Chip>
            ))}
          </div>
        </div>

        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Persona</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Ficha del organigrama</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Alta</TableHead>
              <TableHead className="pr-5"><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pag.visibles.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="pl-5">
                  <div className="flex items-center gap-3">
                    <Avatar nombre={nombreCompleto(u)} className="h-9 w-9 text-xs" />
                    <div className="min-w-0">
                      <p className="font-medium">{nombreCompleto(u)}</p>
                      <p className="font-mono text-xs text-muted-foreground">{u.usuario}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={u.rol === 'superadmin' ? 'default' : 'outline'}>{rolLabel(u.rol)}</Badge>
                </TableCell>
                <TableCell>
                  {u.empleado ? (
                    <div>
                      <p>{u.empleado.area || 'Sin área'}</p>
                      <p className="text-xs text-muted-foreground">{lugarDe.get(u.empleado.id)}</p>
                    </div>
                  ) : (
                    <Badge variant="outline" className="border-dashed text-muted-foreground">Sin vincular</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={u.isActive}
                      onCheckedChange={() => toggleActivo(u)}
                      aria-label={`${u.isActive ? 'Desactivar' : 'Activar'} a ${nombreCompleto(u)}`}
                    />
                    <span className={u.isActive ? undefined : 'text-muted-foreground'}>{u.isActive ? 'Activo' : 'Inactivo'}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString('es-AR')}
                </TableCell>
                <TableCell className="pr-5 text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/usuarios/${u.id}/editar`} aria-label={`Editar a ${nombreCompleto(u)}`}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filtrados.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="font-medium">{!usuarios ? 'Cargando…' : usuarios.length === 0 ? 'Todavía no hay usuarios' : 'Nadie coincide con la búsqueda'}</p>
            {!!usuarios?.length && <p className="text-sm text-muted-foreground">Probá con el apellido, el usuario o el área, o quitá los filtros.</p>}
          </div>
        )}

        <div className="border-t border-border px-5 py-3">
          <Paginacion {...pag} unidad="usuarios" />
        </div>
      </Card>
    </div>
  );
}
