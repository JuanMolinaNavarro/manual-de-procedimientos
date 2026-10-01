'use client';

/**
 * Gestión de recibos (RR.HH., `/admin/gestion-recibos`): módulo propio, fuera de Nómina. Arriba
 * el mes y dos filtros que no se mezclan: el EMPLEADOR (la empresa que liquida, de Finnegans) y
 * el LUGAR de trabajo (organigrama de la ficha). El ciclo del mes en tres pasos — importar de
 * Finnegans, avisar por mail (a todos los del mes), seguir las firmas — y abajo las pestañas
 * Recibos / Adhesiones / Disconformidades. La firma la hace cada trabajador desde Mis recibos, en
 * su celular, con su PIN.
 */

import { useState, type ReactNode } from 'react';
import { HelpCircle, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CadenaEmpleador, RecibosData } from '@/lib/nomina';
import type { CasoView, EmpleadorOpcion, PanelRecibos } from '@/lib/recibos-finnegans';
import { cn } from '@/lib/utils';
import AdhesionesTabla from './AdhesionesTabla';
import PasoAviso from './AvisoRecibos';
import CasosDisconformidad from './CasosDisconformidad';
import { useNomina, useNominaData } from './NominaContext';
import { PasoCard, type EstadoPaso } from './PasoCard';
import PasoImportar from './RecibosFinnegans';
import RecibosPeriodo from './RecibosPeriodo';
import { ErrorCarga } from './ui';

/** Filtros de la página: empleador (CUIT) y lugar de trabajo (organigrama). '' = todos. */
interface Filtros { empleador: string; lugar: string }

const TODOS = '__todos__';

/** Título + mes (compartido con Nómina por localStorage) + filtros por empleador y lugar. */
function Encabezado({ extra, filtros, onFiltros, empleadores }: {
  extra?: ReactNode;
  filtros: Filtros;
  onFiltros: (f: Filtros) => void;
  empleadores: EmpleadorOpcion[];
}) {
  const { organigramas, periodo, setPeriodo } = useNomina();
  // Un empleador elegido que no tiene recibos este mes sigue figurando (si no, el Select queda vacío).
  const opciones = filtros.empleador && !empleadores.some((e) => e.cuit === filtros.empleador)
    ? [...empleadores, { cuit: filtros.empleador, nombre: `CUIT ${filtros.empleador}` }]
    : empleadores;
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestión de recibos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Recibos de sueldo de Finnegans: publicarlos, avisar y seguir las firmas.</p>
        </div>
        {extra}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="h-9 w-full sm:w-44" aria-label="Mes" />
        <Select value={filtros.empleador || TODOS} onValueChange={(v) => onFiltros({ ...filtros, empleador: v === TODOS ? '' : v })}>
          <SelectTrigger className="h-9 w-full sm:w-64" aria-label="Empleador">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los empleadores</SelectItem>
            {opciones.map((e) => <SelectItem key={e.cuit} value={e.cuit}>{e.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtros.lugar || TODOS} onValueChange={(v) => onFiltros({ ...filtros, lugar: v === TODOS ? '' : v })}>
          <SelectTrigger className="h-9 w-full sm:w-56" aria-label="Lugar de trabajo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los lugares</SelectItem>
            {organigramas.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </header>
  );
}

function Ayuda() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground"><HelpCircle className="mr-1.5 h-4 w-4" /> Cómo funciona</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 space-y-2 text-sm">
        <p className="font-semibold">Recibos digitales, paso a paso</p>
        <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
          <li><b className="text-foreground">Adhesión (una vez, en persona):</b> el trabajador declara su email y elige su PIN. Se imprime el acta, que nombra a la empresa que le paga el sueldo; la firman él y la empresa, y se sube escaneada. Si pasa a liquidarlo otra empresa, se renueva.</li>
          <li><b className="text-foreground">Importar:</b> se traen de Finnegans los PDF oficiales del mes.</li>
          <li><b className="text-foreground">Avisar:</b> un mail sin adjuntos ni importes avisa que están disponibles.</li>
          <li><b className="text-foreground">Firmar:</b> cada uno entra al portal desde el celular, lo lee y lo firma con su PIN, en conformidad o disconformidad.</li>
          <li><b className="text-foreground">Papel:</b> quien no adhirió o no firmó en 15 días lo recibe impreso y se sube el escaneo.</li>
        </ol>
        <p className="text-xs text-muted-foreground">
          Cada firma guarda el SHA-256 del PDF y se encadena con la anterior del mismo empleador. Cinco PIN incorrectos bloquean 15 minutos. El PIN lo
          cambia solo el trabajador; si lo olvida, se revoca y se renueva la adhesión. Art. 139 LCT (Ley 27.802), Ley 25.506 art. 5.
        </p>
      </PopoverContent>
    </Popover>
  );
}

