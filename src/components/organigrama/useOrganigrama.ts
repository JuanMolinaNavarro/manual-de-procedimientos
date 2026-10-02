'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  OrgEmpleado,
  OrgArea,
  OrgLinea,
  Organigrama,
  CreateOrgEmpleadoData,
  UpdateOrgEmpleadoData,
  CreateOrgAreaData,
  UpdateOrgAreaData,
  CreateOrgLineaData,
  UpdateOrgLineaData,
  OrganigramaCompleto,
  EmpleadoOculto,
} from '@/lib/organigrama';

const BASE = '/api/admin/organigrama';

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init?.headers } : init?.headers,
  });
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export interface OrganigramaApi {
  empleados: OrgEmpleado[];
  areas: OrgArea[];
  lineas: OrgLinea[];
  /** Fichas quitadas del lienzo (no borradas), para restaurarlas. */
  ocultos: EmpleadoOculto[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  // organigramas (empresas/ubicaciones)
  organigramas: Organigrama[];
  orgId: number | null;
  setOrgId: (id: number) => void;
  createOrganigrama: (nombre: string, direccion?: string) => Promise<Organigrama>;
  updateOrganigrama: (
    id: number,
    data: { nombre?: string; direccion?: string | null },
  ) => Promise<Organigrama>;
  // empleados
  createEmpleado: (data: CreateOrgEmpleadoData) => Promise<OrgEmpleado>;
  updateEmpleado: (id: number, data: UpdateOrgEmpleadoData) => Promise<OrgEmpleado>;
  ocultarEmpleado: (id: number) => Promise<void>;
  restaurarEmpleado: (id: number) => Promise<void>;
  transferirEmpleado: (id: number, organigramaId: number, area: string) => Promise<void>;
  uploadFoto: (id: number, file: Blob) => Promise<string>;
  deleteFoto: (id: number) => Promise<void>;
  // áreas
  createArea: (data: CreateOrgAreaData) => Promise<OrgArea>;
  updateArea: (id: number, data: UpdateOrgAreaData) => Promise<OrgArea>;
  deleteArea: (id: number) => Promise<void>;
  // líneas
  createLinea: (data: CreateOrgLineaData) => Promise<OrgLinea>;
  updateLinea: (id: number, data: UpdateOrgLineaData) => Promise<OrgLinea>;
  deleteLinea: (id: number) => Promise<void>;
}

export function useOrganigrama(): OrganigramaApi {
  const [organigramas, setOrganigramas] = useState<Organigrama[]>([]);
  const [orgId, setOrgIdState] = useState<number | null>(null);
  const [empleados, setEmpleados] = useState<OrgEmpleado[]>([]);
  const [areas, setAreas] = useState<OrgArea[]>([]);
  const [lineas, setLineas] = useState<OrgLinea[]>([]);
  const [ocultos, setOcultos] = useState<EmpleadoOculto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // refs para leer valores actuales dentro de callbacks estables.
  const areasRef = useRef(areas);
  areasRef.current = areas;
  const orgIdRef = useRef<number | null>(orgId);
  orgIdRef.current = orgId;

  // Trae el grafo y lo aplica, sin tocar `loading` (lo usan ocultar/restaurar para no parpadear).
  const aplicarGrafo = useCallback(async (id: number) => {
    const data = await jsonFetch<OrganigramaCompleto>(`${BASE}?organigramaId=${id}`);
    setEmpleados(data.empleados);
    setAreas(data.areas);
    setLineas(data.lineas);
    setOcultos(data.ocultos);
  }, []);

  const loadGraph = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      await aplicarGrafo(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el organigrama');
    } finally {
      setLoading(false);
    }
  }, [aplicarGrafo]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await jsonFetch<Organigrama[]>(`${BASE}/organigramas`);
      setOrganigramas(list);
      const first = list[0]?.id ?? null;
      setOrgIdState(first);
      if (first != null) {
        await loadGraph(first);
      } else {
        setEmpleados([]);
        setAreas([]);
        setLineas([]);
        setOcultos([]);
        setLoading(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar las empresas');
      setLoading(false);
    }
  }, [loadGraph]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setOrgId = useCallback(
    (id: number) => {
      setOrgIdState(id);
      loadGraph(id);
    },
    [loadGraph],
  );

  const createOrganigrama = useCallback(async (nombre: string, direccion?: string) => {
    const org = await jsonFetch<Organigrama>(`${BASE}/organigramas`, {
      method: 'POST',
      body: JSON.stringify({ nombre, direccion }),
    });
    setOrganigramas((prev) => [...prev, org]);
    setOrgIdState(org.id);
    setEmpleados([]);
    setAreas([]);
    setLineas([]);
    setOcultos([]);
    return org;
  }, []);

  const updateOrganigrama = useCallback(
    async (id: number, data: { nombre?: string; direccion?: string | null }) => {
      const org = await jsonFetch<Organigrama>(`${BASE}/organigramas/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      setOrganigramas((prev) => prev.map((o) => (o.id === id ? org : o)));
      return org;
    },
    [],
  );

  // ── empleados ──
  const createEmpleado = useCallback(async (data: CreateOrgEmpleadoData) => {
    const emp = await jsonFetch<OrgEmpleado>(`${BASE}/empleados`, {
      method: 'POST',
      body: JSON.stringify({ ...data, organigrama_id: orgIdRef.current }),
    });
    setEmpleados((prev) => [...prev, emp]);
    return emp;
  }, []);

  const updateEmpleado = useCallback(async (id: number, data: UpdateOrgEmpleadoData) => {
    const emp = await jsonFetch<OrgEmpleado>(`${BASE}/empleados/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    setEmpleados((prev) => prev.map((e) => (e.id === id ? emp : e)));
    return emp;
  }, []);

  // Quitar del organigrama no borra nada (ver `ocultarEmpleado` en lib/organigrama). Se vuelve a
  // pedir el grafo: el servidor desengancha subordinados y jefaturas y filtra sus líneas.
  const ocultarEmpleado = useCallback(
    async (id: number) => {
      await jsonFetch(`${BASE}/empleados/${id}`, { method: 'DELETE' });
      if (orgIdRef.current != null) await aplicarGrafo(orgIdRef.current);
    },
    [aplicarGrafo],
  );

  const restaurarEmpleado = useCallback(
    async (id: number) => {
      await jsonFetch(`${BASE}/empleados/${id}`, { method: 'PATCH', body: JSON.stringify({ oculto: false }) });
      if (orgIdRef.current != null) await aplicarGrafo(orgIdRef.current);
    },
    [aplicarGrafo],
  );

  // Pasa la ficha a otro organigrama: sale de este lienzo y sus subordinados quedan sin jefe.
  const transferirEmpleado = useCallback(
    async (id: number, organigramaId: number, area: string) => {
      await jsonFetch(`${BASE}/empleados/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ organigrama_id: organigramaId, area }),
      });
      if (orgIdRef.current != null) await aplicarGrafo(orgIdRef.current);
    },
    [aplicarGrafo],
  );

  const uploadFoto = useCallback(async (id: number, file: Blob) => {
    const fd = new FormData();
    fd.append('foto', file, 'foto.jpg');
    const res = await fetch(`${BASE}/empleados/${id}/foto`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('No se pudo subir la foto');
    const { foto_archivo } = (await res.json()) as { foto_archivo: string };
    setEmpleados((prev) => prev.map((e) => (e.id === id ? { ...e, foto_archivo } : e)));
    return foto_archivo;
  }, []);

  const deleteFoto = useCallback(async (id: number) => {
    await jsonFetch(`${BASE}/empleados/${id}/foto`, { method: 'DELETE' });
    setEmpleados((prev) => prev.map((e) => (e.id === id ? { ...e, foto_archivo: null } : e)));
  }, []);

  // ── áreas ──
  const createArea = useCallback(async (data: CreateOrgAreaData) => {
    const area = await jsonFetch<OrgArea>(`${BASE}/areas`, {
      method: 'POST',
      body: JSON.stringify({ ...data, organigrama_id: orgIdRef.current }),
    });
    setAreas((prev) => [...prev, area]);
    return area;
  }, []);

  const updateArea = useCallback(async (id: number, data: UpdateOrgAreaData) => {
    const prevArea = areasRef.current.find((a) => a.id === id);
    const area = await jsonFetch<OrgArea>(`${BASE}/areas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    setAreas((prev) => prev.map((a) => (a.id === id ? area : a)));
    // si se renombró, migrar el área de los empleados localmente
    if (prevArea && data.nombre && data.nombre !== prevArea.nombre) {
      setEmpleados((prev) =>
        prev.map((e) => (e.area === prevArea.nombre ? { ...e, area: data.nombre! } : e)),
      );
    }
    return area;
  }, []);

  const deleteArea = useCallback(async (id: number) => {
    await jsonFetch(`${BASE}/areas/${id}`, { method: 'DELETE' });
    setAreas((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ── líneas ──
  const createLinea = useCallback(async (data: CreateOrgLineaData) => {
    const linea = await jsonFetch<OrgLinea>(`${BASE}/lineas`, {
      method: 'POST',
      body: JSON.stringify({ ...data, organigrama_id: orgIdRef.current }),
    });
    setLineas((prev) => [...prev, linea]);
    return linea;
  }, []);

  const updateLinea = useCallback(async (id: number, data: UpdateOrgLineaData) => {
    const linea = await jsonFetch<OrgLinea>(`${BASE}/lineas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    setLineas((prev) => prev.map((l) => (l.id === id ? linea : l)));
    return linea;
  }, []);

  const deleteLinea = useCallback(async (id: number) => {
    await jsonFetch(`${BASE}/lineas/${id}`, { method: 'DELETE' });
    setLineas((prev) => prev.filter((l) => l.id !== id));
  }, []);

  // Identidad estable del objeto devuelto: solo cambia cuando cambian los datos
  // (las funciones son useCallback estables). Sin esto, cada render devolvía un
  // objeto nuevo y los consumidores que dependían de `api` entraban en un loop de
  // render (React #185: "Maximum update depth exceeded").
  return useMemo(
    () => ({
      empleados,
      areas,
      lineas,
      ocultos,
      loading,
      error,
      reload,
      organigramas,
      orgId,
      setOrgId,
      createOrganigrama,
      updateOrganigrama,
      createEmpleado,
      updateEmpleado,
      ocultarEmpleado,
      restaurarEmpleado,
      transferirEmpleado,
      uploadFoto,
      deleteFoto,
      createArea,
      updateArea,
      deleteArea,
      createLinea,
      updateLinea,
      deleteLinea,
    }),
    [
      empleados,
      areas,
      lineas,
      ocultos,
      loading,
      error,
      reload,
      organigramas,
      orgId,
      setOrgId,
      createOrganigrama,
      updateOrganigrama,
      createEmpleado,
      updateEmpleado,
      ocultarEmpleado,
      restaurarEmpleado,
      transferirEmpleado,
      uploadFoto,
      deleteFoto,
      createArea,
      updateArea,
      deleteArea,
      createLinea,
      updateLinea,
      deleteLinea,
    ],
  );
}
