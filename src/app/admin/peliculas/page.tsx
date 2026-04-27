'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface MovieResult {
  title: string;
  year: string;
  imdbID: string;
  type: string;
  poster: string | null;
}

interface OnDemandMovie {
  id: number;
  imdbID: string;
  title: string;
  year: string;
  poster: string | null;
  background: string | null;
  logo: string | null;
  isActive: boolean;
}

export default function PeliculasPage() {
  const router = useRouter();

  const autoSearched = useRef(false);

  // ── Saved movies ──────────────────────────────────────────────
  const [saved, setSaved] = useState<OnDemandMovie[]>([]);
  const [tablePage, setTablePage] = useState(1);
  const TABLE_PAGE_SIZE = 10;
  const tablePageCount = Math.ceil(saved.length / TABLE_PAGE_SIZE);
  const pagedSaved = saved.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE);

  const fetchSaved = useCallback(async () => {
    const res = await fetch('/api/admin/on-demand');
    if (res.ok) {
      setSaved(await res.json());
      setTablePage(1);
    }
  }, []);

  useEffect(() => { fetchSaved(); }, [fetchSaved]);

  // ── Auto-search triggered from catalogue page ─────────────────
  useEffect(() => {
    if (autoSearched.current) return;
    const pending = sessionStorage.getItem('mwproxy.autosearch');
    if (pending) {
      sessionStorage.removeItem('mwproxy.autosearch');
      autoSearched.current = true;
      setQuery(pending);
      setSubmittedQuery(pending);
      doSearch(pending, 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleActive = async (id: number, isActive: boolean) => {
    await fetch(`/api/admin/on-demand/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    fetchSaved();
  };

  // ── OMDb search ───────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [results, setResults] = useState<MovieResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const totalPages = Math.ceil(totalResults / 10);

  const handleSelect = (movie: MovieResult) => {
    sessionStorage.setItem('omdb.selected_movie', JSON.stringify(movie));
    router.push(`/admin/peliculas/${movie.imdbID}`);
  };

  const doSearch = async (q: string, p: number) => {
    setLoading(true);
    setError('');
    setSearched(false);

    try {
      const res = await fetch(`/api/admin/omdb/search?q=${encodeURIComponent(q)}&page=${p}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data: { results: MovieResult[]; totalResults: number; page: number } = await res.json();
      setResults(data.results);
      setTotalResults(data.totalResults);
      setPage(data.page);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSubmittedQuery(q);
    doSearch(q, 1);
  };

  const handlePageChange = (newPage: number) => {
    doSearch(submittedQuery, newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-8">
      {/* ── Saved movies table ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Películas on demand</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Películas guardadas y disponibles para mostrar en el sitio
          </p>
        </div>

        {saved.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Sin películas guardadas</CardTitle>
              <CardDescription>
                Buscá una película abajo y guardala desde la pantalla de detalle.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Póster</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead className="w-20 hidden sm:table-cell">Año</TableHead>
                    <TableHead className="w-28 hidden md:table-cell">Fondo</TableHead>
                    <TableHead className="w-28 hidden md:table-cell">Logo</TableHead>
                    <TableHead className="w-28 text-center">Activa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedSaved.map(movie => (
                    <TableRow
                      key={movie.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        sessionStorage.setItem('omdb.selected_movie', JSON.stringify({
                          title: movie.title,
                          year: movie.year,
                          imdbID: movie.imdbID,
                          type: 'movie',
                          poster: movie.poster,
                        }));
                        router.push(`/admin/peliculas/${movie.imdbID}`);
                      }}
                    >
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="w-10 aspect-[2/3] overflow-hidden rounded bg-muted">
                          {movie.poster ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={movie.poster} alt={movie.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{movie.title}</div>
                        <Badge variant="secondary" className="mt-1 text-xs">{movie.imdbID}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {movie.year}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {movie.background ? (
                          <div className="w-20 aspect-video overflow-hidden rounded bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={movie.background} alt="" className="h-full w-full object-cover" />
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {movie.logo ? (
                          <div className="w-20 aspect-video overflow-hidden rounded bg-black flex items-center justify-center p-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={movie.logo} alt="" className="max-h-full max-w-full object-contain" />
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                        <Switch
                          checked={movie.isActive}
                          onCheckedChange={v => toggleActive(movie.id, v)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            {tablePageCount > 1 && (
              <div className="flex items-center justify-center gap-2 border-t p-3">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setTablePage(p => p - 1)}
                  disabled={tablePage <= 1}
                >
                  ← Anterior
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {tablePage} / {tablePageCount}
                </span>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setTablePage(p => p + 1)}
                  disabled={tablePage >= tablePageCount}
                >
                  Siguiente →
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* ── OMDb search ── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Buscar película</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Busque películas usando la base de datos OMDb
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 max-w-lg">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Nombre de la película..."
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !query.trim()}>
            {loading ? 'Buscando...' : 'Buscar'}
          </Button>
        </form>

        {error && (
          <div className="rounded-md border border-red-900/50 bg-red-950/30 p-4 text-red-300">
            {error}
          </div>
        )}

        {searched && results.length === 0 && !error && (
          <Card>
            <CardHeader>
              <CardTitle>Sin resultados</CardTitle>
              <CardDescription>
                No se encontraron películas para &quot;{submittedQuery}&quot;. Intente con otro término.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {totalResults} resultado{totalResults !== 1 ? 's' : ''} · página {page} de {totalPages}
            </p>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {results.map(movie => (
                <Card key={movie.imdbID} className="overflow-hidden">
                  <div className="aspect-[2/3] bg-muted">
                    {movie.poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={movie.poster} alt={movie.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        Sin póster
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <p className="text-sm font-medium leading-tight line-clamp-2">{movie.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{movie.year}</p>
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <Badge variant="secondary" className="text-xs">{movie.imdbID}</Badge>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 w-6 rounded-full p-0 text-base leading-none"
                        onClick={() => handleSelect(movie)}
                        title="Seleccionar película"
                      >
                        +
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page <= 1 || loading}>
                  ← Anterior
                </Button>
                <span className="text-sm text-muted-foreground px-2">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages || loading}>
                  Siguiente →
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
