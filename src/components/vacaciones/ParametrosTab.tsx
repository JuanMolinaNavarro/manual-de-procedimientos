'use client';

/**
 * Parámetros de la temporada, partidos en las secciones de Configuración. Queda montado mientras
 * se recorre Configuración (para `areas` e `historial` no dibuja nada) así el borrador no se pierde
 * al cambiar de sección. La LCT fija los mínimos (el servidor no deja bajar el aviso de 30 días ni
 * el tramo de 7) y los convenios los mejoran. Cierres y cierre de temporada se guardan al instante.
 */

import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { mensajeError, nominaFetch } from '@/components/nomina/api';
import {
  conTurnoTarde,
  fmtCorto,
  incluidos,
  solDe,
  type ConfigVacaciones,
  type Convenio,
  type CriterioOrden,
} from '@/lib/vacaciones-calc';
import { diffDias } from '@/lib/fechas';
import { canonicalJson } from '@/lib/nomina-calc';
import { cn } from '@/lib/utils';
import { BOTON, CAMPO, Linea, rangoLargo, temporadaTxt } from './piezas';
import type { PropsTab } from './VacacionesPage';

const BORRADOR = ['temporada', 'turnos', 'dividir', 'convenios'];

const CRITERIOS: { k: CriterioOrden; titulo: string; desc: string }[] = [
  { k: 'rotacion', titulo: 'Rotación', desc: 'Quien eligió último el año pasado, este año elige primero.' },
  { k: 'antiguedad', titulo: 'Antigüedad', desc: 'Primero quien tiene más años en la empresa.' },
  { k: 'sorteo', titulo: 'Sorteo', desc: 'El sistema sortea el orden y lo deja registrado.' },
  { k: 'llegada', titulo: 'Sin turnos', desc: 'Todos eligen desde el primer día; las fechas son de quien las pide primero.' },
];

function Fecha({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-base">{label}</Label>
      <Input id={id} type="date" className={CAMPO} value={value} onChange={(ev) => onChange(ev.target.value)} />
    </div>
  );
}

/** Un número dentro de una frase: «Cada parte de al menos [7] días». */
function Frase({ id, antes, despues, value, onChange, min, max }: {
  id: string; antes: string; despues?: ReactNode; value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Label htmlFor={id} className="text-base font-medium">{antes}</Label>
      <Input id={id} type="number" min={min} max={max} className={cn(CAMPO, 'w-24 text-right tabular-nums')} value={String(value)}
        onChange={(ev) => onChange(Number(ev.target.value))} />
      {despues && <span>{despues}</span>}
    </div>
  );
}

