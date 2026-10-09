'use client';

/**
 * Áreas (Configuración): cuánta gente sale a la vez, qué semanas tienen otro límite o están
 * cerradas, y qué grupos no pueden faltar juntos. El jefe sale del organigrama; quién lo reemplaza
 * se elige acá. Todo se valida en el momento de elegir fechas.
 */

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Empty } from '@/components/comunes/ui';
import {
  cupoSemana,
  errorRegla,
  nombreDe,
  ocupacionSemana,
  perfilDe,
  reglasDeArea,
  semanasTemporada,
  type AreaVac,
  type ReglaCobertura,
} from '@/lib/vacaciones-calc';
import { fechaCorta } from '@/lib/fechas';
import { cn } from '@/lib/utils';
import { BOTON, CAMPO, Chip } from './piezas';
import type { PropsTab } from './VacacionesPage';

const NINGUNO = '__ninguno__';

export default function AreasTab({ E, visibles, guardar, organigramas }: PropsTab) {
  const inc = visibles.filter((e) => perfilDe(E, e.id).incluir);
  const areas = Object.values(E.areas)
    .filter((a) => inc.some((e) => e.areaId === a.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  if (!areas.length) return <Empty title="No hay áreas">Las áreas vienen del Organigrama, con las personas.</Empty>;
  return (
    <div className="space-y-5 text-base">
      {areas.map((a) => (
        <AreaCard key={a.id} a={a} E={E} guardar={guardar} lugar={organigramas.find((o) => o.id === a.organigramaId)?.nombre ?? ''} />
      ))}
    </div>
  );
}

function AreaCard({ a, E, guardar, lugar }: { a: AreaVac; E: PropsTab['E']; guardar: PropsTab['guardar']; lugar: string }) {
  const [cupo, setCupo] = useState(a.cupo == null ? '' : String(a.cupo));
  const [nota, setNota] = useState(a.nota);
  const [nuevaRegla, setNuevaRegla] = useState(false);
  const gente = E.empleados.filter((e) => e.areaId === a.id && perfilDe(E, e.id).incluir);
  const delMismoLugar = E.empleados.filter((e) => e.organigramaId === a.organigramaId && perfilDe(E, e.id).incluir).sort((x, y) => x.nombre.localeCompare(y.nombre));
  const url = `/api/admin/vacaciones/areas/${a.id}`;
  const semanas = semanasTemporada(E);
  const reglas = reglasDeArea(E, a.id);

  // Cada toque recorre: límite del área → cerrada (0) → 1 → 2 → 3 → límite del área.
  function ciclar(w: string) {
    const s = { ...a.semanas };
    if (!(w in s)) s[w] = 0;
    else if (s[w] >= 3) delete s[w];
    else s[w] += 1;
    guardar(url, 'PATCH', { semanas: s });
  }

  const guardarCupo = () => {
    const v = cupo.trim() === '' ? null : Number(cupo);
    if (v !== a.cupo) guardar(url, 'PATCH', { cupo: v }, 'Guardado');
  };

  return (
    <section className="space-y-5 rounded-xl border border-border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold">{a.nombre}</h3>
        <span className="text-muted-foreground">{gente.length} personas{lugar ? ` · ${lugar}` : ''}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`cupo-${a.id}`} className="text-base">Pueden salir a la vez</Label>
          <Input id={`cupo-${a.id}`} type="number" min={0} max={99} placeholder="Sin límite" className={CAMPO} value={cupo}
            onChange={(ev) => setCupo(ev.target.value)} onBlur={guardarCupo} onKeyDown={(ev) => ev.key === 'Enter' && guardarCupo()} />
        </div>
        <div className="space-y-1.5">
          <span className="text-base font-medium">Jefe</span>
          <p className="py-2">{a.jefeId ? nombreDe(E, a.jefeId) : <span className="text-muted-foreground">Sin jefe (se define en el Organigrama)</span>}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-base">Lo reemplaza</Label>
          <Select value={a.segundoId != null ? String(a.segundoId) : NINGUNO} onValueChange={(v) => guardar(url, 'PATCH', { segundoId: v === NINGUNO ? null : Number(v) }, 'Guardado')}>
            <SelectTrigger className={cn(CAMPO, 'w-full')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NINGUNO}>Nadie</SelectItem>
              {delMismoLugar.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[15px] text-muted-foreground">Semanas: tocá una para cerrarla (✕) o ponerle otro límite.</p>
        <div className="flex flex-wrap gap-1">
          {semanas.map((w, i) => {
            const propio = w in a.semanas, c = cupoSemana(E, a.id, w), oc = ocupacionSemana(E, a.id, w);
            const nuevoMes = i > 0 && w.slice(5, 7) !== semanas[i - 1].slice(5, 7);
            return (
              <button
                key={w}
                type="button"
                onClick={() => ciclar(w)}
                aria-label={`Semana del ${fechaCorta(w)}: ${c === 0 ? 'cerrada' : c == null ? 'sin límite' : `pueden salir ${c}`}, salen ${oc}`}
                className={cn(
                  'w-12 rounded-md border px-0.5 py-1 text-center text-xs leading-tight tabular-nums transition-colors hover:border-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                  nuevoMes && 'ml-2',
                  c === 0 ? 'border-destructive/40 bg-destructive/10' : propio ? 'border-foreground' : 'border-border',
                )}
              >
                {+w.slice(8, 10)}/{+w.slice(5, 7)}
                <span className={cn('block text-sm font-bold', c === 0 && 'text-destructive')}>{c === 0 ? '✕' : c ?? '∞'}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Grupos que no pueden faltar juntos</p>
          <Button variant="outline" className={BOTON} onClick={() => setNuevaRegla(true)}>Agregar grupo</Button>
        </div>
        {!reglas.length && <p className="text-muted-foreground">Ninguno todavía.</p>}
        {reglas.map((r, i) => (
          <div key={`${r.nombre}-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-4 py-2.5">
            <b>{r.nombre}</b>
            <Chip>{r.tipo === 'noJuntos' ? 'No salen juntos' : `Siempre ${r.min} presentes`}</Chip>
            <span className="min-w-0 flex-1 text-[15px] text-muted-foreground">{r.ids.map((x) => nombreDe(E, x)).join(', ')}</span>
            {r.auto ? <span className="text-[15px] text-muted-foreground">Automático</span> : (
              <Button size="icon" variant="ghost" aria-label={`Quitar el grupo ${r.nombre}`}
                onClick={() => guardar(url, 'PATCH', { reglas: a.reglas.filter((x) => x !== r) }, 'Grupo quitado')}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`nota-${a.id}`} className="text-base">Nota para el equipo</Label>
        <Input id={`nota-${a.id}`} placeholder="Por ejemplo: enero cerrado por inventario" className={CAMPO} value={nota} maxLength={300}
          onChange={(ev) => setNota(ev.target.value)} onBlur={() => nota !== a.nota && guardar(url, 'PATCH', { nota }, 'Nota guardada')} />
      </div>

      {nuevaRegla && (
        <ReglaDialog E={E} area={a} candidatos={[...gente, ...delMismoLugar.filter((e) => e.areaId !== a.id)]} cerrar={() => setNuevaRegla(false)}
          crear={(r) => guardar(url, 'PATCH', { reglas: [...a.reglas, r] }, 'Grupo creado')} />
      )}
    </section>
  );
}

function ReglaDialog({ E, area, candidatos, cerrar, crear }: {
  E: PropsTab['E'];
  area: AreaVac;
  candidatos: PropsTab['visibles'];
  cerrar: () => void;
  crear: (r: ReglaCobertura) => Promise<boolean>;
}) {
  const [r, setR] = useState<ReglaCobertura>({ tipo: 'noJuntos', nombre: '', ids: [], min: 1 });
  const [enviando, setEnviando] = useState(false);
  const error = r.nombre || r.ids.length ? errorRegla(E, r) : null;
  return (
    <Dialog open onOpenChange={(o) => !o && cerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto text-base sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Nuevo grupo</DialogTitle>
          <DialogDescription className="text-base">{area.nombre}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rg-nombre" className="text-base">Nombre</Label>
            <Input id="rg-nombre" className={CAMPO} placeholder="Por ejemplo: guardia técnica" value={r.nombre} onChange={(ev) => setR({ ...r, nombre: ev.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-base">Regla</Label>
              <Select value={r.tipo} onValueChange={(v) => setR({ ...r, tipo: v as ReglaCobertura['tipo'] })}>
                <SelectTrigger className={cn(CAMPO, 'w-full')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="noJuntos">No pueden salir juntos</SelectItem>
                  <SelectItem value="minimo">Tiene que quedar un mínimo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {r.tipo === 'minimo' && (
              <div className="space-y-1.5">
                <Label htmlFor="rg-min" className="text-base">Mínimo que se queda</Label>
                <Input id="rg-min" type="number" min={1} className={CAMPO} value={r.min ?? 1} onChange={(ev) => setR({ ...r, min: Number(ev.target.value) })} />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <span className="font-medium">Personas del grupo</span>
            <div className="grid max-h-60 gap-2 overflow-y-auto rounded-lg border border-border p-3 sm:grid-cols-2">
              {candidatos.map((e) => (
                <label key={e.id} className="flex items-center gap-2">
                  <Checkbox checked={r.ids.includes(e.id)}
                    onCheckedChange={(c) => setR({ ...r, ids: c === true ? [...r.ids, e.id] : r.ids.filter((x) => x !== e.id) })} />
                  <span className="truncate">{e.nombre}{e.areaId !== area.id && <span className="text-muted-foreground"> ({e.area})</span>}</span>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" className={BOTON} onClick={cerrar}>Cancelar</Button>
          <Button
            className={BOTON}
            disabled={enviando || !!errorRegla(E, r)}
            onClick={async () => {
              setEnviando(true);
              if (await crear({ ...r, nombre: r.nombre.trim(), min: r.tipo === 'minimo' ? r.min : undefined })) cerrar();
              setEnviando(false);
            }}
          >
            Crear grupo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
