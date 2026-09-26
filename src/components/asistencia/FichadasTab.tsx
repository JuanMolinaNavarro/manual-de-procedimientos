'use client';

import { diaLocal } from '@/lib/fechas';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Search, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Banner, Empty, EmpleadoCell } from '@/components/comunes/ui';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';
import {
  FILAS_POR_PAGINA,
  tipoMarcaLabel,
  modoMarcaLabel,
  fmtHora,
  fmtHoraCorta,
  fmtFechaDia,
  PRESETS_RANGO,
  rangoPreset,
} from '@/lib/asistencia-datos';
import { mensajeError, type FichadaDetalle, type FichadaDia } from './api';
import { Campo, Chip, ControlesPeriodo, FiltroChip, LinkPerfil, Paginacion } from './piezas';
import { useAsistencia, useAsistenciaData } from './AsistenciaContext';

type Respuesta =
  | { vista: 'detalle'; items: FichadaDetalle[]; total: number; page: number; pageSize: number }
  | { vista: 'dia'; items: FichadaDia[]; total: number; page: number; pageSize: number; truncado: boolean };

export default function FichadasTab() {
  const { f, set, limpiarFiltros, filtrosActivos, relojes, personaPorUserId, refrescar } = useAsistencia();

  // El input no escribe en la URL en cada tecla: si no, se manda una request por
  // letra y una respuesta lenta de "Rod" puede pisar la de "Rodriguez".
  const [qLocal, setQLocal] = useState(f.q);
  const qDebounced = useDebouncedValue(qLocal, 300);
  useEffect(() => {
    if (qDebounced !== f.q) set({ q: qDebounced });
    // `f.q` cambia por la URL (p. ej. al limpiar filtros): se resincroniza abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced]);
  useEffect(() => {
    setQLocal((actual) => (actual === f.q ? actual : f.q));
  }, [f.q]);

  const params = useMemo(() => {
    const p = new URLSearchParams({ desde: f.desde, hasta: f.hasta, vista: f.vista });
    if (f.relojId) p.set('relojId', String(f.relojId));
    if (f.userId) p.set('userId', f.userId);
    if (f.q.trim()) p.set('q', f.q.trim());
    if (f.soloSospechosas) p.set('soloSospechosas', '1');
    if (f.vista === 'dia' && f.soloIncompletos) p.set('soloIncompletos', '1');
    return p;
  }, [f]);

  const { data, error, loading } = useAsistenciaData<Respuesta>(
    `/api/admin/asistencia/fichadas?${params}&page=${f.page}`,
  );

  const [exportando, setExportando] = useState(false);

  async function exportar() {
    setExportando(true);
    const id = toast.loading('Generando XLSX…');
    try {
      const res = await fetch(`/api/admin/asistencia/fichadas/export?${params}`);
      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try {
          const b = await res.json();
          if (b?.error) msg = b.error;
        } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `asistencia_${f.desde}_a_${f.hasta}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      toast.success('Planilla descargada.', { id });
    } catch (e) {
      // Antes esto era un window.location.href: un error del server dejaba al
      // usuario en una pantalla con JSON y sin sus filtros.
      toast.error(mensajeError(e), { id });
    } finally {
      setExportando(false);
    }
  }

  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? FILAS_POR_PAGINA;
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  const desdeFila = total === 0 ? 0 : (f.page - 1) * pageSize + 1;
  const hastaFila = Math.min(f.page * pageSize, total);
  const nombreReloj = relojes?.find((r) => r.id === f.relojId)?.nombre;
  const nombrePersona = f.userId ? (personaPorUserId.get(f.userId)?.nombre ?? f.userId) : null;

  return (
    <div className="space-y-4">
      {/* Filtros, de arriba abajo: período, luego el recorte, luego lo aplicado. */}
      <div className="space-y-3 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <ControlesPeriodo />

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" onClick={refrescar} disabled={loading} className="h-9">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Actualizar
            </Button>
            <Button variant="outline" onClick={exportar} disabled={exportando} className="h-9">
              <Download className="h-4 w-4" />
              {exportando ? 'Generando…' : total > 0 ? `Exportar ${total.toLocaleString('es-AR')}` : 'Exportar'}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <Campo label="Reloj">
            <Select
              value={f.relojId != null ? String(f.relojId) : 'todos'}
              onValueChange={(v) => set({ relojId: v === 'todos' ? null : Number(v) })}
            >
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(relojes ?? []).map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </Campo>

          <Campo label="Buscar persona">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={qLocal}
                placeholder="Nombre o legajo"
                onChange={(e) => setQLocal(e.target.value)}
                className="h-9 w-56 pl-8 pr-8"
              />
              {qLocal && (
                <button
                  type="button"
                  aria-label="Limpiar búsqueda"
                  onClick={() => setQLocal('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </Campo>

          <Campo label="Vista">
            <div className="flex h-9 items-center gap-1.5">
              <Chip activo={f.vista === 'detalle'} onClick={() => set({ vista: 'detalle' })}>Detalle</Chip>
              <Chip activo={f.vista === 'dia'} onClick={() => set({ vista: 'dia' })}>Por día</Chip>
            </div>
          </Campo>

          <Campo label="Solo mostrar">
            <div className="flex h-9 items-center gap-1.5">
              <Chip activo={f.soloSospechosas} onClick={() => set({ soloSospechosas: !f.soloSospechosas })}>
                Fechas dudosas
              </Chip>
              {f.vista === 'dia' && (
                <Chip activo={f.soloIncompletos} onClick={() => set({ soloIncompletos: !f.soloIncompletos })}>
                  Días sin salida
                </Chip>
              )}
            </div>
          </Campo>
        </div>

        {/* Lo aplicado, explícito: sin esto un resultado vacío es un misterio. */}
        {filtrosActivos > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">Filtrando por:</span>
            {nombrePersona && <FiltroChip onQuitar={() => set({ userId: null })}>Persona: {nombrePersona}</FiltroChip>}
            {nombreReloj && <FiltroChip onQuitar={() => set({ relojId: null })}>Reloj: {nombreReloj}</FiltroChip>}
            {f.q && <FiltroChip onQuitar={() => setQLocal('')}>Búsqueda: «{f.q}»</FiltroChip>}
            {f.soloSospechosas && <FiltroChip onQuitar={() => set({ soloSospechosas: false })}>Solo fechas dudosas</FiltroChip>}
            {f.soloIncompletos && f.vista === 'dia' && (
              <FiltroChip onQuitar={() => set({ soloIncompletos: false })}>Solo días sin salida</FiltroChip>
            )}
            <button
              type="button"
              onClick={() => { setQLocal(''); limpiarFiltros(); }}
              className="ml-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Limpiar todo
            </button>
          </div>
        )}
      </div>

      {f.soloSospechosas && (
        <Banner variant="info">
          Las fichadas con fecha imposible caen fuera de cualquier rango, así que este filtro ignora las fechas de arriba y busca en todo el histórico.
        </Banner>
      )}

      {error && <Banner variant="warn">{error}</Banner>}

      {data?.vista === 'dia' && data.truncado && (
        <Banner variant="warn">
          El rango es muy grande y se está mostrando solo una parte. Acotá las fechas para ver el total real.
        </Banner>
      )}

      {loading && !data ? (
        <TablaSkeleton columnas={f.vista === 'dia' ? 6 : 6} />
      ) : data && data.items.length === 0 ? (
        <SinResultados />
      ) : data ? (
        <div className={cn('space-y-3 transition-opacity', loading && 'opacity-60')}>
          <div className="overflow-x-auto rounded-lg border border-border">
            {data.vista === 'detalle' ? <TablaDetalle items={data.items} /> : <TablaDia items={data.items} />}
          </div>
          <Paginacion
            desdeFila={desdeFila}
            hastaFila={hastaFila}
            total={total}
            page={f.page}
            totalPaginas={totalPaginas}
            unidad={data.vista === 'dia' ? 'días' : 'fichadas'}
            onPage={(p) => set({ page: p })}
          />
        </div>
      ) : null}
    </div>
  );
}

function TablaDetalle({ items }: { items: FichadaDetalle[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha y hora</TableHead>
          <TableHead>Persona</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Reloj</TableHead>
          <TableHead className="hidden lg:table-cell">Modo</TableHead>
          <TableHead className="hidden md:table-cell">Origen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((r) => {
          const d = new Date(r.fechaHora);
          return (
            <TableRow key={r.id} className={cn(r.sospechosa && 'bg-amber-500/10')}>
              <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">
                <div className="text-muted-foreground">{fmtFechaDia(diaLocal(d))}</div>
                <div className="text-sm text-foreground">{fmtHora(r.fechaHora)}</div>
                {r.sospechosa && (
                  <Badge variant="outline" className="mt-1 border-amber-500 text-amber-600 dark:text-amber-400">fecha dudosa</Badge>
                )}
              </TableCell>
              <TableCell><PersonaCell userId={r.userId} nombre={r.nombre} /></TableCell>
              <TableCell><TipoBadge tipo={r.tipo} /></TableCell>
              <TableCell className="text-sm">{r.reloj}</TableCell>
              <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{modoMarcaLabel(r.modo)}</TableCell>
              <TableCell className="hidden md:table-cell"><Badge variant="secondary">{r.origen}</Badge></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function TablaDia({ items }: { items: FichadaDia[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Persona</TableHead>
          <TableHead>Entrada</TableHead>
          <TableHead>Salida</TableHead>
          <TableHead className="text-right">Marcas</TableHead>
          <TableHead className="hidden md:table-cell">Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((d) => (
          <TableRow key={`${d.userId}-${d.fecha}`} className={cn(d.incompleto && 'bg-amber-500/5')}>
            <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">{fmtFechaDia(d.fecha)}</TableCell>
            <TableCell><PersonaCell userId={d.userId} nombre={d.nombre} /></TableCell>
            <TableCell className="font-mono text-sm tabular-nums">{d.entrada ? fmtHoraCorta(d.entrada) : '—'}</TableCell>
            <TableCell className={cn('font-mono text-sm tabular-nums', !d.salida && 'text-amber-600 dark:text-amber-400')}>
              {d.salida ? fmtHoraCorta(d.salida) : '—'}
            </TableCell>
            <TableCell className="text-right tabular-nums">{d.marcas}</TableCell>
            <TableCell className="hidden md:table-cell">
              {d.incompleto
                ? <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">sin salida</Badge>
                : <Badge variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400">completo</Badge>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Avatar + nombre del organigrama; si la persona no está vinculada, lo avisa. */
function PersonaCell({ userId, nombre }: { userId: string; nombre: string }) {
  const { personaPorUserId, empleadoPorId } = useAsistencia();
  const persona = personaPorUserId.get(userId);
  const emp = persona?.empleadoId != null ? empleadoPorId.get(persona.empleadoId) : undefined;

  return (
    <LinkPerfil personaId={persona?.id} nombre={emp?.nombre ?? nombre}>
      <EmpleadoCell
        empleado={emp ?? { id: -1, nombre, foto_archivo: null }}
        sub={
          emp
            ? `${userId} · ${emp.rol}`
            : <span className="text-amber-600 dark:text-amber-400">{userId} · sin vincular</span>
        }
      />
    </LinkPerfil>
  );
}

function TipoBadge({ tipo }: { tipo: number }) {
  const estilo = tipo === 0 ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
    : tipo === 1 ? 'border-sky-500 text-sky-600 dark:text-sky-400'
    : tipo === 3 ? 'border-violet-500 text-violet-600 dark:text-violet-400'
    : 'border-border text-muted-foreground';
  return <Badge variant="outline" className={cn('whitespace-nowrap', estilo)}>{tipoMarcaLabel(tipo)}</Badge>;
}

/** Los tres vacíos son distintos y piden acciones distintas. */
function SinResultados() {
  const { f, relojes, filtrosActivos, limpiarFiltros, set } = useAsistencia();
  const hayFichadasCargadas = (relojes ?? []).some((r) => (r.reg_total ?? 0) > 0);

  if (!relojes?.length || !hayFichadasCargadas) {
    return (
      <Empty title="Todavía no hay fichadas">
        <span>Sincronizá un reloj o importá la base de CrossChex para empezar.</span>
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={() => set({ tab: 'relojes' })}>Ir a Relojes</Button>
        </div>
      </Empty>
    );
  }

  if (filtrosActivos > 0) {
    return (
      <Empty title={f.q ? `Ningún resultado para «${f.q}»` : 'Ningún resultado con estos filtros'}>
        <span>Probá quitando alguno de los filtros aplicados.</span>
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={limpiarFiltros}>Limpiar filtros</Button>
        </div>
      </Empty>
    );
  }

  return (
    <Empty title={`Sin fichadas entre el ${fmtFechaDia(f.desde)} y el ${fmtFechaDia(f.hasta)}`}>
      <span>Elegí otro período.</span>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {PRESETS_RANGO.map((p) => (
          <Chip key={p.id} activo={false} onClick={() => set(rangoPreset(p.id))}>{p.label}</Chip>
        ))}
      </div>
    </Empty>
  );
}

function TablaSkeleton({ columnas }: { columnas: number }) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      {Array.from({ length: FILAS_POR_PAGINA }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          {Array.from({ length: columnas - 1 }).map((_, j) => (
            <Skeleton key={j} className={cn('h-4', j === 0 ? 'w-48' : 'w-24')} />
          ))}
        </div>
      ))}
    </div>
  );
}




