'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  OrgEmpleado,
  OrgArea,
  OrgLinea,
  CreateOrgEmpleadoData,
  UpdateOrgEmpleadoData,
  CreateOrgAreaData,
  UpdateOrgAreaData,
  CreateOrgLineaData,
  UpdateOrgLineaData,
  OrganigramaCompleto,
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
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  // empleados
  createEmpleado: (data: CreateOrgEmpleadoData) => Promise<OrgEmpleado>;
  updateEmpleado: (id: number, data: UpdateOrgEmpleadoData) => Promise<OrgEmpleado>;
  deleteEmpleado: (id: number) => Promise<void>;
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
  const [empleados, setEmpleados] = useState<OrgEmpleado[]>([]);
  const [areas, setAreas] = useState<OrgArea[]>([]);
  const [lineas, setLineas] = useState<OrgLinea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ref para leer las áreas actuales dentro de updateArea sin recrear el callback
  const areasRef = useRef(areas);
  areasRef.current = areas;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await jsonFetch<OrganigramaCompleto>(BASE);
      setEmpleados(data.empleados);
      setAreas(data.areas);
      setLineas(data.lineas);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el organigrama');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // ── empleados ──
  const createEmpleado = useCallback(async (data: CreateOrgEmpleadoData) => {
    const emp = await jsonFetch<OrgEmpleado>(`${BASE}/empleados`, {
      method: 'POST',
      body: JSON.stringify(data),
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

  const deleteEmpleado = useCallback(async (id: number) => {
    await jsonFetch(`${BASE}/empleados/${id}`, { method: 'DELETE' });
    setEmpleados((prev) => prev.filter((e) => e.id !== id));
    // sus subordinados quedan sin jefe; las líneas que lo tocan se borran en server
    setEmpleados((prev) => prev.map((e) => (e.manager_id === id ? { ...e, manager_id: null } : e)));
    setLineas((prev) => prev.filter((l) => l.from_id !== id && l.to_id !== id));
  }, []);

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
      body: JSON.stringify(data),
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
      body: JSON.stringify(data),
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
      loading,
      error,
      reload,
      createEmpleado,
      updateEmpleado,
      deleteEmpleado,
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
      loading,
      error,
      reload,
      createEmpleado,
      updateEmpleado,
      deleteEmpleado,
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
