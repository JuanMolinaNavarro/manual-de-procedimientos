'use client';

import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CONVENIOS, type Maestro } from '@/lib/nomina-datos';
import type { Config, MaestroRow } from '@/lib/nomina';
import { mensajeError, nominaFetch } from './api';
import { useNomina, useNominaData } from './NominaContext';
import { useLocal } from './useLocal';
import { Banner, ColHelp, EmpleadoCell, Estado, PageTitle } from './ui';

export default function MaestroPage() {
  const { organigramaId, listo, refrescar } = useNomina();
  const q = organigramaId != null ? `organigramaId=${organigramaId}` : null;
  const maestro = useNominaData<MaestroRow[]>(q ? `/api/admin/nomina/maestro?${q}` : null);
  const config = useNominaData<Config>(q ? `/api/admin/nomina/config?${q}` : null);
  const [rows, setRows] = useLocal(maestro.data);

  const estado = <Estado loading={maestro.loading} error={maestro.error} sinOrg={listo && organigramaId == null} />;
  if (!rows || organigramaId == null) return <><PageTitle title="Maestro de empleados" />{estado}</>;

  const original = (id: number) => maestro.data?.find((r) => r.empleado.id === id)?.maestro;

  function setLocalField(id: number, patch: Partial<Maestro>) {
    setRows((l) => (l ?? []).map((r) => (r.empleado.id === id ? { ...r, maestro: { ...r.maestro, ...patch } } : r)));
  }
  async function guardar(id: number, patch: Partial<Maestro>) {
    const o = original(id);
    if (o && Object.entries(patch).every(([k, v]) => o[k as keyof Maestro] === v)) return;
    setLocalField(id, patch);
    try {
      const r = await nominaFetch<MaestroRow>(`/api/admin/nomina/maestro/${id}`, { method: 'PUT', body: JSON.stringify({ organigramaId, ...patch }) });
      setRows((l) => (l ?? []).map((x) => (x.empleado.id === id ? r : x)));
      if ('incluir' in patch || 'basico' in patch) refrescar();
    } catch (e) { toast.error(mensajeError(e)); maestro.reload(); }
  }

  const cctDefault = config.data?.empresa.cctDefault || 'CCT 130/75';

  return (
    <div className="space-y-6">
      <PageTitle title="Maestro de empleados" sub="Datos estables de nómina: se cargan una vez y se actualizan solo ante cambios." />
      <Banner><b>Enlazado al organigrama:</b> nombre, rol y área se editan en el módulo Organigrama y llegan acá solos. Marcá <b>Incluir</b> para los que entran en la liquidación. El básico en rojo indica que falta cargarlo.</Banner>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Nómina <Badge variant="secondary">{rows.length}</Badge> <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Organigrama</Badge></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead className="text-center"><ColHelp label="Incluir" desc="Entra en la liquidación de este período." /></TableHead>
                  <TableHead><ColHelp label="CUIL" desc="Clave única de identificación laboral." /></TableHead>
                  <TableHead><ColHelp label="Ingreso" desc="Fecha de alta. Calcula la antigüedad sola." /></TableHead>
                  <TableHead className="text-right"><ColHelp label="Sueldo básico" desc="Bruto mensual de convenio o pactado, sin adicionales." /></TableHead>
                  <TableHead><ColHelp label="Categoría" desc="Categoría dentro del convenio." /></TableHead>
                  <TableHead><ColHelp label="Convenio" desc="Convenio colectivo aplicable." /></TableHead>
                  <TableHead><ColHelp label="CCT Nº" desc="Número del convenio. Vacío = el de Parámetros." /></TableHead>
                  <TableHead className="text-center"><ColHelp label="Afiliado" desc="Si aporta cuota sindical." /></TableHead>
                  <TableHead><ColHelp label="CBU" desc="Cuenta para acreditar el sueldo." /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ empleado: e, maestro: m }) => (
                  <TableRow key={e.id} className={cn(e.estado !== 'active' && 'opacity-60')}>
                    <TableCell><EmpleadoCell empleado={e} sub={`${e.rol}${e.area ? ' · ' + e.area : ''}`} /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={m.incluir} onCheckedChange={(v) => guardar(e.id, { incluir: v === true })} aria-label="Incluir en la liquidación" /></TableCell>
                    <TableCell><Input value={m.cuil} placeholder="20-12345678-9" onChange={(ev) => setLocalField(e.id, { cuil: ev.target.value })} onBlur={(ev) => guardar(e.id, { cuil: ev.target.value.trim() })} className="w-36" /></TableCell>
                    <TableCell><Input type="date" value={m.fechaIngreso} onChange={(ev) => setLocalField(e.id, { fechaIngreso: ev.target.value })} onBlur={(ev) => guardar(e.id, { fechaIngreso: ev.target.value })} className="w-40" /></TableCell>
                    <TableCell>
                      <Input
                        type="number" min={0} step={1000} value={m.basico || ''} placeholder="0"
                        onChange={(ev) => setLocalField(e.id, { basico: Number(ev.target.value) })}
                        onBlur={(ev) => guardar(e.id, { basico: Number(ev.target.value) || 0 })}
                        className={cn('w-32 text-right tabular-nums', m.incluir && !(m.basico > 0) && 'border-red-500 focus-visible:ring-red-500/40')}
                      />
                    </TableCell>
                    <TableCell><Input value={m.categoria} placeholder="Categoría" onChange={(ev) => setLocalField(e.id, { categoria: ev.target.value })} onBlur={(ev) => guardar(e.id, { categoria: ev.target.value.trim() })} className="w-32" /></TableCell>
                    <TableCell>
                      <Select value={m.convenio} onValueChange={(v) => guardar(e.id, { convenio: v })}>
                        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CONVENIOS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          {!(CONVENIOS as readonly string[]).includes(m.convenio) && <SelectItem value={m.convenio}>{m.convenio}</SelectItem>}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input value={m.cct} placeholder={cctDefault} onChange={(ev) => setLocalField(e.id, { cct: ev.target.value })} onBlur={(ev) => guardar(e.id, { cct: ev.target.value.trim() })} className="w-28" /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={m.afiliado} onCheckedChange={(v) => guardar(e.id, { afiliado: v === true })} aria-label="Afiliado al sindicato" /></TableCell>
                    <TableCell><Input value={m.cbu} placeholder="CBU (22 dígitos)" onChange={(ev) => setLocalField(e.id, { cbu: ev.target.value })} onBlur={(ev) => guardar(e.id, { cbu: ev.target.value.trim() })} className="w-52 font-mono text-xs" /></TableCell>
                  </TableRow>
                ))}
                {!rows.length && <TableRow><TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">Este organigrama no tiene empleados cargados.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
