'use client';

/**
 * Estado compartido del módulo Asistencia.
 *
 * Los filtros viven en la URL, no en `useState`: Radix desmonta la pestaña
 * inactiva, así que con estado local cambiar de pestaña perdía todo. Además así
 * un rango filtrado se puede compartir por link y el Resumen puede mandar a
 * Fichadas con el filtro ya puesto.
 *
 * `personas` y `relojes` se piden una sola vez acá y no en cada pestaña.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FECHA_RE, hoyLocal, inicioDeMes } from '@/lib/asistencia-datos';
import { asistFetch, mensajeError, type Persona, type Reloj } from './api';

export interface EmpleadoOpt {
  id: number;
  nombre: string;
  rol: string;
  area: string;
  foto_archivo: string | null;
}

export const TABS = ['resumen', 'fichadas', 'personas', 'relojes'] as const;
export type TabAsistencia = (typeof TABS)[number];
export type VistaFichadas = 'detalle' | 'dia';

export interface FiltrosUI {
  tab: TabAsistencia;
  desde: string; // yyyy-mm-dd
  hasta: string; // yyyy-mm-dd, inclusive
  relojId: number | null;
  q: string;
  userId: string | null;
  vista: VistaFichadas;
  soloSospechosas: boolean;
  soloIncompletos: boolean;
  page: number;
}

const TAB_DEFAULT: TabAsistencia = 'resumen';

function defaults(): { desde: string; hasta: string } {
  const hoy = hoyLocal();
  return { desde: inicioDeMes(hoy), hasta: hoy };
}

function leerFiltros(sp: URLSearchParams): FiltrosUI {
  const def = defaults();
  const fecha = (v: string | null, fallback: string) => (v && FECHA_RE.test(v) ? v : fallback);
  const tab = sp.get('tab');
  const reloj = Number(sp.get('reloj'));
  return {
    tab: (TABS as readonly string[]).includes(tab ?? '') ? (tab as TabAsistencia) : TAB_DEFAULT,
    desde: fecha(sp.get('desde'), def.desde),
    hasta: fecha(sp.get('hasta'), def.hasta),
    relojId: Number.isFinite(reloj) && reloj > 0 ? reloj : null,
    q: sp.get('q') ?? '',
    userId: sp.get('persona') || null,
    vista: sp.get('vista') === 'dia' ? 'dia' : 'detalle',
    soloSospechosas: sp.get('dudosas') === '1',
    soloIncompletos: sp.get('incompletos') === '1',
    page: Math.max(1, Number(sp.get('page')) || 1),
  };
}

/** Solo lo que difiere del default va a la URL, para que el link sea legible. */
function serializar(f: FiltrosUI): string {
  const def = defaults();
  const p = new URLSearchParams();
  if (f.tab !== TAB_DEFAULT) p.set('tab', f.tab);
  if (f.desde !== def.desde) p.set('desde', f.desde);
  if (f.hasta !== def.hasta) p.set('hasta', f.hasta);
  if (f.relojId != null) p.set('reloj', String(f.relojId));
  if (f.q) p.set('q', f.q);
  if (f.userId) p.set('persona', f.userId);
  if (f.vista !== 'detalle') p.set('vista', f.vista);
  if (f.soloSospechosas) p.set('dudosas', '1');
  if (f.soloIncompletos) p.set('incompletos', '1');
  if (f.page > 1) p.set('page', String(f.page));
  return p.toString();
}

/** Filtros que acotan el resultado (el rango de fechas no cuenta: siempre hay uno). */
export function contarFiltrosActivos(f: FiltrosUI): number {
  return [f.relojId != null, !!f.q, !!f.userId, f.soloSospechosas, f.soloIncompletos].filter(Boolean).length;
}

// ─── Cache de recursos ──────────────────────────────────────────────────────
// Vive a nivel de módulo (no en useState) para sobrevivir al desmontaje del tab:
// volver a una pestaña repinta al instante y revalida atrás, sin parpadeo.

interface Entrada {
  data: unknown;
  error: string | null;
  stamp: string;
}

const cache = new Map<string, Entrada>();

