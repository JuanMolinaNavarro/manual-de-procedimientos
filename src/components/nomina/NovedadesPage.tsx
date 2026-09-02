'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NOVEDAD_COLS, type Novedad } from '@/lib/nomina-datos';
import { periodLabel } from '@/lib/nomina-calc';
import type { NovedadRow } from '@/lib/nomina';
import { mensajeError, nominaFetch } from './api';
import { useNomina, useNominaData } from './NominaContext';
import { useLocal } from './useLocal';
import { Banner, ColHelp, EmpleadoCell, Empty, Estado, PageTitle } from './ui';

type Data = { cerrado: boolean; rows: NovedadRow[] };

export default function NovedadesPage() {
  const { organigramaId, periodo, listo } = useNomina();
  const q = organigramaId != null ? `organigramaId=${organigramaId}&periodo=${periodo}` : null;
  const nov = useNominaData<Data>(q ? `/api/admin/nomina/novedades?${q}` : null);
  const [data, setData] = useLocal(nov.data);

  const estado = <Estado loading={nov.loading} error={nov.error} sinOrg={listo && organigramaId == null} />;
  if (!data || organigramaId == null) return <><PageTitle title={`Novedades · ${periodLabel(periodo)}`} />{estado}</>;

  const original = (id: number) => nov.data?.rows.find((r) => r.empleado.id === id)?.novedad;
  function setLocal(id: number, patch: Partial<Novedad>) {
    setData((d) => d ? { ...d, rows: d.rows.map((r) => (r.empleado.id === id ? { ...r, novedad: { ...r.novedad, ...patch } } : r)) } : d);
  }
  async function guardar(id: number, patch: Partial<Novedad>) {
    if (data?.cerrado) { toast.error('Período cerrado: no se puede modificar'); return; }
    const o = original(id);
    if (o && Object.entries(patch).every(([k, v]) => o[k as keyof Novedad] === v)) return;
    setLocal(id, patch);
    try {
      const n = await nominaFetch<Novedad>(`/api/admin/nomina/novedades/${id}`, { method: 'PUT', body: JSON.stringify({ organigramaId, periodo, ...patch }) });
      setData((d) => d ? { ...d, rows: d.rows.map((r) => (r.empleado.id === id ? { ...r, novedad: n } : r)) } : d);
    } catch (e) { toast.error(mensajeError(e)); nov.reload(); }
  }

  const dis = data.cerrado;

  return (
    <div className="space-y-6">
      <PageTitle title={`Novedades · ${periodLabel(periodo)}`} sub="Lo único que cambia mes a mes. Horas en cantidad de horas, días en cantidad de días, el resto en pesos ($)." />
      {dis
        ? <Banner variant="locked">Este período está <b>cerrado</b>: las novedades quedaron congeladas. Para corregir, reabrí el período desde Histórico.</Banner>
        : <Banner><b>SAC:</b> cargalo manualmente en junio/diciembre (mejor sueldo del semestre ÷ 2). <b>Ganancias:</b> cargá la retención que calcule el contador. Ambos quedan así hasta definir el proceso con quien liquida.</Banner>}

      {!data.rows.length ? (
        <Empty title="No hay empleados incluidos">Marcá «Incluir» en el Maestro para empezar.</Empty>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">Carga mensual <Badge variant="secondary">{data.rows.length} empleados</Badge></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    {NOVEDAD_COLS.map((c) => <TableHead key={c.key} className="text-right"><ColHelp label={c.label} desc={c.desc} /></TableHead>)}
                    <TableHead><ColHelp label="Notas" desc="Observaciones libres del mes." /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map(({ empleado: e, novedad: n }) => (
                    <TableRow key={e.id}>
                      <TableCell><EmpleadoCell empleado={e} sub={e.area} /></TableCell>
                      {NOVEDAD_COLS.map((c) => (
                        <TableCell key={c.key}>
                          <Input
                            type="number" min={0} step={c.step} disabled={dis} value={n[c.key] || ''} placeholder="0"
                            onChange={(ev) => setLocal(e.id, { [c.key]: Number(ev.target.value) })}
                            onBlur={(ev) => guardar(e.id, { [c.key]: Number(ev.target.value) || 0 })}
                            className="w-24 text-right tabular-nums"
                            aria-label={c.label}
                          />
                        </TableCell>
                      ))}
                      <TableCell><Input value={n.notas} disabled={dis} placeholder="Notas…" onChange={(ev) => setLocal(e.id, { notas: ev.target.value })} onBlur={(ev) => guardar(e.id, { notas: ev.target.value })} className="min-w-40" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="flex justify-end">
        <Button asChild><Link href="/admin/nomina/liquidacion">Ver pre-liquidación <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
      </div>
    </div>
  );
}
