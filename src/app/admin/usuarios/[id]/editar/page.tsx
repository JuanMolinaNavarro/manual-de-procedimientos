'use client';

/**
 * Edición de un usuario: acceso, rol, ficha del organigrama, módulos (solo admin) y estado.
 * Contraseña vacía = no cambiarla. Cambiar usuario, contraseña, rol o estado cierra sus sesiones.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar } from '@/components/comunes/ui';
import { CATEGORIAS } from '@/components/AdminHomeModulos';
import FichaPicker from '@/components/usuarios/FichaPicker';
import {
  BarraGuardar, CamposAcceso, OpcionesTarjeta, ROLES_INFO, Seccion, VolverAUsuarios, rolLabel, useFichas, type DatosAcceso,
} from '@/components/usuarios/piezas';
import { ADMIN_MODULOS, NOMINA_SLUGS, type AdminModuloSlug } from '@/lib/modulos';
import type { Rol } from '@/lib/roles';

interface Usuario {
  id: number;
  usuario: string;
  nombre: string | null;
  apellido: string | null;
  rol: Rol;
  isActive: boolean;
  modulos: string[];
  modulos_edit: string[];
  empleado_id: number | null;
  created_at: string;
}

/** Los módulos que se le pueden habilitar a un admin, agrupados como en el inicio. Sin `usuarios`: es solo del superadmin. */
const GRUPOS_MODULOS: { titulo: string; slugs: AdminModuloSlug[] }[] = [
  ...CATEGORIAS.map((c) => ({ titulo: c.titulo, slugs: c.slugs.filter((s) => s !== 'usuarios') })),
  { titulo: 'Nómina', slugs: [...NOMINA_SLUGS] },
];
const SLUGS_ADMIN = GRUPOS_MODULOS.flatMap((g) => g.slugs);
const LABEL_MODULO = new Map<string, string>(ADMIN_MODULOS.map((m) => [m.slug, m.label]));

