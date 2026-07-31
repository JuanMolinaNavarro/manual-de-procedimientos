"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Pencil, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Lead {
  id: number;
  nombre: string | null;
  apellido: string | null;
  telefono: string;
  email: string | null;
  direccion: string | null;
  plan: string | null;
  tv_pack: boolean | null;
  origen: string;
  contactado: boolean | null;
  resultado: string | null;
  asignado: string | null;
  created_at: string;
}

type DateFilter = "hoy" | "ayer" | "7d" | "30d" | "90d" | "todos";
type SortKey =
  | "nombre"
  | "telefono"
  | "email"
  | "direccion"
  | "plan"
  | "origen"
  | "fecha"
  | "contactado"
  | "resultado";
type SortDir = "asc" | "desc";
type Resultado =
  | "vendido"
  | "rechazado"
  | "repetido"
  | "ya_es_cliente"
  | "fuera_de_zona"
  | "otro"
  | null;

const PAGE_SIZE = 15;
const TZ = "America/Argentina/Buenos_Aires";

const FILTERS: { key: DateFilter; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "ayer", label: "Ayer" },
  { key: "7d", label: "Últimos 7 días" },
  { key: "30d", label: "Últimos 30 días" },
  { key: "90d", label: "Últimos 90 días" },
  { key: "todos", label: "Todos" },
];

const RESULTADO_OPTIONS: {
  value: Resultado;
  label: string;
  className: string;
}[] = [
  { value: null, label: "No contactado", className: "text-yellow-500" },
  { value: "vendido", label: "Vendido", className: "text-green-500" },
  { value: "rechazado", label: "Rechazado", className: "text-red-500" },
  { value: "repetido", label: "Repetido", className: "text-blue-500" },
  { value: "ya_es_cliente", label: "Ya es Cliente", className: "text-purple-900" },
  { value: "fuera_de_zona", label: "Fuera de zona", className: "text-orange-500" },
  { value: "otro", label: "Otro", className: "text-pink-400" },
];

function resultadoColor(resultado: string | null): string {
  if (resultado === "vendido") return "text-green-500";
  if (resultado === "rechazado") return "text-red-500";
  if (resultado === "repetido") return "text-blue-500";
  if (resultado === "ya_es_cliente") return "text-purple-900";
  if (resultado === "fuera_de_zona") return "text-orange-500";
  if (resultado === "otro") return "text-pink-400";
  return "text-yellow-500";
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-muted-foreground/40">↕</span>;
  return <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>;
}

function formatPlan(plan: string | null, tvPack: boolean | null): string {
  if (!plan) return '-';
  if (tvPack) return `${plan} + TV HD + Pack Fútbol`;
  return plan;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Returns "YYYY-MM-DD" in Argentine timezone for a given Date */
function toARDateString(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TZ });
}

