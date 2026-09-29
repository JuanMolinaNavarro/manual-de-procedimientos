'use client';

/**
 * Estado compartido por los 7 sub-módulos de nómina: organigrama (empresa)
 * activo y período. Se persiste en localStorage y se lee con
 * useSyncExternalStore (snapshot nulo en el servidor: sin desfasaje de
 * hidratación ni setState en efectos). `refrescar()` invalida todo lo que
 * esté montado (cada hook de datos depende de `version`).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { periodoActual } from '@/lib/nomina-calc';
import { PERIODO_RE } from '@/lib/nomina-datos';
import type { EstadoPeriodo } from '@/lib/nomina';
import { nominaFetch } from './api';
import NominaBar from './NominaBar';

export interface OrganigramaOpcion { id: number; nombre: string }
export interface NominaLink { slug: string; label: string; href: string }

interface NominaCtx {
  organigramas: OrganigramaOpcion[];
  organigramaId: number | null;
  setOrganigramaId: (id: number) => void;
  periodo: string;
  setPeriodo: (p: string) => void;
  estado: EstadoPeriodo | null;
  version: number;
  refrescar: () => void;
  links: NominaLink[];
  /** true una vez hidratado (la persistencia ya se leyó). */
  listo: boolean;
  /** Puede adherir / cambiar PINs (admin de RR.HH.; nunca el superadmin). */
  puedeGestionarPin: boolean;
}

const Ctx = createContext<NominaCtx | null>(null);

const LS_ORG = 'nomina.organigramaId';
const LS_PER = 'nomina.periodo';

// localStorage como "external store": un canal de suscripción propio para que
// los cambios hechos desde esta pestaña se propaguen sin recargar.
const oyentes = new Set<() => void>();
function suscribir(cb: () => void) {
  oyentes.add(cb);
  const onStorage = () => cb();
  addEventListener('storage', onStorage);
  return () => { oyentes.delete(cb); removeEventListener('storage', onStorage); };
}
function leer(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function escribir(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch {}
  oyentes.forEach((cb) => cb());
}
const nulo = () => null;
const si = () => true;
const no = () => false;

/**
 * `barra = false`: sin la barra de Nómina (empresa/período/pestañas). La usa Gestión de
 * recibos, que es un módulo aparte con su propio encabezado pero comparte empresa y período.
 */
export function NominaProvider({ organigramas, links, puedeGestionarPin = false, barra = true, children }: { organigramas: OrganigramaOpcion[]; links: NominaLink[]; puedeGestionarPin?: boolean; barra?: boolean; children: ReactNode }) {
  const listo = useSyncExternalStore(() => () => {}, si, no);
  const orgStored = useSyncExternalStore(suscribir, () => leer(LS_ORG), nulo);
  const perStored = useSyncExternalStore(suscribir, () => leer(LS_PER), nulo);
  const [version, setVersion] = useState(0);
  const [estadoCache, setEstadoCache] = useState<{ key: string; estado: EstadoPeriodo | null } | null>(null);
  const pathname = usePathname();
  // Las impresiones (acta, recibo) van sin la barra de Nómina.
  const esImpresion = /\/(imprimir|acta)$/.test(pathname ?? '');

  const orgGuardado = Number(orgStored) || null;
  const organigramaId = listo
    ? (orgGuardado != null && organigramas.some((o) => o.id === orgGuardado) ? orgGuardado : organigramas[0]?.id ?? null)
    : null;
  const periodo = perStored && PERIODO_RE.test(perStored) ? perStored : periodoActual();

  const setOrganigramaId = useCallback((id: number) => escribir(LS_ORG, String(id)), []);
  const setPeriodo = useCallback((p: string) => { if (PERIODO_RE.test(p)) escribir(LS_PER, p); }, []);
  const refrescar = useCallback(() => setVersion((v) => v + 1), []);

  const keyEstado = organigramaId != null ? `${organigramaId}|${periodo}|${version}` : null;
  useEffect(() => {
    if (!keyEstado || organigramaId == null) return;
    let vivo = true;
    nominaFetch<EstadoPeriodo>(`/api/admin/nomina/estado?organigramaId=${organigramaId}&periodo=${periodo}`)
      .then((e) => { if (vivo) setEstadoCache({ key: keyEstado, estado: e }); })
      .catch(() => { if (vivo) setEstadoCache({ key: keyEstado, estado: null }); });
    return () => { vivo = false; };
  }, [keyEstado, organigramaId, periodo]);
  const estado = estadoCache && estadoCache.key === keyEstado ? estadoCache.estado : null;

  const value = useMemo<NominaCtx>(() => ({
    organigramas, organigramaId, setOrganigramaId, periodo, setPeriodo, estado, version, refrescar, links, listo, puedeGestionarPin,
  }), [organigramas, organigramaId, setOrganigramaId, periodo, setPeriodo, estado, version, refrescar, links, listo, puedeGestionarPin]);

  return (
    <Ctx.Provider value={value}>
      {barra && !esImpresion && <NominaBar />}
      {children}
    </Ctx.Provider>
  );
}

export function useNomina(): NominaCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNomina debe usarse dentro de NominaProvider');
  return ctx;
}

/**
 * Datos de un endpoint de nómina, refrescados con `version` del contexto.
 * `url` null = no pedir nada todavía. El resultado se guarda junto a la clave
 * que lo produjo: al cambiar la clave, `loading` se deriva solo.
 */
export function useNominaData<T>(url: string | null): { data: T | null; error: string | null; loading: boolean; reload: () => void } {
  const { version } = useNomina();
  const [local, setLocal] = useState(0);
  const [cache, setCache] = useState<{ key: string; data: T | null; error: string | null } | null>(null);
  const key = url ? `${url}#${version}#${local}` : null;

  useEffect(() => {
    if (!key || !url) return;
    let vivo = true;
    nominaFetch<T>(url)
      .then((d) => { if (vivo) setCache({ key, data: d, error: null }); })
      .catch((e: unknown) => { if (vivo) setCache({ key, data: null, error: e instanceof Error ? e.message : 'Error' }); });
    return () => { vivo = false; };
  }, [key, url]);

  const actual = cache && cache.key === key ? cache : null;
  return {
    // Mientras llega la versión nueva se sigue mostrando la anterior (sin parpadeo).
    data: actual ? actual.data : (cache?.data ?? null),
    error: actual?.error ?? null,
    loading: !!key && !actual,
    reload: () => setLocal((n) => n + 1),
  };
}
