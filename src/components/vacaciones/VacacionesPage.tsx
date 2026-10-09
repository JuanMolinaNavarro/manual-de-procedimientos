'use client';

/**
 * Vacaciones (RR.HH., `/admin/vacaciones`). El servidor manda la foto de la temporada
 * (`GET /api/admin/vacaciones`) y las pantallas la derivan con el mismo motor que valida cada
 * acción en el servidor (`vacaciones-calc.ts`). El filtro de Lugar es el organigrama de la ficha.
 * Tres secciones de uso diario (Solicitudes, Calendario, Personas) y Configuración aparte, que se
 * toca una o dos veces por temporada (rediseño 2026-10, pensado para usuarios de 35 a 50 años).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Download, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorCarga } from '@/components/comunes/ui';
import { apiFetch, descargar, mensajeError } from '@/components/comunes/api';
import {
  anticipos, convenioCodigo, diasDe, diasPorMes, incluidos, perfilDe, solDe, tramosEfectivos,
  type EmpleadoVac, type EstadoVac,
} from '@/lib/vacaciones-calc';
import CalendarioTab from './CalendarioTab';
import ConfiguracionTab from './ConfiguracionTab';
import PersonasTab from './PersonasTab';
import Revisar from './Revisar';
import SolicitudesTab, { grupoBandeja } from './SolicitudesTab';
import { BOTON, CAMPO, csv, diaMes, temporadaTxt } from './piezas';

interface Snapshot { estado: EstadoVac; organigramas: { id: number; nombre: string }[]; verSueldos: boolean }

export interface PropsTab {
  E: EstadoVac;
  /** Fichas del lugar elegido (todas, participen o no). */
  visibles: EmpleadoVac[];
  verSueldos: boolean;
  organigramas: Snapshot['organigramas'];
  recargar: () => void;
  /** Acción de RR.HH. sobre la selección de una persona; recarga la foto si sale bien. */
  accion: (empleadoId: number, body: Record<string, unknown>, ok?: string) => Promise<boolean>;
  /** PATCH/POST genérico a la API del módulo; recarga la foto si sale bien. */
  guardar: (url: string, metodo: 'PATCH' | 'POST', body: unknown, ok?: string) => Promise<boolean>;
  /** Cambia de sección; `extra` suma parámetros a la URL (`&sec=areas`). */
  irA: (tab: string, extra?: string) => void;
  /** Abre la revisión de la solicitud de una persona (null = vuelve a la bandeja). */
  verSolicitud: (id: number | null) => void;
}

const TABS = ['solicitudes', 'calendario', 'personas', 'configuracion'];
/** Pestañas de antes del rediseño: los enlaces viejos siguen andando. */
const VIEJAS: Record<string, [string, string?]> = {
  tablero: ['solicitudes'], areas: ['configuracion', 'areas'], parametros: ['configuracion'], auditoria: ['configuracion', 'historial'],
};
const TODOS = '__todos__';
const TITULO = 'text-[28px] leading-9 font-bold text-foreground';

export default function VacacionesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const tabUrl = sp.get('tab') ?? '';
  const [tab, secVieja] = VIEJAS[tabUrl] ?? [TABS.includes(tabUrl) ? tabUrl : 'solicitudes'];
  const seccion = sp.get('sec') ?? secVieja ?? 'temporada';
  const ver = Number(sp.get('ver')) || null;
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lugar, setLugar] = useState('');

  const recargar = useCallback(() => {
    apiFetch<Snapshot>('/api/admin/vacaciones')
      .then((s) => { setSnap(s); setError(null); })
      .catch((e: unknown) => setError(mensajeError(e)));
  }, []);
  useEffect(() => { recargar(); }, [recargar]);

  const irA = useCallback(
    (t: string, extra = '') => router.replace(`${pathname}?tab=${t}${extra}`, { scroll: false }),
    [router, pathname],
  );
  const verSolicitud = useCallback(
    (id: number | null) => router.replace(`${pathname}?tab=solicitudes${id ? `&ver=${id}` : ''}`),
    [router, pathname],
  );

  const guardar = useCallback(async (url: string, metodo: 'PATCH' | 'POST', body: unknown, ok?: string) => {
    try {
      await apiFetch(url, { method: metodo, body: JSON.stringify(body) });
      if (ok) toast.success(ok);
      recargar();
      return true;
    } catch (e) {
      toast.error(mensajeError(e));
      return false;
    }
  }, [recargar]);

  const accion = useCallback(
    (empleadoId: number, body: Record<string, unknown>, ok?: string) => guardar(`/api/admin/vacaciones/seleccion/${empleadoId}`, 'POST', body, ok),
    [guardar],
  );

  const visibles = useMemo(
    () => (snap ? snap.estado.empleados.filter((e) => !lugar || e.organigramaId === Number(lugar)) : []),
    [snap, lugar],
  );

  const E = snap?.estado;
  const temporada = E
    ? `Temporada ${temporadaTxt(E.config.ejercicio)} · del ${diaMes(E.config.temporadaDesde)} al ${diaMes(E.config.temporadaHasta)}`
    : '';

  if (!snap || !E) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <h1 className={TITULO}>Vacaciones</h1>
        {error ? <ErrorCarga error={error} onReintentar={recargar} /> : <Skeleton className="h-64 w-full rounded-xl" />}
      </div>
    );
  }

  const props: PropsTab = { E, visibles, verSueldos: snap.verSueldos, organigramas: snap.organigramas, recargar, accion, guardar, irA, verSolicitud };

  if (tab === 'configuracion') {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Button variant="ghost" className={`${BOTON} -ml-3`} onClick={() => irA('solicitudes')}><ArrowLeft className="h-5 w-5" /> Volver a Vacaciones</Button>
        <header>
          <h1 className={TITULO}>Configuración de la temporada</h1>
          <p className="mt-1 text-base text-muted-foreground">{temporada}</p>
        </header>
        {/* Configuración no muestra el filtro de lugar: trabaja siempre con todas las fichas. */}
        <ConfiguracionTab {...props} visibles={E.empleados} seccion={seccion} />
      </div>
    );
  }

  const revisando = tab === 'solicitudes' && ver ? E.empleados.find((e) => e.id === ver) : undefined;
  if (revisando) return <div className="mx-auto w-full max-w-5xl"><Revisar {...props} e={revisando} /></div>;

  const porAprobar = visibles.filter((e) => perfilDe(E, e.id).incluir && grupoBandeja(E, e.id) === 'aprobar').length;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={TITULO}>Vacaciones</h1>
          <p className="mt-1 text-base text-muted-foreground">{temporada}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={lugar || TODOS} onValueChange={(v) => setLugar(v === TODOS ? '' : v)}>
            <SelectTrigger className={`${CAMPO} w-full sm:w-56`} aria-label="Lugar de trabajo"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos los lugares</SelectItem>
              {snap.organigramas.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
          <Exportar snap={snap} visibles={visibles} />
          <Button variant="ghost" className={BOTON} onClick={() => irA('configuracion')}><Settings className="h-5 w-5" /> Configuración</Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(t) => irA(t)}>
        <TabsList variant="line" className="h-12 w-full justify-start gap-2 overflow-x-auto overflow-y-hidden border-b border-border">
          <TabsTrigger value="solicitudes" className="flex-none px-4 text-base">
            Solicitudes
            {porAprobar > 0 && (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-sm font-semibold text-primary-foreground tabular-nums">{porAprobar}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="calendario" className="flex-none px-4 text-base">Calendario</TabsTrigger>
          <TabsTrigger value="personas" className="flex-none px-4 text-base">Personas</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'solicitudes' && <SolicitudesTab {...props} />}
      {tab === 'calendario' && <CalendarioTab {...props} />}
      {tab === 'personas' && <PersonasTab {...props} />}
    </div>
  );
}