function applyFilter(leads: Lead[], filter: DateFilter): Lead[] {
  if (filter === "todos") return leads;

  const now = new Date();
  const todayStr = toARDateString(now);

  if (filter === "hoy") {
    return leads.filter(
      (l) => toARDateString(new Date(l.created_at)) === todayStr,
    );
  }

  if (filter === "ayer") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toARDateString(yesterday);
    return leads.filter(
      (l) => toARDateString(new Date(l.created_at)) === yesterdayStr,
    );
  }

  const days = filter === "7d" ? 7 : filter === "30d" ? 30 : 90;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  return leads.filter((l) => new Date(l.created_at) >= cutoff);
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<DateFilter>("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [mostrarContactados, setMostrarContactados] = useState(true);
  const [editingAsignadoId, setEditingAsignadoId] = useState<number | null>(null);
  const [editingAsignadoValue, setEditingAsignadoValue] = useState("");
  const [editingNombreId, setEditingNombreId] = useState<number | null>(null);
  const [editingNombreValue, setEditingNombreValue] = useState("");

  const fetchLeads = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const response = await fetch("/api/admin/leads");
      if (!response.ok) throw new Error("Error al cargar los leads");
      const data = await response.json();
      setLeads(data);
      setError("");
    } catch (err) {
      setError("No se pudieron cargar los leads");
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, mostrarContactados]);

  const patchLead = useCallback(
    async (
      id: number,
      update: { contactado?: boolean; resultado?: string | null; asignado?: string | null; nombre?: string | null; apellido?: string | null },
    ) => {
      // Optimistic update
      setLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...update } : l)),
      );
      try {
        const res = await fetch(`/api/admin/leads/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(update),
        });
        if (!res.ok) throw new Error("Error al actualizar");
      } catch (err) {
        console.error(err);
        // Revert on failure
        fetchLeads();
      }
    },
    [fetchLeads],
  );

  const filteredLeads = useMemo(() => {
    const byDate = applyFilter(leads, filter);
    return mostrarContactados ? byDate : byDate.filter((l) => !l.contactado);
  }, [leads, filter, mostrarContactados]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  const sortedLeads = useMemo(() => {
    return [...filteredLeads].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "nombre":
          cmp = `${a.nombre ?? ""} ${a.apellido ?? ""}`.localeCompare(
            `${b.nombre ?? ""} ${b.apellido ?? ""}`,
          );
          break;
        case "telefono":
          cmp = a.telefono.localeCompare(b.telefono);
          break;
        case "email":
          cmp = (a.email ?? "").localeCompare(b.email ?? "");
          break;
        case "direccion":
          cmp = (a.direccion ?? "").localeCompare(b.direccion ?? "");
          break;
        case "plan":
          cmp = formatPlan(a.plan, a.tv_pack).localeCompare(
            formatPlan(b.plan, b.tv_pack),
          );
          break;
        case "origen":
          cmp = a.origen.localeCompare(b.origen);
          break;
        case "fecha":
          cmp =
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "contactado":
          cmp = Number(a.contactado ?? false) - Number(b.contactado ?? false);
          break;
        case "resultado":
          cmp = (a.resultado ?? "").localeCompare(b.resultado ?? "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredLeads, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / PAGE_SIZE));

  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedLeads.slice(start, start + PAGE_SIZE);
  }, [sortedLeads, currentPage]);

  const rangeStart =
    filteredLeads.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filteredLeads.length);

  const th = (key: SortKey, label: string, className = "") => (
    <TableHead
      className={`cursor-pointer select-none hover:text-foreground ${className}`}
      onClick={() => handleSort(key)}
    >
      {label}
      <SortIcon active={sortKey === key} dir={sortDir} />
    </TableHead>
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Cargando...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Ventas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Solicitudes de contratación recibidas desde los formularios externos
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchLeads(true)}
          disabled={refreshing}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Actualizar
        </Button>
      </div>

      {/* Date filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ key, label }) => (
          <Button
            key={key}
            variant={filter === key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Contactado filter */}
      <label className="flex items-center gap-2 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={mostrarContactados}
          onChange={(e) => setMostrarContactados(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <span className="text-sm text-muted-foreground">
          Incluir contactados
        </span>
      </label>

      {error && (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 p-4 text-red-300">
          {error}
        </div>
      )}

      {filteredLeads.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sin ventas</CardTitle>
            <CardDescription>
              {filter === "todos" && !mostrarContactados
                ? "Aún no se han recibido solicitudes de contratación."
                : "No hay ventas para el período y filtro seleccionados."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {th("nombre", "Nombre")}
                    {th("telefono", "Teléfono")}
                    {th("email", "Email")}
                    {th("direccion", "Dirección")}
                    {th("plan", "Plan")}
                    {th("origen", "Origen")}
                    {th("fecha", "Fecha")}
                    {th("contactado", "Contactado", "text-center")}
                    {th("resultado", "Resultado", "min-w-[160px]")}
                    <TableHead className="min-w-[160px]">Asignado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {editingNombreId === lead.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              type="text"
                              value={editingNombreValue}
                              onChange={(e) => setEditingNombreValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const [first, ...rest] = editingNombreValue.trim().split(" ");
                                  patchLead(lead.id, {
                                    nombre: first || null,
                                    apellido: rest.join(" ") || null,
                                  });
                                  setEditingNombreId(null);
                                } else if (e.key === "Escape") {
                                  setEditingNombreId(null);
                                }
                              }}
                              className="w-40 rounded border border-border bg-transparent px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            <button
                              onClick={() => {
                                const [first, ...rest] = editingNombreValue.trim().split(" ");
                                patchLead(lead.id, {
                                  nombre: first || null,
                                  apellido: rest.join(" ") || null,
                                });
                                setEditingNombreId(null);
                              }}
                              className="text-green-500 hover:text-green-400"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingNombreId(null)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 group">
                            <span>{[lead.nombre, lead.apellido].filter(Boolean).join(" ") || "-"}</span>
                            <button
                              onClick={() => {
                                setEditingNombreId(lead.id);
                                setEditingNombreValue(
                                  [lead.nombre, lead.apellido].filter(Boolean).join(" ")
                                );
                              }}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {lead.telefono}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.email ?? "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.direccion ?? "-"}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {formatPlan(lead.plan, lead.tv_pack)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {lead.origen}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDate(lead.created_at)}
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={lead.contactado ?? false}
                          onChange={(e) =>
                            patchLead(lead.id, { contactado: e.target.checked })
                          }
                          className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          value={lead.resultado ?? ""}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            const update: {
                              resultado: string | null;
                              contactado?: boolean;
                            } = { resultado: val };
                            if (val === "vendido" || val === "rechazado" || val === "repetido")
                              update.contactado = true;
                            patchLead(lead.id, update);
                          }}
                          className={`bg-transparent border border-border rounded px-2 py-1 text-sm cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring ${resultadoColor(lead.resultado)}`}
                        >
                          {RESULTADO_OPTIONS.map(
                            ({ value, label, className }) => (
                              <option
                                key={value ?? "null"}
                                value={value ?? ""}
                                className={className}
                              >
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {editingAsignadoId === lead.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              type="text"
                              value={editingAsignadoValue}
                              onChange={(e) => setEditingAsignadoValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  patchLead(lead.id, { asignado: editingAsignadoValue.trim() || null });
                                  setEditingAsignadoId(null);
                                } else if (e.key === "Escape") {
                                  setEditingAsignadoId(null);
                                }
                              }}
                              className="w-28 rounded border border-border bg-transparent px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            <button
                              onClick={() => {
                                patchLead(lead.id, { asignado: editingAsignadoValue.trim() || null });
                                setEditingAsignadoId(null);
                              }}
                              className="text-green-500 hover:text-green-400"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingAsignadoId(null)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 group">
                            <span className="text-sm text-muted-foreground">
                              {lead.asignado ?? "—"}
                            </span>
                            <button
                              onClick={() => {
                                setEditingAsignadoId(lead.id);
                                setEditingAsignadoValue(lead.asignado ?? "");
                              }}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
            <span>
              Mostrando {rangeStart}–{rangeEnd} de {filteredLeads.length} ventas
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <span className="text-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage === totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
