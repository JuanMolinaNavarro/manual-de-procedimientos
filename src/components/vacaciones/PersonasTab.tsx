'use client';

/**
 * Personas: lista con los días de cada una y, al tocarla, su ficha al costado (de dónde salen los
 * días, convenio, si participa, veranos anteriores). Ingreso, categoría y básico vienen de Nómina ›
 * Maestro; nombre, área y jefe, del Organigrama.
 */

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Empty } from '@/components/comunes/ui';
import { coincide } from '@/components/nomina/PasoCard';
import {
  DIAS_SEMANA, aperturaDe, convenioAuto, debeVerano, diasCierres, diasDe, ocupa, perfilDe, solDe, turnoAbierto, usadosDe, veranoEstado,
  type EmpleadoVac, type EstadoVac, type PerfilVac,
} from '@/lib/vacaciones-calc';
import { canonicalJson } from '@/lib/nomina-calc';
import { cn } from '@/lib/utils';
import { BOTON, Buscador, CAMPO, Chip, EstadoChip, Persona, diaMes, temporadaTxt, useOcupado } from './piezas';
import type { PropsTab } from './VacacionesPage';

type Filtro = 'todas' | 'verano' | 'sinElegir' | 'no' | 'sinIngreso';
const FILTROS: Record<Filtro, string> = {
  todas: 'Todas', verano: 'Les toca verano', sinElegir: 'Todavía no eligieron', no: 'No participan', sinIngreso: 'Les falta la fecha de ingreso',
};
const AUTO = '__auto__';
const NINGUNO = '__ninguno__';

/** Días asignados (tramos enviados o aprobados + cierres de la empresa). */
const asignados = (E: EstadoVac, id: number) => (ocupa(solDe(E, id)) ? usadosDe(E, id) : diasCierres(E));

