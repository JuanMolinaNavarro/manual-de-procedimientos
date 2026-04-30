'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface EventCard {
  idEvent: string;
  strEvent: string;
  strHomeTeam: string | null;
  strAwayTeam: string | null;
  strLeague: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  label: string;
  labelColor: string;
  timeLocal: string | null;
  dateFormatted: string;
}

interface FeaturedCard extends EventCard {
  type: string;
  borderColor: string;
}

interface SyncStatus {
  running: boolean;
  lastSync: string | null;
  eventCount: number;
  featuredCount: number;
}

interface SportsData {
  featured: FeaturedCard[];
  events: EventCard[];
}

function formatLastSync(iso: string | null): string {
  if (!iso) return 'Nunca';
  const d = new Date(iso);
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function DeportesPage() {
  const [data, setData] = useState<SportsData>({ featured: [], events: [] });
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/deportes/data');
      if (res.ok) {
        const d: SportsData = await res.json();
        setData(d);
      }
    } catch {
      // silently retry on next poll
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/deportes/sync');
      if (!res.ok) return;
      const s: SyncStatus = await res.json();
      setStatus(s);
      if (!s.running && syncing) {
        // Sync just finished
        setSyncing(false);
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        fetchData();
      }
    } catch {
      // ignore
    }
  }, [syncing, fetchData]);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await fetch('/api/admin/deportes/sync').catch(() => null);
      if (!res?.ok) return;
      const s: SyncStatus = await res.json();
      setStatus(s);
      if (!s.running) {
        setSyncing(false);
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        fetchData();
      }
    }, 2000);
  }, [fetchData]);

  const handleSync = async () => {
    setError('');
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/deportes/sync', { method: 'POST' });
      if (res.status === 409) {
        setError('Ya hay una sincronización en curso.');
        setSyncing(false);
        return;
      }
      if (!res.ok) {
        setError('Error al iniciar la sincronización.');
        setSyncing(false);
        return;
      }
      startPolling();
    } catch {
      setError('Error de conexión al iniciar la sincronización.');
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Deportes</h2>
          <p className="text-sm text-muted-foreground">
            Eventos del día desde TheSportsDB — sincronización manual
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {status && (
            <span className="text-sm text-muted-foreground">
              Última sync: {formatLastSync(status.lastSync)}
              {' · '}
              {status.eventCount} evento{status.eventCount !== 1 ? 's' : ''}
              {' · '}
              {status.featuredCount} destacado{status.featuredCount !== 1 ? 's' : ''}
            </span>
          )}
          <Button onClick={handleSync} disabled={syncing}>
            {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </Button>
        </div>
      </div>

      {/* Sync in-progress notice */}
      {syncing && (
        <div className="rounded-md border border-orange-900/50 bg-orange-950/20 p-4 text-sm text-orange-300">
          Sincronización en curso — puede tardar hasta 20 segundos. No cierre esta página.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Featured table */}
      <Card>
        <CardHeader>
          <CardTitle>Destacados ({data.featured.length})</CardTitle>
          <CardDescription>Tarucas, equipos favoritos y Fórmula 1</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.featured.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              {loading ? 'Cargando...' : 'Sin eventos destacados. Sincronice para actualizar.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Tipo</TableHead>
                  <TableHead>Partido</TableHead>
                  <TableHead className="hidden sm:table-cell">Liga</TableHead>
                  <TableHead className="w-24 hidden md:table-cell">Fecha</TableHead>
                  <TableHead className="w-28 text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.featured.map(e => (
                  <TableRow key={e.idEvent}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{ borderColor: e.borderColor, color: e.borderColor }}
                      >
                        {e.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{e.strHomeTeam ?? '—'} vs {e.strAwayTeam ?? '—'}</div>
                      {e.intHomeScore !== null && e.intAwayScore !== null && (
                        <div className="text-sm text-muted-foreground">
                          {e.intHomeScore} - {e.intAwayScore}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {e.strLeague}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {e.dateFormatted}
                      {e.timeLocal && <span className="ml-1">· {e.timeLocal}</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        style={{
                          backgroundColor: e.labelColor + '22',
                          color: e.labelColor,
                          border: `1px solid ${e.labelColor}55`,
                        }}
                      >
                        {e.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Regular events table */}
      <Card>
        <CardHeader>
          <CardTitle>Eventos del Día ({data.events.length})</CardTitle>
          <CardDescription>Partidos filtrados por liga y equipo</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.events.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              {loading ? 'Cargando...' : 'Sin eventos. Sincronice para actualizar.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell w-36">Liga</TableHead>
                  <TableHead>Partido</TableHead>
                  <TableHead className="hidden md:table-cell w-24">Fecha</TableHead>
                  <TableHead className="w-28 text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.events.map(e => (
                  <TableRow key={e.idEvent}>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary">{e.strLeague}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{e.strHomeTeam ?? '—'} vs {e.strAwayTeam ?? '—'}</div>
                      {e.intHomeScore !== null && e.intAwayScore !== null && (
                        <div className="text-sm text-muted-foreground">
                          {e.intHomeScore} - {e.intAwayScore}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {e.dateFormatted}
                      {e.timeLocal && <span className="ml-1">· {e.timeLocal}</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        style={{
                          backgroundColor: e.labelColor + '22',
                          color: e.labelColor,
                          border: `1px solid ${e.labelColor}55`,
                        }}
                      >
                        {e.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