/** Planillas para Nómina y legajos, del lugar elegido. */
function Exportar({ snap, visibles }: { snap: Snapshot; visibles: EmpleadoVac[] }) {
  const E = snap.estado, ej = E.config.ejercicio;
  const ids = new Set(visibles.map((e) => e.id));
  const inc = incluidos(E).filter((e) => ids.has(e.id));

  function planilla() {
    const filas: (string | number | null)[][] = [[
      'Ejercicio', 'Empleado', 'Lugar', 'Área', 'Convenio', 'Ingreso', 'Antigüedad', 'Ley', 'Convenio extra', 'Beneficio', 'Arrastre',
      'Total', 'Estado', 'Desde', 'Hasta', 'Días', 'Tipo', 'Notificada', 'Acuse', 'Conformidad fraccionamiento',
    ]];
    for (const e of inc) {
      const s = solDe(E, e.id), d = diasDe(E, e.id), n = s.notificacion;
      const base = [ej, e.nombre, e.organigrama, e.area, convenioCodigo(E, e.id), e.fechaIngreso, d.anios, d.legales, d.convenio, d.beneficio, d.arrastre, d.total, s.estado];
      const cola = [n?.fecha ?? '', n?.acuse ?? '', s.acuerdoFracc?.fecha ?? ''];
      const tramos = tramosEfectivos(E, e.id);
      if (!tramos.length) filas.push([...base, '', '', 0, '', ...cola]);
      for (const t of tramos) {
        filas.push([...base, t.desde, t.hasta, t.dias, t.colectivo ? 'cierre colectivo' : t.reprog ? 'reprogramación' : 'vacaciones', ...cola]);
      }
    }
    descargar(`vacaciones_${ej}.csv`, csv(filas), 'text/csv');
  }

  function porMes() {
    const rows = diasPorMes(E).filter((r) => ids.has(r.empId));
    if (!rows.length) { toast.info('No hay vacaciones aprobadas para informar'); return; }
    descargar(`vacaciones_${ej}_dias_por_mes.csv`, csv([['Período', 'EmpleadoId', 'Empleado', 'Área', 'Días de vacaciones'], ...rows.map((r) => [r.mes, r.empId, r.nombre, r.area, r.dias])]), 'text/csv');
  }

  function aPagar() {
    const rows = anticipos(E).filter((a) => ids.has(a.empId));
    if (!rows.length) { toast.info('No hay vacaciones aprobadas para liquidar'); return; }
    descargar(`vacaciones_${ej}_anticipos.csv`, csv([
      ['Fecha de pago', 'EmpleadoId', 'Empleado', 'Área', 'Tipo', 'Desde', 'Hasta', 'Días', 'Remuneración base', 'Fuente', 'Criterio', 'Valor día (÷25)', 'Importe'],
      ...rows.map((a) => [a.pago, a.empId, a.nombre, a.area, a.tipo, a.desde, a.hasta, a.dias, a.base, a.fuente, a.criterio, a.valorDia, a.importe]),
    ]), 'text/csv');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={BOTON}><Download className="h-5 w-5" /> Exportar</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 text-base">
        <DropdownMenuItem onSelect={planilla}>Planilla de la temporada</DropdownMenuItem>
        <DropdownMenuItem onSelect={porMes}>Días por mes, para Nómina</DropdownMenuItem>
        {snap.verSueldos && <DropdownMenuItem onSelect={aPagar}>Lo que hay que pagar al inicio</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