function Interruptor({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export default function ParametrosTab({ E, guardar, recargar, seccion }: PropsTab & { seccion: string }) {
  const c = E.config;
  const [d, setD] = useState<ConfigVacaciones>(c);
  const [feriado, setFeriado] = useState('');
  const [cierre, setCierre] = useState({ nombre: '', desde: '', hasta: '' });
  const [cerrando, setCerrando] = useState(false);
  const set = <K extends keyof ConfigVacaciones>(k: K, v: ConfigVacaciones[K]) => setD({ ...d, [k]: v });
  const setConvenio = (codigo: string, k: keyof Convenio, v: unknown) =>
    set('convenios', { ...d.convenios, [codigo]: { ...d.convenios[codigo], [k]: v } });

  const cambios = Object.fromEntries(
    (Object.keys(d) as (keyof ConfigVacaciones)[])
      .filter((k) => k !== 'cierres' && canonicalJson(d[k]) !== canonicalJson(c[k]))
      .map((k) => [k, d[k]]),
  );
  const hayCambios = Object.keys(cambios).length > 0;
  const enBorrador = BORRADOR.includes(seccion);
  if (!enBorrador && !['cierres', 'cerrar'].includes(seccion)) return null;

  // El verano se guarda como MM-DD; en pantalla va con un año cualquiera para usar el calendario.
  const veranoFecha = (md: string, fin: boolean) => `${c.ejercicio + (fin && d.veranoFin < d.veranoInicio ? 1 : 0)}-${md}`;
  const turnoTarde = conTurnoTarde(E);
  const sinAprobar = incluidos(E).filter((e) => solDe(E, e.id).estado !== 'aprobada').length;

  async function cerrarTemporada() {
    setCerrando(true);
    try {
      const r = await nominaFetch<{ resumen: { personas: number; conVerano: number; arrastres: number } }>('/api/admin/vacaciones/cerrar', {
        method: 'POST', body: JSON.stringify({ ejercicio: c.ejercicio }),
      });
      toast.success(`Temporada cerrada: ${r.resumen.conVerano} de ${r.resumen.personas} tuvieron verano`);
      recargar();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setCerrando(false);
    }
  }

  return (
    <div className="space-y-6">
      {seccion === 'temporada' && (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <Fecha id="p-desde" label="Abre la temporada" value={d.temporadaDesde} onChange={(v) => set('temporadaDesde', v)} />
            <Fecha id="p-hasta" label="Cierra la temporada" value={d.temporadaHasta} onChange={(v) => set('temporadaHasta', v)} />
            <Fecha id="p-vi" label="El verano va desde" value={veranoFecha(d.veranoInicio, false)} onChange={(v) => v && set('veranoInicio', v.slice(5))} />
            <Fecha id="p-vf" label="hasta" value={veranoFecha(d.veranoFin, true)} onChange={(v) => v && set('veranoFin', v.slice(5))} />
          </div>
          <Frase id="p-ciclo" antes="A cada persona le toca verano al menos una vez cada" despues="temporadas" min={1} value={d.cicloVerano} onChange={(v) => set('cicloVerano', v)} />
          <div className="space-y-1">
            <Frase id="p-aviso" antes="El aviso por escrito se entrega con al menos" despues="días de anticipación" min={30} value={d.avisoMinimoDias} onChange={(v) => set('avisoMinimoDias', v)} />
            <p className="text-[15px] text-muted-foreground">Si el convenio de la persona pide más días, se usa el del convenio.</p>
          </div>
          <div className="space-y-2">
            <span className="font-medium">Feriados</span>
            <div className="flex flex-wrap gap-2">
              {[...d.feriados].sort().map((f) => (
                <span key={f} className="inline-flex items-center gap-1 rounded-full bg-secondary py-1 pr-1 pl-3 text-[15px]">
                  {fmtCorto(f)} {f.slice(0, 4)}
                  <button type="button" aria-label={`Quitar el feriado del ${fmtCorto(f)}`} className="rounded-full p-1 hover:bg-accent"
                    onClick={() => set('feriados', d.feriados.filter((x) => x !== f))}>
                    <X className="h-4 w-4" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="date" aria-label="Fecha del feriado" className={cn(CAMPO, 'w-48')} value={feriado} onChange={(ev) => setFeriado(ev.target.value)} />
              <Button variant="outline" className={BOTON} disabled={!feriado || d.feriados.includes(feriado)}
                onClick={() => { set('feriados', [...d.feriados, feriado].sort()); setFeriado(''); }}>
                Agregar feriado
              </Button>
            </div>
          </div>
          <Frase id="p-ej" antes="Año al que corresponden estas vacaciones" value={d.ejercicio} onChange={(v) => set('ejercicio', v)} />
        </>
      )}

      {seccion === 'turnos' && (
        <>
          {turnoTarde > 0 && (
            <Linea tono="warn">
              {turnoTarde === 1 ? 'A 1 persona le toca elegir' : `A ${turnoTarde} personas les toca elegir`} después de la fecha límite.
              Subí las personas por turno, bajá los días por turno o corré la fecha límite.
            </Linea>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <Fecha id="p-inicio" label="Empiezan a elegir el" value={d.inicioProceso} onChange={(v) => set('inicioProceso', v)} />
            <Fecha id="p-limite" label="Tienen tiempo hasta el" value={d.fechaLimiteCarga} onChange={(v) => set('fechaLimiteCarga', v)} />
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 font-medium">¿Quién elige primero dentro de cada área?</legend>
            {CRITERIOS.map((x) => (
              <label key={x.k} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50', d.criterioOrden === x.k ? 'border-foreground' : 'border-input')}>
                <input type="radio" name="criterio" className="mt-1 h-[18px] w-[18px] accent-primary" checked={d.criterioOrden === x.k} onChange={() => set('criterioOrden', x.k)} />
                <span><b>{x.titulo}</b><span className="block text-[15px] text-muted-foreground">{x.desc}</span></span>
              </label>
            ))}
          </fieldset>
          {d.criterioOrden !== 'llegada' && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Frase id="p-ppt" antes="Eligen de a" despues="personas por área, y cada turno dura" min={1} value={d.personasPorTurno} onChange={(v) => set('personasPorTurno', v)} />
              <Input type="number" min={1} aria-label="Días por turno" className={cn(CAMPO, 'w-24 text-right tabular-nums')} value={String(d.diasPorTurno)}
                onChange={(ev) => set('diasPorTurno', Number(ev.target.value))} />
              <span>días</span>
            </div>
          )}
          {d.criterioOrden === 'sorteo' && (
            <div className="space-y-1.5">
              <Label htmlFor="p-semilla" className="text-base">Palabra del sorteo</Label>
              <Input id="p-semilla" className={cn(CAMPO, 'max-w-xs')} value={d.semillaSorteo} onChange={(ev) => set('semillaSorteo', ev.target.value)} />
              <p className="text-[15px] text-muted-foreground">Cambiarla rehace el sorteo.</p>
            </div>
          )}
          <p className="text-muted-foreground">Siempre eligen primero quienes llevan {Math.max(1, d.cicloVerano - 1)} temporadas sin verano.</p>
        </>
      )}

      {seccion === 'dividir' && (
        <>
          <Interruptor label="Se pueden dividir en partes" checked={d.fraccionar} onChange={(v) => set('fraccionar', v)} />
          {d.fraccionar && (
            <>
              <Frase id="p-tmin" antes="Cada parte de al menos" despues="días" min={7} value={d.tramoMinimo} onChange={(v) => set('tramoMinimo', v)} />
              <Frase id="p-tmax" antes="Como máximo" despues="partes" min={1} value={d.maxTramos} onChange={(v) => set('maxTramos', v)} />
              <Frase id="p-tpct" antes="Una de las partes tiene que tener al menos el" despues="% de los días (0 = no se exige)" min={0} max={100}
                value={d.tramoPrincipalPct} onChange={(v) => set('tramoPrincipalPct', v)} />
              <p className="text-muted-foreground">Para dividirlas, la persona tiene que firmar el acuerdo. Si su convenio permite menos partes, se usa el del convenio.</p>
            </>
          )}
        </>
      )}

      {seccion === 'cierres' && (
        <>
          <p>Días en que la empresa cierra y salen todos. Se descuentan de las vacaciones de cada persona.</p>
          {c.cierres.map((x, i) => (
            <div key={`${x.desde}-${i}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-3">
              <div className="min-w-0 flex-1">
                <b className="text-[17px]">{x.nombre || 'Cierre'}</b>
                <div className="text-[15px] text-muted-foreground">{rangoLargo(x.desde, x.hasta)} · {diffDias(x.desde, x.hasta) + 1} días a todos</div>
              </div>
              <Button variant="ghost" className={BOTON}
                onClick={() => guardar('/api/admin/vacaciones', 'PATCH', { cierres: c.cierres.filter((_, j) => j !== i) }, 'Cierre quitado')}>
                Quitar
              </Button>
            </div>
          ))}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ci-nom" className="text-base">Nombre</Label>
              <Input id="ci-nom" className={CAMPO} placeholder="Por ejemplo: receso de fin de año" value={cierre.nombre} onChange={(ev) => setCierre({ ...cierre, nombre: ev.target.value })} />
            </div>
            <Fecha id="ci-desde" label="Desde" value={cierre.desde} onChange={(v) => setCierre({ ...cierre, desde: v })} />
            <Fecha id="ci-hasta" label="Hasta" value={cierre.hasta} onChange={(v) => setCierre({ ...cierre, hasta: v })} />
          </div>
          <Button variant="outline" className={BOTON} disabled={!cierre.desde || !cierre.hasta || cierre.hasta < cierre.desde}
            onClick={async () => {
              if (await guardar('/api/admin/vacaciones', 'PATCH', { cierres: [...c.cierres, cierre] }, 'Cierre agregado')) setCierre({ nombre: '', desde: '', hasta: '' });
            }}>
            Agregar cierre
          </Button>
        </>
      )}

      {seccion === 'convenios' && (
        <>
          <Linea tono="warn">Cambiá estos valores solo con el visto bueno de Legales.</Linea>
          {Object.entries(d.convenios).map(([codigo, cv]) => (
            <section key={codigo} className="space-y-4 rounded-xl border border-border p-5">
              <Input aria-label={`Nombre del convenio ${codigo}`} className={cn(CAMPO, 'font-semibold')} value={cv.nombre} onChange={(ev) => setConvenio(codigo, 'nombre', ev.target.value)} />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="font-medium">La antigüedad se cuenta al</span>
                <Input type="number" min={1} max={31} aria-label="Día" className={cn(CAMPO, 'w-20 text-right')} value={String(cv.corteDia)} onChange={(ev) => setConvenio(codigo, 'corteDia', Number(ev.target.value))} />
                <span>/</span>
                <Input type="number" min={1} max={12} aria-label="Mes" className={cn(CAMPO, 'w-20 text-right')} value={String(cv.corteMes)} onChange={(ev) => setConvenio(codigo, 'corteMes', Number(ev.target.value))} />
                <label className="flex items-center gap-2">
                  <Switch checked={cv.corteAnioOffset > 0} onCheckedChange={(v) => setConvenio(codigo, 'corteAnioOffset', v ? 1 : 0)} />
                  del año siguiente
                </label>
              </div>
              <Frase id={`cv-tr-${codigo}`} antes="Máximo de partes" min={1} value={cv.maxTramos} onChange={(v) => setConvenio(codigo, 'maxTramos', v)} />
              <Frase id={`cv-av-${codigo}`} antes="Aviso por escrito con" despues="días de anticipación" min={30} value={cv.avisoDias} onChange={(v) => setConvenio(codigo, 'avisoDias', v)} />
              <Interruptor label="Pueden empezar o terminar junto con su pareja" checked={cv.conyuges} onChange={(v) => setConvenio(codigo, 'conyuges', v)} />
              <Interruptor label="Pueden cambiar fechas con un compañero" checked={cv.permutas} onChange={(v) => setConvenio(codigo, 'permutas', v)} />
              <Interruptor label="Se interrumpen por fallecimiento de un familiar" checked={cv.suspFallecimiento} onChange={(v) => setConvenio(codigo, 'suspFallecimiento', v)} />
              <Interruptor label="Eligen antes quienes tienen hijos en la primaria" checked={cv.hijosEscolares} onChange={(v) => setConvenio(codigo, 'hijosEscolares', v)} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-medium">Sueldo para calcular el pago</span>
                <Select value={cv.remuneracion} onValueChange={(v) => setConvenio(codigo, 'remuneracion', v)}>
                  <SelectTrigger className={cn(CAMPO, 'w-64')}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="actual">El sueldo actual</SelectItem>
                    <SelectItem value="mayor12">El mayor de los últimos 12 meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>
          ))}
        </>
      )}

      {seccion === 'cerrar' && (
        <>
          <p>Se hace una sola vez, cuando terminó la temporada. Al cerrarla:</p>
          <ul className="list-disc space-y-1.5 pl-6">
            <li>Queda guardado quién tuvo verano, para el orden del año que viene.</li>
            <li>A quien le quedaron días se le propone pasarlos al año siguiente (hasta un tercio, con acuerdo).</li>
            <li>Arranca la temporada {temporadaTxt(c.ejercicio + 1)}.</li>
          </ul>
          <Linea tono="error">
            No se puede deshacer.{sinAprobar > 0 && ` Todavía hay ${sinAprobar === 1 ? '1 persona que no tiene' : `${sinAprobar} personas que no tienen`} sus vacaciones aprobadas.`}
          </Linea>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className={BOTON} disabled={cerrando}>Cerrar la temporada {temporadaTxt(c.ejercicio)}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-xl">¿Cerrar la temporada?</AlertDialogTitle>
                <AlertDialogDescription className="text-base">
                  Quien no tenga sus vacaciones aprobadas queda registrado sin verano. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className={BOTON}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={cerrarTemporada} className={cn(BOTON, 'bg-destructive text-white hover:bg-destructive/90')}>Cerrar la temporada</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {(enBorrador || hayCambios) && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-5">
          {hayCambios && !enBorrador && <span className="text-muted-foreground">Tenés cambios sin guardar en otra sección.</span>}
          <Button variant="ghost" className={BOTON} disabled={!hayCambios} onClick={() => setD(c)}>Descartar</Button>
          <Button className={BOTON} disabled={!hayCambios} onClick={() => guardar('/api/admin/vacaciones', 'PATCH', cambios, 'Cambios guardados')}>Guardar cambios</Button>
        </div>
      )}
    </div>
  );
}