export default function PersonasTab({ E, visibles, guardar, verSueldos, verSolicitud }: PropsTab) {
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [sel, setSel] = useState<number | null>(null);
  const fichaRef = useRef<HTMLDivElement>(null);

  const cumple = (e: EmpleadoVac) => {
    const p = perfilDe(E, e.id), s = solDe(E, e.id);
    return filtro === 'todas' || (filtro === 'no' && !p.incluir)
      || (filtro === 'verano' && p.incluir && debeVerano(E, e.id))
      || (filtro === 'sinElegir' && p.incluir && !ocupa(s))
      || (filtro === 'sinIngreso' && diasDe(E, e.id).anios === null);
  };
  const filas = visibles.filter((e) => cumple(e) && coincide(e.nombre, buscar)).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const elegida = filas.find((e) => e.id === sel) ?? filas[0];

  function abrir(id: number) {
    setSel(id);
    if (window.innerWidth < 1024) setTimeout(() => fichaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  return (
    <div className="space-y-5 text-base">
      <div className="flex flex-wrap gap-3">
        <Buscador valor={buscar} onCambio={setBuscar} className="min-w-0 flex-[1_1_16rem] sm:max-w-sm" />
        <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
          <SelectTrigger className={cn(CAMPO, 'w-full sm:w-72')} aria-label="Mostrar"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(FILTROS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {!filas.length ? <Empty title="No hay nadie con ese filtro" /> : (
        <div className="flex flex-wrap items-start gap-6">
          <Card className="min-w-0 flex-[999_1_28rem] gap-0 overflow-hidden py-0">
            {filas.map((e, i) => (
              <Fila key={e.id} E={E} e={e} activa={elegida?.id === e.id} primera={i === 0} onClick={() => abrir(e.id)} />
            ))}
          </Card>
          {elegida && (
            <div ref={fichaRef} className="min-w-0 flex-[1_1_26rem] scroll-mt-4 lg:sticky lg:top-4">
              <Ficha key={elegida.id} E={E} e={elegida} verSueldos={verSueldos} guardar={guardar} verSolicitud={verSolicitud} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Fila({ E, e, activa, primera, onClick }: { E: EstadoVac; e: EmpleadoVac; activa: boolean; primera: boolean; onClick: () => void }) {
  const p = perfilDe(E, e.id), s = solDe(E, e.id), d = diasDe(E, e.id);
  const quedan = d.total - asignados(E, e.id);
  const turno = !p.incluir ? 'No participa'
    : E.config.criterioOrden === 'llegada' || turnoAbierto(E, e.id) ? 'Turno abierto' : `Su turno abre el ${diaMes(aperturaDe(E, e.id))}`;
  const conSolicitud = p.incluir && s.estado !== 'borrador';
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={cn(
        'flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset',
        !primera && 'border-t border-border',
        activa && 'bg-muted hover:bg-muted',
        !p.incluir && 'opacity-60',
      )}
    >
      <div className="min-w-0 flex-1">
        <Persona e={e} sub={e.area} />
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-14">
          {conSolicitud ? <EstadoChip estado={s.estado} /> : <span className="text-[15px] text-muted-foreground">{turno}</span>}
          {p.incluir && debeVerano(E, e.id) && <Chip tono="warn">Le toca verano</Chip>}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[17px] font-semibold tabular-nums">{d.anios === null ? '—' : `${d.total} días`}</div>
        <div className="text-[15px] text-muted-foreground">
          {d.anios === null ? 'falta su ingreso' : quedan > 0 ? `le quedan ${quedan}` : 'todos elegidos'}
        </div>
      </div>
    </button>
  );
}

// ─── Ficha ──────────────────────────────────────────────────────────────────

/** El formulario de la ficha, todo en texto como lo manejan los campos. */
interface FormFicha {
  convenio: string;
  francoRotativo: boolean;
  diaDescanso: string;
  conyugeId: string;
  hijosPrimaria: boolean;
  diasTrabajados: string;
  extraConvenio: string;
  extraBeneficio: string;
  arrastreDias: string;
  arrastreAcuerdo: boolean;
  remuneracionRef: string;
  historial: Record<string, { verano: string; pos: string }>;
}
type SetForm = (cambio: Partial<FormFicha>) => void;

const aTexto = (n: number | null) => (n == null ? '' : String(n));
const aNumero = (v: string) => (v === '' ? null : Number(v));

function formularioDe(p: PerfilVac, anios: number[]): FormFicha {
  return {
    convenio: p.convenio ?? AUTO,
    francoRotativo: p.francoRotativo,
    diaDescanso: String(p.diaDescanso),
    conyugeId: p.conyugeId != null ? String(p.conyugeId) : NINGUNO,
    hijosPrimaria: p.hijosPrimaria,
    diasTrabajados: aTexto(p.diasTrabajados),
    extraConvenio: aTexto(p.extraConvenio || null),
    extraBeneficio: aTexto(p.extraBeneficio || null),
    arrastreDias: aTexto(p.arrastre.dias || null),
    arrastreAcuerdo: p.arrastre.acuerdo,
    remuneracionRef: aTexto(p.remuneracionRef),
    historial: Object.fromEntries(anios.map((anio) => {
      const h = p.historial[anio];
      return [anio, { verano: h?.verano == null ? '' : h.verano ? '1' : '0', pos: h?.pos == null ? '' : String(h.pos + 1) }];
    })),
  };
}

/** Solo los campos que cambiaron, en el formato de la API: la auditoría registra los campos tocados. */
function cambiosDeFicha(p: PerfilVac, f: FormFicha, verSueldos: boolean): Record<string, unknown> {
  const historialNuevo = Object.fromEntries(Object.entries(f.historial).map(([anio, h]) => {
    const pos = aNumero(h.pos);
    return [anio, { verano: h.verano === '' ? null : h.verano === '1', pos: pos == null ? null : pos - 1 }];
  }));
  const nuevo: Record<string, unknown> = {
    convenio: f.convenio === AUTO ? null : f.convenio,
    francoRotativo: f.francoRotativo,
    diaDescanso: Number(f.diaDescanso),
    conyugeId: f.conyugeId === NINGUNO ? null : Number(f.conyugeId),
    hijosPrimaria: f.hijosPrimaria,
    diasTrabajados: aNumero(f.diasTrabajados),
    extraConvenio: aNumero(f.extraConvenio) ?? 0,
    extraBeneficio: aNumero(f.extraBeneficio) ?? 0,
    arrastreDias: aNumero(f.arrastreDias) ?? 0,
    arrastreAcuerdo: f.arrastreAcuerdo,
    ...(verSueldos && { remuneracionRef: aNumero(f.remuneracionRef) }),
    historial: Object.fromEntries(Object.entries({ ...p.historial, ...historialNuevo }).filter(([, h]) => h.verano != null || h.pos != null)),
  };
  const antes: Record<string, unknown> = {
    convenio: p.convenio, francoRotativo: p.francoRotativo, diaDescanso: p.diaDescanso, conyugeId: p.conyugeId, hijosPrimaria: p.hijosPrimaria,
    diasTrabajados: p.diasTrabajados, extraConvenio: p.extraConvenio, extraBeneficio: p.extraBeneficio, arrastreDias: p.arrastre.dias,
    arrastreAcuerdo: p.arrastre.acuerdo, remuneracionRef: p.remuneracionRef, historial: p.historial,
  };
  return Object.fromEntries(Object.entries(nuevo).filter(([k, v]) => canonicalJson(v) !== canonicalJson(antes[k])));
}

interface PropsFicha { E: EstadoVac; e: EmpleadoVac; verSueldos: boolean; guardar: PropsTab['guardar']; verSolicitud: PropsTab['verSolicitud'] }

function Ficha({ E, e, verSueldos, guardar, verSolicitud }: PropsFicha) {
  const p = perfilDe(E, e.id);
  const [f, setF] = useState(() => formularioDe(p, veranoEstado(E, e.id).ultimos.map((u) => u.anio)));
  const { ocupado, correr } = useOcupado();
  const set: SetForm = (cambio) => setF({ ...f, ...cambio });
  const cambios = cambiosDeFicha(p, f, verSueldos);
  const url = `/api/admin/vacaciones/perfiles/${e.id}`;

  return (
    <Card className="gap-6 px-6 py-6" aria-label={`Ficha de ${e.nombre}`}>
      <div className="space-y-1">
        <Persona grande e={e} sub={e.area} />
        <p className="text-[15px] text-muted-foreground">
          {e.fechaIngreso ? `Ingresó el ${diaMes(e.fechaIngreso)} de ${e.fechaIngreso.slice(0, 4)}` : 'Falta la fecha de ingreso (se carga en Nómina › Maestro)'}
        </p>
      </div>
      <SeccionDias E={E} e={e} f={f} set={set} />
      <SeccionDatos E={E} e={e} f={f} set={set} verSueldos={verSueldos}
        participa={p.incluir} cambiarParticipa={(c) => guardar(url, 'PATCH', { incluir: c }, c ? 'Participa de la temporada' : 'Ya no participa de la temporada')} />
      <SeccionVeranos f={f} set={set} />
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-5">
        {ocupa(solDe(E, e.id))
          ? <Button variant="outline" className={BOTON} onClick={() => verSolicitud(e.id)}>Ver sus fechas</Button>
          : <Button variant="outline" className={BOTON} asChild><Link href={`/admin/vacaciones/seleccion/${e.id}`}>Cargar sus fechas</Link></Button>}
        <Button className={BOTON} disabled={ocupado || !Object.keys(cambios).length} onClick={() => correr(() => guardar(url, 'PATCH', cambios, 'Ficha guardada'))}>
          Guardar cambios
        </Button>
      </div>
    </Card>
  );
}

interface PropsSeccion { E: EstadoVac; e: EmpleadoVac; f: FormFicha; set: SetForm }

function SeccionDias({ E, e, f, set }: PropsSeccion) {
  const d = diasDe(E, e.id);
  const elegidos = asignados(E, e.id), quedan = d.total - elegidos;
  const porLey = d.anios === null ? 'Por ley: sin la fecha de ingreso no se puede calcular'
    : d.proporcional ? `Por ley, proporcional: trabajó ${d.trabajados} de ${d.habiles} días hábiles`
      : `Por ley · ${d.anios} año${d.anios === 1 ? '' : 's'} de antigüedad`;
  const extra = (campo: 'extraConvenio' | 'extraBeneficio' | 'arrastreDias', label: string) => (
    <div className="flex items-center justify-between gap-3 border-t border-border py-2.5">
      <Label htmlFor={`fx-${campo}`} className="text-base font-normal">{label}</Label>
      <Input id={`fx-${campo}`} type="number" min={0} placeholder="0" value={f[campo]} onChange={(ev) => set({ [campo]: ev.target.value })}
        className={cn(CAMPO, 'w-24 text-right tabular-nums')} />
    </div>
  );
  return (
    <section className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[17px] font-semibold">Días de esta temporada</h3>
        <span className="text-2xl font-bold tabular-nums">{d.total}</span>
      </div>
      <div className="flex items-center justify-between gap-3 py-2.5">
        <span>{porLey}</span>
        <span className="w-24 pr-3 text-right tabular-nums">{d.legales}</span>
      </div>
      {extra('extraConvenio', 'Extra por convenio')}
      {extra('extraBeneficio', 'Beneficio de la empresa')}
      {extra('arrastreDias', 'Le quedaron del año pasado')}
      {Number(f.arrastreDias) > 0 && (
        <label className="flex items-center justify-between gap-3 pb-1">
          <span className="text-[15px] text-muted-foreground">Lo acordamos con la persona (hasta {d.capArrastre} días; sin acuerdo no se suman)</span>
          <Switch checked={f.arrastreAcuerdo} onCheckedChange={(c) => set({ arrastreAcuerdo: c })} aria-label="Acumulación acordada" />
        </label>
      )}
      <p className="pt-1 text-[15px] text-muted-foreground">
        {!elegidos ? 'Todavía no eligió ningún día.' : quedan > 0 ? `Ya tiene ${elegidos} días elegidos; le quedan ${quedan}.` : `Ya tiene los ${elegidos} días elegidos.`}
      </p>
    </section>
  );
}

function SeccionDatos({ E, e, f, set, verSueldos, participa, cambiarParticipa }: PropsSeccion & {
  verSueldos: boolean; participa: boolean; cambiarParticipa: (c: boolean) => void;
}) {
  const auto = convenioAuto(e.convenioTexto);
  const otros = E.empleados.filter((x) => x.id !== e.id && perfilDe(E, x.id).incluir).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const d = diasDe(E, e.id);
  return (
    <section className="space-y-4">
      <h3 className="text-[17px] font-semibold">Datos</h3>
      <div className="space-y-1.5">
        <Label className="text-base">Convenio</Label>
        <Select value={f.convenio} onValueChange={(v) => set({ convenio: v })}>
          <SelectTrigger className={cn(CAMPO, 'w-full')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={AUTO}>{E.config.convenios[auto]?.nombre ?? auto} (de su ficha)</SelectItem>
            {Object.entries(E.config.convenios).map(([k, c]) => <SelectItem key={k} value={k}>{c.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-base">¿Su pareja trabaja en la empresa?</Label>
        <Select value={f.conyugeId} onValueChange={(v) => set({ conyugeId: v })}>
          <SelectTrigger className={cn(CAMPO, 'w-full')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NINGUNO}>No</SelectItem>
            {otros.map((o) => <SelectItem key={o.id} value={String(o.id)}>Sí: {o.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-center justify-between gap-3">
        <span className="font-medium">Participa de esta temporada</span>
        <Switch checked={participa} onCheckedChange={cambiarParticipa} />
      </label>
      {verSueldos && (
        <div className="space-y-1.5">
          <Label htmlFor="fx-rem" className="text-base">Sueldo para calcular el pago</Label>
          <Input id="fx-rem" type="number" min={0} className={cn(CAMPO, 'font-mono')} value={f.remuneracionRef}
            placeholder={e.basico ? `El de Nómina: ${e.basico}` : 'Sin dato en Nómina'} onChange={(ev) => set({ remuneracionRef: ev.target.value })} />
        </div>
      )}
      <details className="rounded-lg border border-border px-4 py-3">
        <summary className="cursor-pointer font-medium">Más datos</summary>
        <div className="mt-3 space-y-4">
          <label className="flex items-center justify-between gap-3">
            <span>Trabaja con francos rotativos</span>
            <Switch checked={f.francoRotativo} onCheckedChange={(c) => set({ francoRotativo: c })} />
          </label>
          {f.francoRotativo && (
            <Select value={f.diaDescanso} onValueChange={(v) => set({ diaDescanso: v })}>
              <SelectTrigger className={cn(CAMPO, 'w-full')} aria-label="Día de descanso"><SelectValue /></SelectTrigger>
              <SelectContent>{DIAS_SEMANA.map((dia, i) => <SelectItem key={dia} value={String(i)}>Descansa los {dia}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <label className="flex items-center justify-between gap-3">
            <span>Tiene hijos en la primaria</span>
            <Switch checked={f.hijosPrimaria} onCheckedChange={(c) => set({ hijosPrimaria: c })} />
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="fx-trab" className="text-base">Días que trabajó en {E.config.ejercicio}</Label>
            <Input id="fx-trab" type="number" min={0} className={CAMPO} value={f.diasTrabajados}
              placeholder={`Calculado: ${d.trabajados} de ${d.habiles}`} onChange={(ev) => set({ diasTrabajados: ev.target.value })} />
          </div>
        </div>
      </details>
    </section>
  );
}

function SeccionVeranos({ f, set }: { f: FormFicha; set: SetForm }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[17px] font-semibold">Veranos anteriores</h3>
      {Object.entries(f.historial).sort(([a], [b]) => b.localeCompare(a)).map(([anio, h]) => {
        const temporada = temporadaTxt(Number(anio));
        const cambiar = (x: Partial<typeof h>) => set({ historial: { ...f.historial, [anio]: { ...h, ...x } } });
        return (
          <div key={anio} className="flex flex-wrap items-center gap-2">
            <span className="w-28 font-medium">{temporada}</span>
            <Select value={h.verano || NINGUNO} onValueChange={(v) => cambiar({ verano: v === NINGUNO ? '' : v })}>
              <SelectTrigger className={cn(CAMPO, 'min-w-0 flex-1')} aria-label={`Verano ${temporada}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NINGUNO}>Sin dato</SelectItem>
                <SelectItem value="1">Tuvo verano</SelectItem>
                <SelectItem value="0">No tuvo verano</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" min={1} placeholder="Turno" aria-label={`Turno en ${temporada}`} className={cn(CAMPO, 'w-24')}
              value={h.pos} onChange={(ev) => cambiar({ pos: ev.target.value })} />
          </div>
        );
      })}
    </section>
  );
}
