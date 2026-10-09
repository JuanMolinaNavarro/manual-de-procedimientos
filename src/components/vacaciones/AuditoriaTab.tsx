'use client';

/**
 * Historial de cambios (Configuración): cada carga, envío, aprobación, devolución, aviso, firma,
 * interrupción, permuta y cambio de reglas, con quién, cuándo y desde qué IP. No se edita.
 */

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Empty, ErrorCarga } from '@/components/comunes/ui';
import { descargar, mensajeError, nominaFetch } from '@/components/nomina/api';
import { cn } from '@/lib/utils';
import { BOTON, CAMPO, csv } from './piezas';
import type { PropsTab } from './VacacionesPage';

interface Movimiento {
  id: number; created_at: string; fecha: string; ejercicio: number; actor: string; usuario: string | null;
  accion: string; empleado_id: number | null; persona: string; detalle: string; ip: string | null;
}

const TODAS = '__todas__';
const MAX = 200;
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' });

export default function AuditoriaTab({ E, visibles }: PropsTab) {
  const [persona, setPersona] = useState(TODAS);
  const [movs, setMovs] = useState<Movimiento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    nominaFetch<Movimiento[]>(`/api/admin/vacaciones/auditoria${persona === TODAS ? '' : `?empleadoId=${persona}`}`)
      .then((m) => { if (vivo) { setMovs(m); setError(null); } })
      .catch((e: unknown) => { if (vivo) setError(mensajeError(e)); });
    return () => { vivo = false; };
  }, [persona, version, E]);

  const exportar = () => movs && descargar('vacaciones_historial.csv', csv([
    ['Fecha y hora', 'Día', 'Ejercicio', 'Quién', 'Usuario', 'IP', 'Acción', 'Persona', 'Detalle'],
    ...movs.map((m) => [m.created_at, m.fecha, m.ejercicio, m.actor, m.usuario, m.ip, m.accion, m.persona, m.detalle]),
  ]), 'text/csv');

  return (
    <div className="space-y-4 text-base">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={persona} onValueChange={setPersona}>
          <SelectTrigger className={cn(CAMPO, 'w-full sm:w-80')} aria-label="Persona"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas las personas</SelectItem>
            {[...visibles].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="flex-1" />
        <Button variant="outline" className={BOTON} disabled={!movs?.length} onClick={exportar}><Download className="h-5 w-5" /> Descargar</Button>
      </div>
      {error ? <ErrorCarga error={error} onReintentar={() => setVersion((v) => v + 1)} /> : !movs ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : !movs.length ? <Empty title="Todavía no hay cambios registrados" /> : (
        <ul>
          {movs.slice(0, MAX).map((m, i) => (
            <li key={m.id} className={cn('flex flex-wrap gap-x-5 gap-y-1 py-3.5', i > 0 && 'border-t border-border')}>
              <span className="w-36 shrink-0 text-muted-foreground tabular-nums">
                {fechaHora(m.created_at)}
                {m.ejercicio !== E.config.ejercicio && <span className="block text-sm">temporada {m.ejercicio}</span>}
              </span>
              <div className="min-w-0 flex-[1_1_20rem]">
                <p><b>{m.actor}</b> · {m.accion}{m.persona ? ` · ${m.persona}` : ''}</p>
                {m.detalle && <p className="text-[15px] text-muted-foreground">{m.detalle}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {movs && movs.length > MAX && <p className="text-[15px] text-muted-foreground">Se muestran los últimos {MAX} de {movs.length}. El archivo descargado trae todos.</p>}
    </div>
  );
}
