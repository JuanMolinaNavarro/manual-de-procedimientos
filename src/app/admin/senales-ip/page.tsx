'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import type { SaltoImporte, ContratoComprador, ContratoVendedor } from '@/lib/senales-ip';

interface DashboardData {
  alarmas: SaltoImporte[];
  compradores_count: number;
  vendedores_count: number;
}

// ─── AlarmaBanner ─────────────────────────────────────────────────────────────

function AlarmaBanner({
  alarmas,
  onMarcarVisto,
}: {
  alarmas: SaltoImporte[];
  onMarcarVisto: (id: number) => void;
}) {
  if (alarmas.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-yellow-700 dark:text-yellow-400">
        Alertas de precio ({alarmas.length})
      </h3>
      {alarmas.map((s) => (
        <div
          key={s.id}
          className="flex flex-wrap items-start justify-between gap-4 rounded-md border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-900/50 dark:bg-yellow-950/30"
        >
          <div className="space-y-1">
            <p className="font-medium text-yellow-900 dark:text-yellow-200">{s.descripcion}</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Fecha efectiva: {s.fecha_efectiva}
              {s.nuevo_precio && ` · Nuevo precio: ${s.nuevo_precio}`}
            </p>
            <p className="text-xs text-yellow-600 dark:text-muted-foreground">
              {s.contrato_comprador_id
                ? `Contrato Comprador #${s.contrato_comprador_id}`
                : `Contrato Vendedor #${s.contrato_vendedor_id}`}
              {` · Aviso con ${s.dias_aviso_previo} días de anticipación`}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onMarcarVisto(s.id)}
            className="shrink-0 border-yellow-400 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-900/50 dark:text-yellow-300 dark:hover:bg-yellow-900/20"
          >
            Marcar como visto
          </Button>
        </div>
      ))}
    </div>
  );
}

// ─── Carousel ─────────────────────────────────────────────────────────────────

interface CarouselItem {
  id: number;
  nombre_empresa: string;
  logo_nombre_archivo: string | null;
  activa: boolean;
  vigencia_hasta?: string | null;
  ejecutivo?: string | null;
  tipo: 'comprador' | 'vendedor';
}

