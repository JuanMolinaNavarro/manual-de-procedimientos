'use client';

/**
 * Elegir la ficha del organigrama de un usuario. Con cientos de fichas, un combobox era
 * scrollear la lista entera: acá se busca (nombre, puesto, área o CUIL, sin tildes), se filtra por
 * lugar y se elige con el mouse o con ↑ ↓ Enter. Por defecto solo ofrece fichas libres y
 * visibles. Con una ficha elegida muestra su resumen.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar } from '@/components/comunes/ui';
import { Chip } from '@/components/asistencia/piezas';
import { cn } from '@/lib/utils';
import { buscarFichas, ocupada, resaltar, type FichaOpcion } from '@/lib/fichas-busqueda';

/** Más que esto no se dibuja: con cientos de filas la lista se traba y no se lee. */
const MAX_RESULTADOS = 50;

const detalle = (f: FichaOpcion) => [f.puesto, f.area, f.lugar].filter(Boolean).join(' · ');

export default function FichaPicker({
  fichas,
  valor,
  onCambio,
  usuarioId,
  inputId,
}: {
  fichas: FichaOpcion[];
  valor: number | null;
  onCambio: (fichaId: number | null) => void;
  /** El usuario que se edita: su propia ficha no cuenta como ocupada. */
  usuarioId?: number;
  inputId?: string;
}) {
  const [q, setQ] = useState('');
  const [lugar, setLugar] = useState<string | null>(null);
  const [verOcupadas, setVerOcupadas] = useState(false);
  const [activo, setActivo] = useState(0);
  const [cambiando, setCambiando] = useState(false);
  const listaRef = useRef<HTMLUListElement>(null);
  const listaId = useId();

  const elegida = valor != null ? fichas.find((f) => f.id === valor) : undefined;
  const lugares = useMemo(
    () => [...new Set(fichas.filter((f) => !f.oculta && f.lugar).map((f) => f.lugar))].sort((a, b) => a.localeCompare(b, 'es')),
    [fichas],
  );
  const coincidencias = useMemo(
    () => buscarFichas(fichas, q, { verOcupadas, usuarioId }),
    [fichas, q, verOcupadas, usuarioId],
  );
  const delLugar = lugar ? coincidencias.filter((f) => f.lugar === lugar) : coincidencias;
  const visibles = delLugar.slice(0, MAX_RESULTADOS);
  const indice = Math.min(activo, visibles.length - 1);
  const libres = delLugar.filter((f) => !ocupada(f, usuarioId)).length;

  useEffect(() => {
    listaRef.current?.querySelector(`[data-indice="${indice}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [indice]);

  function buscar(texto: string) {
    setQ(texto);
    setActivo(0);
  }

  function elegir(f: FichaOpcion | undefined) {
    if (!f || ocupada(f, usuarioId)) return;
    onCambio(f.id);
    setCambiando(false);
    buscar('');
  }

  function onTecla(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') setActivo(Math.min(indice + 1, visibles.length - 1));
    else if (e.key === 'ArrowUp') setActivo(Math.max(indice - 1, 0));
    else if (e.key === 'Enter') elegir(visibles[indice]);
    else if (e.key === 'Escape') {
      if (q) buscar('');
      else setCambiando(false);
    } else return;
    e.preventDefault();
  }

  if (elegida && !cambiando) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-3">
        <Avatar nombre={elegida.nombre} className="h-10 w-10 text-sm" />
        <div className="min-w-0 flex-1 basis-48">
          <p className="flex items-center gap-2 font-semibold">
            <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            {elegida.nombre}
          </p>
          <p className="text-sm text-muted-foreground">{detalle(elegida)}</p>
          {elegida.cuil && <p className="font-mono text-xs text-muted-foreground">CUIL {elegida.cuil}</p>}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setCambiando(true)}>Cambiar</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onCambio(null)}>Desvincular</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id={inputId}
          role="combobox"
          aria-expanded
          aria-controls={listaId}
          aria-activedescendant={visibles[indice] ? `${listaId}-${visibles[indice].id}` : undefined}
          aria-label={inputId ? undefined : 'Buscar ficha del organigrama'}
          autoComplete="off"
          autoFocus={cambiando}
          value={q}
          onChange={(e) => buscar(e.target.value)}
          onKeyDown={onTecla}
          placeholder="Nombre, apellido, área o CUIL…"
          className="h-10 pl-9 pr-10"
        />
        {q && (
          <Button type="button" variant="ghost" size="icon" aria-label="Borrar búsqueda" onClick={() => buscar('')} className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {lugares.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por lugar">
          {[null, ...lugares].map((l) => {
            const cantidad = (l ? coincidencias.filter((f) => f.lugar === l) : coincidencias).length;
            // Un lugar sin resultados no sirve para acotar: no se muestra (salvo el elegido).
            if (l && !cantidad && lugar !== l) return null;
            return (
              <Chip key={l ?? ''} activo={lugar === l} onClick={() => { setLugar(l); setActivo(0); }}>
                {l ?? 'Todos los lugares'} <span className="font-mono opacity-75">{cantidad}</span>
              </Chip>
            );
          })}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <ul id={listaId} ref={listaRef} role="listbox" aria-label="Fichas del organigrama" className="max-h-72 overflow-y-auto p-1">
          {visibles.map((f, i) => {
            const deOtro = ocupada(f, usuarioId);
            return (
              <li
                key={f.id}
                id={`${listaId}-${f.id}`}
                data-indice={i}
                role="option"
                aria-selected={i === indice}
                aria-disabled={deOtro}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActivo(i)}
                onClick={() => elegir(f)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-2 py-1.5',
                  deOtro ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                  i === indice && !deOtro && 'bg-accent',
                )}
              >
                <Avatar nombre={f.nombre} className="h-8 w-8 text-xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium"><Resaltado texto={f.nombre} q={q} /></span>
                  <span className="block truncate text-sm text-muted-foreground"><Resaltado texto={detalle(f)} q={q} /></span>
                </span>
                {deOtro ? (
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">Usuario {f.usuario?.usuario}</span>
                ) : (
                  f.cuil && <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:block">{f.cuil}</span>
                )}
              </li>
            );
          })}
          {visibles.length === 0 && (
            <li className="px-4 py-7 text-center">
              <p className="font-medium">{q.trim() ? `Nadie coincide con «${q.trim()}»` : 'No hay fichas libres en este lugar'}</p>
              <p className="text-sm text-muted-foreground">Probá con el apellido, parte del CUIL o cambiá de lugar.</p>
            </li>
          )}
          {delLugar.length > MAX_RESULTADOS && (
            <li className="px-3 py-2 text-center text-sm text-muted-foreground">
              Se muestran {MAX_RESULTADOS} de {delLugar.length}. Seguí escribiendo para acotar.
            </li>
          )}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-3 py-2">
          <span className="text-sm text-muted-foreground" aria-live="polite">{libres === 1 ? '1 ficha libre' : `${libres} fichas libres`}</span>
          <div className="flex items-center gap-2">
            <Checkbox id={`${listaId}-ocupadas`} checked={verOcupadas} onCheckedChange={(v) => { setVerOcupadas(v === true); setActivo(0); }} />
            <Label htmlFor={`${listaId}-ocupadas`} className="cursor-pointer text-sm font-normal">Mostrar también las que ya tienen usuario</Label>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="hidden text-xs text-muted-foreground sm:block">↑ ↓ para moverte · Enter para elegir · Esc para borrar</span>
        {elegida && <Button type="button" variant="ghost" size="sm" onClick={() => setCambiando(false)}>Mantener {elegida.nombre}</Button>}
      </div>
    </div>
  );
}

function Resaltado({ texto, q }: { texto: string; q: string }) {
  return resaltar(texto, q).map((t, i) =>
    t.marca ? <mark key={i} className="rounded-sm bg-primary/25 text-foreground">{t.texto}</mark> : t.texto,
  );
}
