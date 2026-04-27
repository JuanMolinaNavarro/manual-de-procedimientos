"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 20;

interface CatalogEntry {
  id: number;
  mwproxy_id: number;
  name: string;
  year: number | null;
  available: boolean;
  imdb_id: string | null;
  imdb_rating: number | null;
  imdb_votes: number | null;
  enriched_at: string | null;
}

type SortKey = "name" | "year" | "available" | "imdb_rating" | "imdb_votes";
type SortDir = "asc" | "desc";

interface PipelineStatus {
  running: boolean;
  lastRun: string | null;
  catalogCount: number;
  onDemandCount: number;
}

interface PipelineResult {
  vodsTotal: number;
  omdbFound: number;
  catalogSaved: number;
  top10: Array<{ name: string; imdbID: string; imdbRating: number }>;
  onDemandSaved: number;
  ranAt: string;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-muted-foreground/40">↕</span>;
  return <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>;
}

export default function CatalogoPage() {
  const router = useRouter();

  // ── Pipeline sync ─────────────────────────────────────────────
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<PipelineResult | null>(null);
  const [syncError, setSyncError] = useState("");

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/admin/pipeline/status");
      if (res.ok) setPipelineStatus(await res.json());
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncError("");
    try {
      const res = await fetch("/api/admin/pipeline/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSyncResult(data as PipelineResult);
      await loadCatalog();
      await fetchStatus();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Error al sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  // ── Catalog data ──────────────────────────────────────────────
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [filtered, setFiltered] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // ── Sort ──────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>("imdb_votes");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const loadCatalog = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/mwproxy/catalog");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error(data.error ?? "Error al cargar");
      setCatalog(data);
      setFiltered(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCatalog(); }, []);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    setFiltered(q ? catalog.filter((e) => e.name.toLowerCase().includes(q)) : catalog);
    setPage(1);
  }, [search, catalog]);

  // ── Sort + paginate ───────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "imdb_rating" || key === "imdb_votes" ? "desc" : "asc");
    }
    setPage(1);
  };

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "name":      cmp = a.name.localeCompare(b.name); break;
      case "year":      cmp = (a.year ?? 0) - (b.year ?? 0); break;
      case "available": cmp = Number(a.available) - Number(b.available); break;
      case "imdb_rating": cmp = (a.imdb_rating ?? -1) - (b.imdb_rating ?? -1); break;
      case "imdb_votes":  cmp = (a.imdb_votes ?? -1) - (b.imdb_votes ?? -1); break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const slice = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleImport = (entry: CatalogEntry) => {
    sessionStorage.setItem("mwproxy.autosearch", entry.name);
    router.push("/admin/peliculas");
  };

  const th = (key: SortKey, label: string, className = "") => (
    <TableHead
      className={`cursor-pointer select-none hover:text-foreground ${className}`}
      onClick={() => handleSort(key)}
    >
      {label}
      <SortIcon active={sortKey === key} dir={sortDir} />
    </TableHead>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Catálogo del proveedor
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Películas almacenadas en el catálogo (excluye Capítulos y Documentales)
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/peliculas")}>
          ← Volver
        </Button>
      </div>

      {/* ── Pipeline sync panel ── */}
      <div className="rounded-lg border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Sincronización automática</p>
          <p className="text-xs text-muted-foreground">
            Se ejecuta diariamente a las 00:10 (UTC-3). Busca en MwProxy → OMDb → Fanart y actualiza el top 10 en on-demand.
          </p>
          {pipelineStatus?.lastRun && (
            <p className="text-xs text-muted-foreground">
              Última ejecución: {new Date(pipelineStatus.lastRun).toLocaleString("es-AR")}
              {pipelineStatus.catalogCount > 0 &&
                ` · ${pipelineStatus.catalogCount} en catálogo · ${pipelineStatus.onDemandCount} en on-demand`}
            </p>
          )}
          {syncResult && (
            <p className="text-xs text-green-400">
              ✓ {syncResult.omdbFound} encontradas en OMDb · top 10 guardado en on-demand
            </p>
          )}
          {syncError && <p className="text-xs text-red-400">{syncError}</p>}
        </div>
        <Button onClick={handleSync} disabled={syncing} variant="outline">
          {syncing ? "Sincronizando... (puede tardar varios minutos)" : "Sincronizar ahora"}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 p-4 text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          Cargando catálogo...
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Input
              className="max-w-xs"
              placeholder="Filtrar por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="text-sm text-muted-foreground">
              {filtered.length} película{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Sin resultados</CardTitle>
                <CardDescription>
                  No hay películas que coincidan con &quot;{search}&quot;.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {th("name", "Nombre")}
                      {th("year", "Año", "w-20")}
                      {th("available", "Disponible", "w-28 text-center")}
                      {th("imdb_rating", "Rating", "w-24 text-center")}
                      {th("imdb_votes", "Votos", "w-32 text-right hidden lg:table-cell")}
                      <TableHead className="w-28 hidden xl:table-cell">IMDb ID</TableHead>
                      <TableHead className="w-28" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slice.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.year ?? "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {entry.available ? (
                            <Badge className="text-xs bg-green-700 hover:bg-green-700">Sí</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">No</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {entry.imdb_rating != null ? (
                            <span className="font-semibold text-yellow-400">
                              ★ {entry.imdb_rating}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right hidden lg:table-cell text-muted-foreground text-xs">
                          {entry.imdb_votes != null
                            ? entry.imdb_votes.toLocaleString("es-AR")
                            : "—"}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell font-mono text-xs">
                          {entry.imdb_id ? (
                            <a
                              href={`https://www.imdb.com/title/${entry.imdb_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                            >
                              {entry.imdb_id}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleImport(entry)}
                          >
                            Importar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
              >
                ← Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >
                Siguiente →
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
