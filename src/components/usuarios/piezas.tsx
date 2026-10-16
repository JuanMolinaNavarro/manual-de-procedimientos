'use client';

/** Piezas compartidas por el alta y la edición de Gestión de Usuarios. */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { Rol } from '@/lib/roles';
import type { FichaOpcion } from '@/lib/fichas-busqueda';

export const ROLES_INFO: { valor: Rol; label: string; desc: string }[] = [
  { valor: 'admin', label: 'Admin', desc: 'Entra a los módulos que le habilites.' },
  { valor: 'empleado', label: 'Empleado', desc: 'Solo su portal: Mi asistencia, Mis recibos y Mis vacaciones.' },
  { valor: 'ventas', label: 'Ventas', desc: 'Solo Ventas y Padrón.' },
  { valor: 'superadmin', label: 'Superadmin', desc: 'Todo el panel, incluida Gestión de Usuarios.' },
];

export const rolLabel = (rol: string) => ROLES_INFO.find((r) => r.valor === rol)?.label ?? rol;

/** Las fichas para el FichaPicker (`null` mientras cargan). */
export function useFichas(): FichaOpcion[] | null {
  const [fichas, setFichas] = useState<FichaOpcion[] | null>(null);
  useEffect(() => {
    fetch('/api/admin/usuarios/fichas')
      .then((r) => (r.ok ? r.json() : []))
      .then(setFichas)
      .catch(() => setFichas([]));
  }, []);
  return fichas;
}

export function VolverAUsuarios() {
  return (
    <Link href="/admin/usuarios" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ChevronLeft className="h-4 w-4" aria-hidden />
      Gestión de Usuarios
    </Link>
  );
}

export function Seccion({ titulo, descripcion, accion, children }: { titulo: string; descripcion: string; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>{titulo}</CardTitle>
          <CardDescription>{descripcion}</CardDescription>
        </div>
        {accion}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

/** Opciones excluyentes como tarjetas con radio y descripción. */
export function OpcionesTarjeta<T extends string>({ nombre, opciones, valor, onCambio }: {
  nombre: string;
  opciones: { valor: T; label: string; desc: string }[];
  valor: T;
  onCambio: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={nombre} className={cn('grid gap-2.5', opciones.length % 2 === 0 ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
      {opciones.map((o) => (
        <label
          key={o.valor}
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
            valor === o.valor ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent',
          )}
        >
          <input type="radio" name={nombre} checked={valor === o.valor} onChange={() => onCambio(o.valor)} className="mt-0.5 h-4 w-4 accent-primary" />
          <span className="space-y-0.5">
            <span className="block font-semibold">{o.label}</span>
            <span className="block text-sm text-muted-foreground">{o.desc}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export interface DatosAcceso {
  usuario: string;
  password: string;
  nombre: string;
  apellido: string;
}

/** Usuario, contraseña, nombre y apellido. En la edición la contraseña vacía no se cambia. */
export function CamposAcceso({ datos, onCambio, edicion }: { datos: DatosAcceso; onCambio: (d: DatosAcceso) => void; edicion?: boolean }) {
  const campo = (k: keyof DatosAcceso) => ({
    id: k,
    value: datos[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onCambio({ ...datos, [k]: e.target.value }),
  });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="usuario">Usuario</Label>
        <Input {...campo('usuario')} placeholder="Ej: jperez" autoComplete="off" required />
        {!edicion && <p className="text-xs text-muted-foreground">Para el rol Empleado, usá el CUIL sin guiones.</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{edicion ? 'Nueva contraseña' : 'Contraseña'}</Label>
        <Input
          {...campo('password')}
          type="password"
          placeholder={edicion ? 'Vacía = no cambiarla' : 'Mínimo 8 caracteres'}
          autoComplete="new-password"
          minLength={8}
          required={!edicion}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre</Label>
        <Input {...campo('nombre')} placeholder="Ej: Juan" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="apellido">Apellido</Label>
        <Input {...campo('apellido')} placeholder="Ej: Pérez" />
      </div>
    </div>
  );
}

/** Pie fijo del formulario: error, Cancelar y Guardar. */
export function BarraGuardar({ guardando, texto, error }: { guardando: boolean; texto: string; error: string }) {
  return (
    <div className="sticky bottom-0 -mx-4 space-y-3 border-t border-border bg-background px-4 py-4 sm:-mx-6 sm:px-6">
      {error && (
        <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" asChild>
          <Link href="/admin/usuarios">Cancelar</Link>
        </Button>
        <Button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : texto}</Button>
      </div>
    </div>
  );
}