function useRecurso<T>(url: string | null, version: number): { data: T | null; error: string | null; loading: boolean } {
  const [, forzar] = useState(0);
  const stamp = String(version);
  const entrada = url ? cache.get(url) : undefined;
  const fresca = entrada?.stamp === stamp;

  useEffect(() => {
    if (!url || cache.get(url)?.stamp === stamp) return;
    const ac = new AbortController();
    asistFetch<T>(url, { signal: ac.signal })
      .then((d) => {
        cache.set(url, { data: d, error: null, stamp });
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        cache.set(url, { data: null, error: mensajeError(e), stamp });
      })
      .finally(() => {
        if (!ac.signal.aborted) forzar((n) => n + 1);
      });
    return () => ac.abort();
  }, [url, stamp]);

  return {
    // Mientras revalida se sigue mostrando lo anterior.
    data: (entrada?.data as T | undefined) ?? null,
    error: fresca && entrada ? entrada.error : null,
    loading: !!url && !fresca,
  };
}

/** Datos de un endpoint del módulo, revalidados con `refrescar()`. */
export function useAsistenciaData<T>(url: string | null): { data: T | null; error: string | null; loading: boolean } {
  const { version } = useAsistencia();
  return useRecurso<T>(url, version);
}

interface AsistenciaCtx {
  f: FiltrosUI;
  set: (patch: Partial<FiltrosUI>) => void;
  limpiarFiltros: () => void;
  filtrosActivos: number;
  empleados: EmpleadoOpt[];
  empleadoPorId: Map<number, EmpleadoOpt>;
  personas: Persona[] | null;
  personasError: string | null;
  personaPorUserId: Map<string, Persona>;
  relojes: Reloj[] | null;
  relojesError: string | null;
  version: number;
  refrescar: () => void;
}

const Ctx = createContext<AsistenciaCtx | null>(null);

export function AsistenciaProvider({ empleados, children }: { empleados: EmpleadoOpt[]; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [version, setVersion] = useState(0);

  const f = useMemo(() => leerFiltros(new URLSearchParams(sp.toString())), [sp]);

  const set = useCallback(
    (patch: Partial<FiltrosUI>) => {
      const actual = leerFiltros(new URLSearchParams(sp.toString()));
      const next = { ...actual, ...patch };
      // Cambiar cualquier filtro invalida la página en la que estabas; moverse
      // de pestaña o de página, no.
      const soloNavegacion = Object.keys(patch).every((k) => k === 'page' || k === 'tab');
      if (!soloNavegacion) next.page = 1;
      const qs = serializar(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, pathname, router],
  );

  const limpiarFiltros = useCallback(() => {
    set({ relojId: null, q: '', userId: null, soloSospechosas: false, soloIncompletos: false });
  }, [set]);

  const refrescar = useCallback(() => setVersion((n) => n + 1), []);

  const personasRes = useRecurso<{ personas: Persona[] }>('/api/admin/asistencia/personas', version);
  const relojesRes = useRecurso<{ relojes: Reloj[] }>('/api/admin/asistencia/relojes', version);

  const personas = personasRes.data?.personas ?? null;
  const relojes = relojesRes.data?.relojes ?? null;

  const empleadoPorId = useMemo(() => new Map(empleados.map((e) => [e.id, e])), [empleados]);
  const personaPorUserId = useMemo(() => new Map((personas ?? []).map((p) => [p.userId, p])), [personas]);

  const value = useMemo<AsistenciaCtx>(
    () => ({
      f,
      set,
      limpiarFiltros,
      filtrosActivos: contarFiltrosActivos(f),
      empleados,
      empleadoPorId,
      personas,
      personasError: personasRes.error,
      personaPorUserId,
      relojes,
      relojesError: relojesRes.error,
      version,
      refrescar,
    }),
    [f, set, limpiarFiltros, empleados, empleadoPorId, personas, personasRes.error, personaPorUserId, relojes, relojesRes.error, version, refrescar],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAsistencia(): AsistenciaCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAsistencia debe usarse dentro de AsistenciaProvider');
  return ctx;
}
