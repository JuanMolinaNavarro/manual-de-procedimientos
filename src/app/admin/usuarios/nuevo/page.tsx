'use client';

/**
 * Alta de usuario. La contraseña se guarda hasheada y nunca se devuelve. La ficha del
 * organigrama se elige con el buscador, se crea en un área o se deja sin vincular.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FichaPicker from '@/components/usuarios/FichaPicker';
import {
  BarraGuardar, CamposAcceso, OpcionesTarjeta, ROLES_INFO, Seccion, VolverAUsuarios, useFichas, type DatosAcceso,
} from '@/components/usuarios/piezas';
import type { Rol } from '@/lib/roles';

type Vinculo = 'existente' | 'nuevo' | 'ninguno';

const VINCULOS: { valor: Vinculo; label: string; desc: string }[] = [
  { valor: 'existente', label: 'Vincular a una ficha', desc: 'La persona ya está en el organigrama.' },
  { valor: 'nuevo', label: 'Crear ficha nueva', desc: 'Todavía no figura en ningún lugar.' },
  { valor: 'ninguno', label: 'Sin vincular', desc: 'Cuenta de servicio o de prueba.' },
];

interface Opcion { id: number; nombre: string }
interface AreaOpcion extends Opcion { organigrama_id: number | null }

export default function NuevoUsuarioPage() {
  const router = useRouter();
  const fichas = useFichas();
  const [acceso, setAcceso] = useState<DatosAcceso>({ usuario: '', password: '', nombre: '', apellido: '' });
  const [rol, setRol] = useState<Rol>('empleado');
  const [vinculo, setVinculo] = useState<Vinculo>('existente');
  const [fichaId, setFichaId] = useState<number | null>(null);
  const [lugarId, setLugarId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [lugares, setLugares] = useState<Opcion[]>([]);
  const [areas, setAreas] = useState<AreaOpcion[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/organigrama/organigramas').then((r) => (r.ok ? r.json() : [])).then(setLugares).catch(() => {});
    fetch('/api/admin/organigrama/areas').then((r) => (r.ok ? r.json() : [])).then(setAreas).catch(() => {});
  }, []);

  const areasDelLugar = areas.filter((a) => !lugarId || a.organigrama_id === Number(lugarId));

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (vinculo === 'existente' && fichaId == null) return setError('Elegí la ficha del organigrama a vincular.');
    if (vinculo === 'nuevo' && !areaId) return setError('Elegí el área donde crear la ficha.');

    setGuardando(true);
    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...acceso,
          rol,
          ...(vinculo === 'existente' && { empleado_id: fichaId }),
          ...(vinculo === 'nuevo' && { area_id: Number(areaId) }),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'No se pudo crear el usuario');
      router.push('/admin/usuarios');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="mx-auto flex max-w-[760px] flex-col gap-5">
      <VolverAUsuarios />
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nuevo usuario</h1>
        <p className="mt-1 text-sm text-muted-foreground">La contraseña se guarda cifrada: después no se puede ver, solo asignar una nueva.</p>
      </div>

      <Seccion titulo="Acceso" descripcion="Con esto inicia sesión.">
        <CamposAcceso datos={acceso} onCambio={setAcceso} />
      </Seccion>

      <Seccion titulo="Rol" descripcion="Define qué partes del panel puede usar.">
        <OpcionesTarjeta nombre="Rol" opciones={ROLES_INFO} valor={rol} onCambio={setRol} />
      </Seccion>

      <Seccion titulo="Ficha del organigrama" descripcion="Ata la cuenta a una persona: sin ficha no ve Mi asistencia, Mis recibos ni Mis vacaciones.">
        <OpcionesTarjeta nombre="Vínculo con el organigrama" opciones={VINCULOS} valor={vinculo} onCambio={setVinculo} />

        {vinculo === 'existente' && (
          <div className="border-t border-border pt-4">
            {fichas ? (
              <FichaPicker fichas={fichas} valor={fichaId} onCambio={setFichaId} />
            ) : (
              <p className="text-sm text-muted-foreground">Cargando fichas…</p>
            )}
          </div>
        )}

        {vinculo === 'nuevo' && (
          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lugar">Lugar</Label>
              <Select value={lugarId} onValueChange={(v) => { setLugarId(v); setAreaId(''); }}>
                <SelectTrigger id="lugar" className="w-full"><SelectValue placeholder="Todos los lugares" /></SelectTrigger>
                <SelectContent>
                  {lugares.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="area">Área</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger id="area" className="w-full"><SelectValue placeholder="Elegir área…" /></SelectTrigger>
                <SelectContent>
                  {areasDelLugar.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground sm:col-span-2">
              La ficha se crea con el nombre y apellido de arriba. El puesto y el resto de los datos se completan después en el organigrama.
            </p>
          </div>
        )}
      </Seccion>

      <BarraGuardar guardando={guardando} texto="Crear usuario" error={error} />
    </form>
  );
}