export default function EditarUsuarioPage() {
  const router = useRouter();
  const usuarioId = Number(useParams<{ id: string }>().id);
  const fichas = useFichas();

  const [original, setOriginal] = useState<Usuario | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [acceso, setAcceso] = useState<DatosAcceso>({ usuario: '', password: '', nombre: '', apellido: '' });
  const [rol, setRol] = useState<Rol>('admin');
  const [activo, setActivo] = useState(true);
  const [fichaId, setFichaId] = useState<number | null>(null);
  // `modulos` vacío = todos. Restringir arranca con lo guardado.
  const [restringido, setRestringido] = useState(false);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [editaOrg, setEditaOrg] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/admin/usuarios/${usuarioId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((u: Usuario) => {
        setOriginal(u);
        setAcceso({ usuario: u.usuario, password: '', nombre: u.nombre ?? '', apellido: u.apellido ?? '' });
        setRol(u.rol);
        setActivo(u.isActive);
        setFichaId(u.empleado_id);
        setRestringido(u.modulos.length > 0);
        setElegidos(new Set(u.modulos.length ? u.modulos : SLUGS_ADMIN));
        setEditaOrg(u.modulos_edit.includes('organigrama'));
      })
      .catch(() => setErrorCarga('No se pudo cargar el usuario.'));
  }, [usuarioId]);

  function marcar(slugs: string[], si: boolean) {
    setElegidos((prev) => {
      const next = new Set(prev);
      for (const s of slugs) {
        if (si) next.add(s);
        else next.delete(s);
      }
      return next;
    });
  }

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    if (!original) return;
    setError('');
    const esAdmin = rol === 'admin';
    const marcados = SLUGS_ADMIN.filter((s) => elegidos.has(s));
    // `[]` significaría "todos": restringir a nada no se puede guardar.
    if (esAdmin && restringido && marcados.length === 0) return setError('Marcá al menos un módulo o apagá «Restringir».');

    setGuardando(true);
    try {
      const res = await fetch(`/api/admin/usuarios/${usuarioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: acceso.usuario,
          password: acceso.password,
          nombre: acceso.nombre || null,
          apellido: acceso.apellido || null,
          rol,
          isActive: activo,
          modulos: esAdmin && restringido && marcados.length < SLUGS_ADMIN.length ? marcados : [],
          // Se conservan los demás permisos de edición; acá solo se maneja el del organigrama.
          modulos_edit: [...original.modulos_edit.filter((s) => s !== 'organigrama'), ...(esAdmin && editaOrg ? ['organigrama'] : [])],
          empleado_id: fichaId,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'No se pudo guardar el usuario');
      router.push('/admin/usuarios');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setGuardando(false);
    }
  }

  if (errorCarga) return <p role="alert" className="mx-auto max-w-[760px] text-sm text-destructive">{errorCarga}</p>;
  if (!original) return <p className="mx-auto max-w-[760px] py-16 text-center text-muted-foreground">Cargando…</p>;

  const nombre = [original.nombre, original.apellido].filter(Boolean).join(' ') || original.usuario;
  const cantidadElegidos = SLUGS_ADMIN.filter((s) => elegidos.has(s)).length;

  return (
    <form onSubmit={guardar} className="mx-auto flex max-w-[760px] flex-col gap-5">
      <VolverAUsuarios />
      <div className="flex flex-wrap items-center gap-4">
        <Avatar nombre={nombre} className="h-14 w-14 text-lg" />
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-bold text-foreground">{nombre}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono">{original.usuario}</span>
            <Badge variant={original.rol === 'superadmin' ? 'default' : 'outline'}>{rolLabel(original.rol)}</Badge>
            <span>{original.isActive ? 'Activo' : 'Inactivo'}</span>
            <span>· alta {new Date(original.created_at).toLocaleDateString('es-AR')}</span>
          </div>
        </div>
      </div>

      <Seccion titulo="Acceso" descripcion="Cambiar el usuario o la contraseña cierra sus sesiones abiertas.">
        <CamposAcceso datos={acceso} onCambio={setAcceso} edicion />
      </Seccion>

      <Seccion titulo="Rol" descripcion="Define qué partes del panel puede usar.">
        <OpcionesTarjeta nombre="Rol" opciones={ROLES_INFO} valor={rol} onCambio={setRol} />
      </Seccion>

      <Seccion titulo="Ficha del organigrama" descripcion="La persona que usa esta cuenta. Define su área y qué ve en su portal.">
        {fichas ? (
          <FichaPicker fichas={fichas} valor={fichaId} onCambio={setFichaId} usuarioId={usuarioId} />
        ) : (
          <p className="text-sm text-muted-foreground">Cargando fichas…</p>
        )}
      </Seccion>

      {rol === 'superadmin' && (
        <p className="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">
          Acceso total: ve todos los módulos, edita el organigrama y gestiona usuarios.
        </p>
      )}

      {rol === 'admin' && (
        <Seccion
          titulo="Módulos"
          descripcion={restringido ? `Ve ${cantidadElegidos} de ${SLUGS_ADMIN.length} módulos.` : 'Ve todos los módulos, también los que se agreguen.'}
          accion={
            <div className="flex shrink-0 items-center gap-2">
              <Label htmlFor="restringir">Restringir</Label>
              <Switch id="restringir" checked={restringido} onCheckedChange={setRestringido} />
            </div>
          }
        >
          {restringido && GRUPOS_MODULOS.map((g) => {
            const marcadosGrupo = g.slugs.filter((s) => elegidos.has(s)).length;
            const todos = marcadosGrupo === g.slugs.length;
            return (
              <div key={g.titulo} role="group" aria-label={g.titulo} className="space-y-2">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-1.5">
                  <span className="text-sm font-medium">
                    {g.titulo} <span className="font-mono font-normal text-muted-foreground">{marcadosGrupo}/{g.slugs.length}</span>
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => marcar(g.slugs, !todos)}>
                    {todos ? 'Quitar todos' : 'Marcar todos'}
                  </Button>
                </div>
                <div className="grid gap-x-4 gap-y-1 sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
                  {g.slugs.map((s) => (
                    <div key={s} className="flex min-h-8 items-center gap-2.5">
                      <Checkbox id={`modulo-${s}`} checked={elegidos.has(s)} onCheckedChange={(v) => marcar([s], v === true)} />
                      <Label htmlFor={`modulo-${s}`} className="cursor-pointer font-normal">{LABEL_MODULO.get(s)}</Label>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <div>
              <Label htmlFor="edita-org">Puede editar el organigrama</Label>
              <p className="text-sm text-muted-foreground">Apagado, solo lo ve: sin editar y sin el convenio.</p>
            </div>
            <Switch id="edita-org" checked={editaOrg} onCheckedChange={setEditaOrg} />
          </div>
        </Seccion>
      )}

      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="activo">Usuario activo</Label>
            <p className="text-sm text-muted-foreground">Inactivo no puede iniciar sesión. No se borra nada.</p>
          </div>
          <Switch id="activo" checked={activo} onCheckedChange={setActivo} />
        </CardContent>
      </Card>

      <BarraGuardar guardando={guardando} texto="Guardar cambios" error={error} />
    </form>
  );
}