function ContratoCarousel({
  items,
  title,
  onNavigate,
  onVerTodos,
}: {
  items: CarouselItem[];
  title: string;
  onNavigate: (id: number, tipo: 'comprador' | 'vendedor') => void;
  onVerTodos: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const VISIBLE = 3;

  const prev = () => setCurrent((c) => Math.max(0, c - 1));
  const next = () => setCurrent((c) => Math.min(items.length - VISIBLE, c + 1));

  const canPrev = current > 0;
  const canNext = current < items.length - VISIBLE;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <div className="flex items-center gap-1">
          {items.length > 0 && (
            <>
              <Button variant="ghost" size="icon" onClick={prev} disabled={!canPrev} className="h-7 w-7">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={next} disabled={!canNext} className="h-7 w-7">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" className="ml-1 text-xs" onClick={onVerTodos}>
            Ver todos →
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin contratos registrados.</p>
      ) : (
        <>
          <div className="overflow-hidden" ref={trackRef}>
            <div
              className="flex gap-3 transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(calc(-${current} * (100% / ${Math.min(items.length, VISIBLE)} + 4px)))` }}
            >
              {items.map((item) => (
                <div
                  key={item.id}
                  className="w-[calc(33.333%-8px)] min-w-[calc(33.333%-8px)] cursor-pointer"
                  onClick={() => onNavigate(item.id, item.tipo)}
                >
                  <Card className="h-full transition-colors hover:border-primary/50 hover:bg-accent">
                    <CardContent className="flex flex-col items-center gap-3 p-4">
                      <div className="flex h-20 w-full items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30">
                        {item.logo_nombre_archivo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/admin/senales-ip/${item.tipo === 'comprador' ? 'compradores' : 'vendedores'}/${item.id}/logo`}
                            alt={item.nombre_empresa}
                            className="max-h-full max-w-full object-contain p-2"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <Building2 className="h-10 w-10 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="w-full space-y-1 text-center">
                        <p className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
                          {item.nombre_empresa}
                        </p>
                        {item.ejecutivo && (
                          <p className="truncate text-xs text-muted-foreground">{item.ejecutivo}</p>
                        )}
                        <div className="flex flex-wrap items-center justify-center gap-1 pt-0.5">
                          <Badge variant={item.activa ? 'default' : 'secondary'} className="text-xs">
                            {item.activa ? 'Activo' : 'Inactivo'}
                          </Badge>
                          {item.vigencia_hasta && (
                            <Badge variant="outline" className="text-xs">
                              hasta {item.vigencia_hasta}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
          <p className="text-right text-xs text-muted-foreground">
            {current + 1}–{Math.min(current + VISIBLE, items.length)} de {items.length}
          </p>
        </>
      )}
    </div>
  );
}

// ─── SaltosTable ──────────────────────────────────────────────────────────────

function SaltosTable({
  saltos,
  onMarcarVisto,
  onEliminar,
  onNuevo,
}: {
  saltos: SaltoImporte[];
  onMarcarVisto: (id: number) => void;
  onEliminar: (id: number) => void;
  onNuevo: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-base font-semibold text-foreground">Saltos de precio</h3>
        <Button size="sm" onClick={onNuevo}>+ Nuevo salto</Button>
      </div>

      {saltos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay saltos de precio configurados.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Fecha efectiva</TableHead>
                  <TableHead className="hidden sm:table-cell">Nuevo precio</TableHead>
                  <TableHead className="hidden md:table-cell">Aviso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saltos.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.descripcion}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.contrato_comprador_id
                        ? `Comprador #${s.contrato_comprador_id}`
                        : s.contrato_vendedor_id
                          ? `Vendedor #${s.contrato_vendedor_id}`
                          : '-'}
                    </TableCell>
                    <TableCell>{s.fecha_efectiva}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {s.nuevo_precio ?? '-'}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {s.dias_aviso_previo} días
                    </TableCell>
                    <TableCell>
                      {s.notificado_at ? (
                        <Badge variant="secondary">Visto</Badge>
                      ) : (
                        <Badge variant="default">Pendiente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!s.notificado_at && (
                          <Button variant="ghost" size="sm" onClick={() => onMarcarVisto(s.id)}>
                            Marcar visto
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => onEliminar(s.id)}>
                          Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SenalesIpPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>({ alarmas: [], compradores_count: 0, vendedores_count: 0 });
  const [compradores, setCompradores] = useState<ContratoComprador[]>([]);
  const [vendedores, setVendedores] = useState<ContratoVendedor[]>([]);
  const [saltos, setSaltos] = useState<SaltoImporte[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [dashRes, compRes, vendRes, saltosRes] = await Promise.all([
        fetch('/api/admin/senales-ip'),
        fetch('/api/admin/senales-ip/compradores'),
        fetch('/api/admin/senales-ip/vendedores'),
        fetch('/api/admin/senales-ip/saltos'),
      ]);
      if (dashRes.ok) setData(await dashRes.json());
      if (compRes.ok) setCompradores(await compRes.json());
      if (vendRes.ok) setVendedores(await vendRes.json());
      if (saltosRes.ok) setSaltos(await saltosRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleMarcarVisto = async (id: number) => {
    setData((prev) => ({ ...prev, alarmas: prev.alarmas.filter((a) => a.id !== id) }));
    setSaltos((prev) => prev.map((s) => s.id === id ? { ...s, notificado_at: new Date() } : s));
    await fetch(`/api/admin/senales-ip/saltos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificado: true }),
    });
  };

  const handleEliminarSalto = async (id: number) => {
    if (!window.confirm('¿Eliminar este salto de precio?')) return;
    await fetch(`/api/admin/senales-ip/saltos/${id}`, { method: 'DELETE' });
    setSaltos((prev) => prev.filter((s) => s.id !== id));
  };

  const compradoresItems: CarouselItem[] = compradores.map((c) => ({
    id: c.id,
    nombre_empresa: c.nombre_empresa,
    logo_nombre_archivo: c.logo_nombre_archivo,
    activa: c.activa,
    vigencia_hasta: c.vigencia_hasta,
    ejecutivo: c.ejecutivo_a_cargo,
    tipo: 'comprador',
  }));

  const vendedoresItems: CarouselItem[] = vendedores.map((v) => ({
    id: v.id,
    nombre_empresa: v.nombre_empresa,
    logo_nombre_archivo: v.logo_nombre_archivo,
    activa: v.activa,
    vigencia_hasta: v.vigencia_hasta,
    ejecutivo: v.ejecutivo_cargo,
    tipo: 'vendedor',
  }));

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Cargando...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Señales IP</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestión de contratos de compradores y vendedores de señales IP.
          </p>
        </div>
      </div>

      <AlarmaBanner alarmas={data.alarmas} onMarcarVisto={handleMarcarVisto} />

      {/* Carousels */}
      <div className="space-y-8">
        <ContratoCarousel
          items={compradoresItems}
          title={`Compradores (${data.compradores_count})`}
          onNavigate={(id) => router.push(`/admin/senales-ip/compradores/${id}`)}
          onVerTodos={() => router.push('/admin/senales-ip/compradores')}
        />

        <div className="h-px bg-border" />

        <ContratoCarousel
          items={vendedoresItems}
          title={`Vendedores (${data.vendedores_count})`}
          onNavigate={(id) => router.push(`/admin/senales-ip/vendedores/${id}`)}
          onVerTodos={() => router.push('/admin/senales-ip/vendedores')}
        />

        <div className="h-px bg-border" />

        <SaltosTable
          saltos={saltos}
          onMarcarVisto={handleMarcarVisto}
          onEliminar={handleEliminarSalto}
          onNuevo={() => router.push('/admin/senales-ip/saltos/nuevo')}
        />
      </div>
    </div>
  );
}