/** Integridad de las cadenas de constancias: una por empleador (todas, sin filtrar). */
function SelloCadena({ cadenas }: { cadenas: CadenaEmpleador[] }) {
  const rotos = cadenas.reduce((s, c) => s + c.rotos, 0);
  const total = cadenas.reduce((s, c) => s + c.total, 0);
  const Icono = rotos ? ShieldAlert : ShieldCheck;
  const detalle = cadenas.map((c) => `${c.nombre}: ${c.total} firma(s)${c.rotos ? `, ${c.rotos} alterada(s)` : ''}`).join('\n');
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs', rotos ? 'border-red-500/50 text-red-600 dark:text-red-400' : 'border-border text-muted-foreground')}
      title={`Cada constancia de firma se encadena con la anterior del mismo empleador: si alguien modificara una, la cadena lo delata.${detalle ? `\n\n${detalle}` : ''}`}
    >
      <Icono className="h-3.5 w-3.5" />
      {rotos ? `${rotos} constancia(s) alterada(s)` : `Constancias íntegras (${total})`}
    </span>
  );
}

function PasoFirmas({ panel, error, onReintentar, onVer }: {
  panel: PanelRecibos | null;
  error: string | null;
  onReintentar: () => void;
  onVer: () => void;
}) {
  const r = panel?.resumen;
  const cerrados = r ? r.firmados + r.papel : 0;
  const pct = r && r.total ? Math.round((cerrados / r.total) * 100) : 0;
  const estado: EstadoPaso = !r || !r.total ? 'bloqueado' : r.noRetirados > 0 ? 'atencion' : cerrados === r.total ? 'hecho' : 'pendiente';
  return (
    <PasoCard
      n={3}
      titulo="Firmas"
      estado={estado}
      accion={r && r.total > 0 && <Button size="sm" variant="outline" onClick={onVer}>Ver recibos</Button>}
    >
      {!r ? (error ? <ErrorCarga error={error} onReintentar={onReintentar} /> : <p>Cargando…</p>)
        : !r.total ? <p>Sin recibos publicados todavía.</p> : (
        <>
          <div className="flex items-baseline justify-between">
            <p><b className="text-lg text-foreground tabular-nums">{r.firmados}</b> de {r.total} firmados</p>
            <span className="text-xs tabular-nums">{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p>
            {r.pendientes} pendiente(s){r.papel ? ` · ${r.papel} en papel` : ''}
            {r.noRetirados > 0 && <span className="text-amber-700 dark:text-amber-300"> · {r.noRetirados} no retirado(s)</span>}
          </p>
        </>
      )}
    </PasoCard>
  );
}

export default function GestionRecibosPage() {
  const { periodo, refrescar } = useNomina();
  const [filtros, setFiltros] = useState<Filtros>({ empleador: '', lugar: '' });
  const q = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v)).toString();
  const rec = useNominaData<RecibosData>(`/api/admin/nomina/recibos?${q}`);
  const panel = useNominaData<PanelRecibos>(`/api/admin/nomina/firma/panel?periodo=${periodo}${q ? `&${q}` : ''}`);
  const casos = useNominaData<CasoView[]>(`/api/admin/nomina/firma/casos?${q}`);
  const [tab, setTab] = useState('recibos');

  const encabezado = (extra?: ReactNode) => (
    <Encabezado extra={extra} filtros={filtros} onFiltros={setFiltros} empleadores={panel.data?.empleadores ?? []} />
  );
  const d = rec.data;
  if (!d) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {encabezado()}
        {rec.error ? <ErrorCarga error={rec.error} onReintentar={rec.reload} /> : <p className="text-sm text-muted-foreground">Cargando…</p>}
      </div>
    );
  }

  const sinCompletar = d.adhesiones.filter((a) => !a.adhesion?.completa).length;
  const abiertos = casos.data?.length ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {encabezado(<div className="flex items-center gap-2"><SelloCadena cadenas={d.cadenas} /><Ayuda /></div>)}
      <section className="grid gap-3 md:grid-cols-3" aria-label="Pasos del mes">
        <PasoImportar onCambio={refrescar} />
        <PasoAviso onEnviado={refrescar} />
        <PasoFirmas panel={panel.data} error={panel.error} onReintentar={panel.reload} onVer={() => setTab('recibos')} />
      </section>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList className="max-w-full justify-start overflow-x-auto overflow-y-hidden">
          <TabsTrigger value="recibos">Recibos del mes</TabsTrigger>
          <TabsTrigger value="adhesiones">
            Adhesiones{sinCompletar > 0 && <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 tabular-nums">{sinCompletar}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="casos">
            Disconformidades{abiertos > 0 && <Badge variant="destructive" className="ml-1.5 h-5 px-1.5 tabular-nums">{abiertos}</Badge>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="recibos">
          {panel.error && !panel.data ? <ErrorCarga error={panel.error} onReintentar={panel.reload} /> : <RecibosPeriodo panel={panel.data} onCambio={refrescar} />}
        </TabsContent>
        <TabsContent value="adhesiones"><AdhesionesTabla adhesiones={d.adhesiones} onCambio={refrescar} /></TabsContent>
        <TabsContent value="casos">
          {casos.error && !casos.data ? <ErrorCarga error={casos.error} onReintentar={casos.reload} /> : <CasosDisconformidad casos={casos.data} filtros={q} onCambio={refrescar} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
