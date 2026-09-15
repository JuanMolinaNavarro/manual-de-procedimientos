'use client';

/**
 * Editor del horario de un empleado. Un solo "Guardar" (no PUT por campo): son
 * varios campos que se validan en conjunto (ciclo, ancla, semanas por día,
 * aplicar desde) y una versión a medias no sirve. Nunca pisa el pasado: ver
 * `guardarVersionHorario`.
 */

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { History, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { fmtFechaDia, hoyLocal, sumarDias } from '@/lib/asistencia-datos';
import {
  CICLO_LABELS,
  CICLO_MAX,
  DIAS_SEMANA,
  DIAS_SEMANA_CORTO,
  DIAS_SEMANA_LARGO,
  describirHorario,
  diasPorDefecto,
  lunesDe,
  proximasFechasDia,
  ultimaVersion,
  validarHorarioInput,
  versionVigente,
  type DiaSemana,
  type DiasHorario,
  type HorarioVersion,
} from '@/lib/asistencia-calendario';
import { asistFetch, mensajeError, type ResultadoGuardar } from './api';
import { useAsistencia } from './AsistenciaContext';
import { Campo } from './piezas';

interface DiaForm {
  activo: boolean;
  entrada: string;
  salida: string;
  semanas: number[];
}

interface Form {
  incluir: boolean;
  cicloSemanas: number;
  cicloAncla: string;
  toleranciaMin: string;
  aplicarDesde: string;
  dias: Record<DiaSemana, DiaForm>;
}

function formDesde(v: HorarioVersion | null, hoy: string): Form {
  const base: DiasHorario = v?.dias ?? diasPorDefecto();
  const dias = {} as Record<DiaSemana, DiaForm>;
  for (const ds of DIAS_SEMANA) {
    const d = base[ds];
    dias[ds] = d
      ? { activo: true, entrada: d.entrada, salida: d.salida, semanas: d.semanas }
      : { activo: false, entrada: '08:00', salida: '17:00', semanas: [0] };
  }
  return {
    incluir: v?.incluir ?? true,
    cicloSemanas: v?.cicloSemanas ?? 1,
    cicloAncla: v?.cicloAncla ?? lunesDe(hoy),
    toleranciaMin: v?.toleranciaMin == null ? '' : String(v.toleranciaMin),
    aplicarDesde: hoy,
    dias,
  };
}

function diasDelForm(f: Form): DiasHorario {
  const out: DiasHorario = {};
  for (const ds of DIAS_SEMANA) {
    const d = f.dias[ds];
    if (d.activo) out[ds] = { semanas: f.cicloSemanas === 1 ? [0] : d.semanas, entrada: d.entrada, salida: d.salida };
  }
  return out;
}

export default function HorarioDialog({
  empleado, versiones, open, onOpenChange,
}: {
  empleado: { id: number; nombre: string };
  versiones: HorarioVersion[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {/* key: al abrir para otro empleado o tras guardar, el form arranca de cero. */}
        {open && <Editor key={`${empleado.id}-${versiones.map((v) => v.id).join(',')}`} empleado={empleado} versiones={versiones} onCerrar={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function Editor({ empleado, versiones, onCerrar }: { empleado: { id: number; nombre: string }; versiones: HorarioVersion[]; onCerrar: () => void }) {
  const { refrescar } = useAsistencia();
  const [hoy] = useState(() => hoyLocal());
  const vigente = useMemo(() => versionVigente(versiones, hoy), [versiones, hoy]);
  const ultima = useMemo(() => ultimaVersion(versiones), [versiones]);
  const [f, setF] = useState<Form>(() => formDesde(vigente ?? ultima, hoy));
  const [guardando, setGuardando] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);

  const setDia = (ds: DiaSemana, patch: Partial<DiaForm>) => setF((p) => ({ ...p, dias: { ...p.dias, [ds]: { ...p.dias[ds], ...patch } } }));
  const todasLasSemanas = (n: number) => Array.from({ length: n }, (_, i) => i);
  // Al cambiar el ciclo, todos los días vuelven a "todas las semanas": lo normal es
  // que solo uno o dos días alternen, y arrancar con L–V en semana 1 sola sería una trampa.
  const setCiclo = (n: number) =>
    setF((p) => {
      const dias = { ...p.dias };
      for (const ds of DIAS_SEMANA) dias[ds] = { ...dias[ds], semanas: todasLasSemanas(n) };
      return { ...p, cicloSemanas: n, dias };
    });

  // Versión "borrador" para el preview de fechas.
  const borrador = useMemo<HorarioVersion>(
    () => ({ id: 0, empleadoId: empleado.id, vigenteDesde: f.aplicarDesde, vigenteHasta: null, incluir: f.incluir, cicloSemanas: f.cicloSemanas, cicloAncla: lunesDe(f.cicloAncla || hoy), toleranciaMin: null, dias: diasDelForm(f) }),
    [f, empleado.id, hoy],
  );

  // Qué pasa con la versión anterior al guardar.
  const efecto = (() => {
    if (!ultima) return { tipo: 'primera' as const, texto: 'Primera versión del horario.' };
    if (f.aplicarDesde > ultima.vigenteDesde) {
      const cierra = ultima.vigenteHasta == null || ultima.vigenteHasta >= f.aplicarDesde;
      return {
        tipo: 'nueva' as const,
        texto: cierra
          ? `La versión vigente queda cerrada el ${fmtFechaDia(sumarDias(f.aplicarDesde, -1))}; los días anteriores no cambian.`
          : `Se crea una versión nueva (la anterior ya estaba cerrada el ${fmtFechaDia(ultima.vigenteHasta!)}).`,
      };
    }
    if (f.aplicarDesde === ultima.vigenteDesde) return { tipo: 'corrige' as const, texto: `Corrige en el lugar la versión que empieza el ${fmtFechaDia(ultima.vigenteDesde)}.` };
    return { tipo: 'bloqueado' as const, texto: `Ya hay una versión que empieza el ${fmtFechaDia(ultima.vigenteDesde)}. Para aplicar desde antes, deshacela primero.` };
  })();

  async function guardar() {
    let input;
    try {
      input = validarHorarioInput({
        empleadoId: empleado.id,
        aplicarDesde: f.aplicarDesde,
        incluir: f.incluir,
        cicloSemanas: f.cicloSemanas,
        cicloAncla: f.cicloAncla,
        toleranciaMin: f.toleranciaMin,
        dias: diasDelForm(f),
        versionEsperadaId: ultima?.id ?? null,
      });
    } catch (e) {
      toast.error(mensajeError(e));
      return;
    }
    setGuardando(true);
    try {
      const r = await asistFetch<ResultadoGuardar>('/api/admin/asistencia/horarios', { method: 'POST', body: JSON.stringify(input) });
      toast.success(r.corregida ? `Horario de ${empleado.nombre} corregido.` : `Horario de ${empleado.nombre} aplicado desde el ${fmtFechaDia(r.horario.vigenteDesde)}.`);
      refrescar();
      onCerrar();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  async function deshacer() {
    if (!ultima) return;
    setGuardando(true);
    try {
      const r = await asistFetch<{ reabierta: HorarioVersion | null }>(`/api/admin/asistencia/horarios/${ultima.id}`, { method: 'DELETE' });
      toast.success(r.reabierta ? 'Última versión deshecha; la anterior vuelve a estar vigente.' : 'Última versión deshecha.');
      refrescar();
      onCerrar();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  const cicloN = f.cicloSemanas;
  const diasParciales = DIAS_SEMANA.filter((ds) => f.dias[ds].activo && cicloN > 1 && f.dias[ds].semanas.length < cicloN);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Horario de {empleado.nombre}</DialogTitle>
        <DialogDescription>
          {vigente ? <>Vigente hoy: <span className="font-medium text-foreground">{describirHorario(vigente)}</span></> : ultima ? 'Sin horario vigente hoy.' : 'Todavía no tiene horario cargado.'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        <div className="flex flex-wrap items-end gap-4">
          <Campo label="Incluir en el control">
            <div className="flex h-9 items-center gap-2">
              <Switch checked={f.incluir} onCheckedChange={(v) => setF((p) => ({ ...p, incluir: v }))} aria-label="Incluir en el control de asistencia" />
              <span className="text-sm text-muted-foreground">{f.incluir ? 'Sí' : 'No (no se marcan ausencias ni tardanzas)'}</span>
            </div>
          </Campo>
          <Campo label="Tolerancia (min)">
            <Input
              type="number" min={0} max={180} step={1} placeholder="general"
              value={f.toleranciaMin}
              onChange={(e) => setF((p) => ({ ...p, toleranciaMin: e.target.value }))}
              className="h-9 w-28"
            />
          </Campo>
          <Campo label="Ciclo">
            <Select value={String(f.cicloSemanas)} onValueChange={(v) => setCiclo(Number(v))}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: CICLO_MAX }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>{CICLO_LABELS[n]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          {cicloN > 1 && (
            <Campo label="La semana 1 empieza el">
              <Input type="date" value={f.cicloAncla} onChange={(e) => setF((p) => ({ ...p, cicloAncla: e.target.value }))} className="h-9 w-40" />
            </Campo>
          )}
        </div>
        {cicloN > 1 && (
          <p className="-mt-3 text-xs text-muted-foreground">
            Se toma el lunes de esa semana ({f.cicloAncla ? fmtFechaDia(lunesDe(f.cicloAncla)) : '—'}) como semana 1. Cada día indica en qué semanas del ciclo aplica.
          </p>
        )}

        <div className={cn('overflow-hidden rounded-lg border border-border', !f.incluir && 'opacity-50')}>
          <div className="grid grid-cols-[3rem_1fr_1fr_1fr_auto] items-center gap-x-3 border-b border-border bg-muted/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Día</span><span>Viene</span><span>Entrada</span><span>Salida</span><span>{cicloN > 1 ? 'Semanas' : ''}</span>
          </div>
          {DIAS_SEMANA.map((ds) => {
            const d = f.dias[ds];
            return (
              <div key={ds} className={cn('grid grid-cols-[3rem_1fr_1fr_1fr_auto] items-center gap-x-3 px-3 py-1.5', ds % 2 === 1 && 'bg-muted/20', !d.activo && 'text-muted-foreground')}>
                <span className="text-sm font-medium" title={DIAS_SEMANA_LARGO[ds]}>{DIAS_SEMANA_CORTO[ds]}</span>
                <button
                  type="button"
                  aria-pressed={d.activo}
                  aria-label={`${DIAS_SEMANA_LARGO[ds]}: ${d.activo ? 'laborable' : 'no laborable'}`}
                  disabled={!f.incluir}
                  onClick={() => setDia(ds, { activo: !d.activo, semanas: d.activo ? d.semanas : todasLasSemanas(cicloN) })}
                  className={cn(
                    'h-7 w-16 rounded-md border text-xs font-medium transition-colors',
                    d.activo ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  {d.activo ? 'Sí' : 'No'}
                </button>
                <Input type="time" value={d.entrada} disabled={!d.activo || !f.incluir} onChange={(e) => setDia(ds, { entrada: e.target.value })} className="h-8 w-28" aria-label={`Entrada ${DIAS_SEMANA_LARGO[ds]}`} />
                <Input type="time" value={d.salida} disabled={!d.activo || !f.incluir} onChange={(e) => setDia(ds, { salida: e.target.value })} className="h-8 w-28" aria-label={`Salida ${DIAS_SEMANA_LARGO[ds]}`} />
                <div className="flex items-center gap-2">
                  {cicloN > 1 && Array.from({ length: cicloN }, (_, i) => i).map((sem) => (
                    <label key={sem} className="flex items-center gap-1 text-xs">
                      <Checkbox
                        checked={d.semanas.includes(sem)}
                        disabled={!d.activo || !f.incluir}
                        onCheckedChange={(v) => setDia(ds, { semanas: v ? [...new Set([...d.semanas, sem])].sort() : d.semanas.filter((x) => x !== sem) })}
                        aria-label={`${DIAS_SEMANA_LARGO[ds]} semana ${sem + 1}`}
                      />
                      S{sem + 1}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {diasParciales.length > 0 && (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs">
            <p className="mb-1 font-semibold text-foreground">Para verificar la paridad</p>
            {diasParciales.map((ds) => (
              <p key={ds} className="text-muted-foreground">
                Próximos {DIAS_SEMANA_LARGO[ds].toLowerCase()}{ds >= 5 ? 's' : ''}:{' '}
                {proximasFechasDia(borrador, ds, f.aplicarDesde || hoy, 4).map((x, i) => (
                  <span key={x.fecha} className={cn('tabular-nums', x.aplica ? 'font-medium text-foreground' : 'line-through')}>
                    {i > 0 && ', '}{fmtFechaDia(x.fecha).slice(0, 5)}
                  </span>
                ))}
              </p>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-4">
          <Campo label="Aplicar desde">
            <Input type="date" value={f.aplicarDesde} onChange={(e) => setF((p) => ({ ...p, aplicarDesde: e.target.value }))} className="h-9 w-40" />
          </Campo>
          <p className={cn('pb-2 text-xs', efecto.tipo === 'bloqueado' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>{efecto.texto}</p>
        </div>

        {versiones.length > 0 && (
          <div className="space-y-2">
            <button type="button" onClick={() => setVerHistorial((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
              <History className="h-3.5 w-3.5" /> {verHistorial ? 'Ocultar historial' : `Historial (${versiones.length})`}
            </button>
            {verHistorial && (
              <ul className="space-y-1 rounded-lg border border-border p-2 text-xs">
                {versiones.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-2">
                    <Badge variant={v.id === vigente?.id ? 'default' : 'secondary'} className="tabular-nums">
                      {fmtFechaDia(v.vigenteDesde)} → {v.vigenteHasta ? fmtFechaDia(v.vigenteHasta) : 'abierta'}
                    </Badge>
                    <span className="text-muted-foreground">{describirHorario(v)}{v.toleranciaMin != null ? ` · tol. ${v.toleranciaMin} min` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        {ultima ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={guardando} className="text-muted-foreground">
                <Undo2 className="h-4 w-4" /> Deshacer última versión
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Deshacer la versión que empieza el {fmtFechaDia(ultima.vigenteDesde)}</AlertDialogTitle>
                <AlertDialogDescription>
                  Se borra esa versión. Si había una anterior que se cerró por esta, vuelve a quedar abierta. Los días
                  que ya pasaron se vuelven a evaluar con el horario que quede vigente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={(e) => { e.preventDefault(); deshacer(); }}>Deshacer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : <span />}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando || efecto.tipo === 'bloqueado'}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </DialogFooter>
    </>
  );
}
