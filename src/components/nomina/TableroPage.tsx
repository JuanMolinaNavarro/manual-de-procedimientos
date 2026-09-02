'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { METRICA_META } from '@/lib/nomina-datos';
import { fechaHora, money, periodLabel } from '@/lib/nomina-calc';
import type { BonoCardData, TableroData } from '@/lib/nomina';
import { mensajeError, nominaFetch } from './api';
import { useNomina, useNominaData } from './NominaContext';
import { EmpleadoCell, Estado, PageTitle, StatCard } from './ui';

function Paso({ n, done, current, title, desc }: { n: number; done: boolean; current: boolean; title: string; desc: string }) {
  return (
    <div className={cn('rounded-lg border p-3', done ? 'border-emerald-500/50 bg-emerald-500/5' : current ? 'border-primary bg-accent/40' : 'border-border opacity-70')}>
      <div className={cn('mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-bold', done ? 'bg-emerald-600 text-white' : 'bg-muted text-foreground')}>{done ? '✓' : n}</div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </div>
  );
}

function BonoCard({ b, cerrado, onOtorgar }: { b: BonoCardData; cerrado: boolean; onOtorgar: () => void }) {
  const glyph = METRICA_META[b.bono.metrica]?.[2] ?? '●';
  const scope = b.bono.ambito === 'empresa'
    ? <Badge className="bg-violet-600 text-white hover:bg-violet-600">Toda la empresa</Badge>
    : <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{b.bono.ambito}</Badge>;
  return (
    <div className={cn('flex gap-3 rounded-lg border border-border bg-card p-4', b.poolVacio && 'opacity-60')}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-lg font-bold">{glyph}</div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-semibold">{b.bono.nombre}</div>
        {b.poolVacio ? (
          <p className="text-xs text-muted-foreground">Sin empleados incluidos en «{b.bono.ambito}». Verificá el nombre del área en Parámetros o el Maestro.</p>
        ) : b.ganador ? (
          <>
            <div className="text-sm font-medium text-violet-700 dark:text-violet-300">{b.otorgado ? b.otorgado.nombre : b.ganador.emp.nombre}</div>
            <p className="text-xs text-muted-foreground">{b.ganador.desc}</p>
            {b.ganador.racha.length > 0 && (
              <div className="flex gap-1">{b.ganador.racha.map((r) => <div key={r.periodo} title={periodLabel(r.periodo)} className={cn('h-2.5 w-2.5 rounded-full', r.ok ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />)}</div>
            )}
            {b.segundo && !b.otorgado && <p className="font-mono text-[11px] text-muted-foreground">2º · {b.segundo.emp.nombre}</p>}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Sin datos este mes — se define con las novedades cargadas.</p>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {scope}
          {b.otorgado && <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">Otorgado{b.otorgado.monto > 0 ? ' · ' + money(b.otorgado.monto) : ''}</Badge>}
          {!b.otorgado && b.ganador && !cerrado && <Button size="sm" variant="secondary" onClick={onOtorgar}>Otorgar{b.bono.monto > 0 ? ' ' + money(b.bono.monto) : ''}</Button>}
        </div>
      </div>
    </div>
  );
}

export default function TableroPage() {
  const { organigramaId, periodo, listo, refrescar } = useNomina();
  const q = organigramaId != null ? `organigramaId=${organigramaId}&periodo=${periodo}` : null;
  const tab = useNominaData<TableroData>(q ? `/api/admin/nomina/tablero?${q}` : null);
  const [otorgar, setOtorgar] = useState<BonoCardData | null>(null);

  const d = tab.data;
  const estado = <Estado loading={tab.loading} error={tab.error} sinOrg={listo && organigramaId == null} />;
  if (!d || organigramaId == null) return <><PageTitle title={`Tablero · ${periodLabel(periodo)}`} />{estado}</>;

  const s = d.stats, p = d.pasos;
  const comunes = d.bonos.filter((b) => b.bono.ambito === 'empresa');
  const porArea = d.bonos.filter((b) => b.bono.ambito !== 'empresa');

  async function confirmarOtorgar(b: BonoCardData) {
    try {
      const r = await nominaFetch<{ ganador: { nombre: string } }>(`/api/admin/nomina/bonos/${b.bono.id}/otorgar`, { method: 'POST', body: JSON.stringify({ organigramaId, periodo }) });
      toast.success(`«${b.bono.nombre}» otorgado a ${r.ganador.nombre}`);
      refrescar();
    } catch (e) { toast.error(mensajeError(e)); }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title={`Tablero · ${periodLabel(periodo)}`}
        sub="Estado general de la liquidación del período."
        right={d.cerrado ? <Badge className="bg-violet-600 text-white hover:bg-violet-600">Cerrado</Badge> : <Badge variant="secondary">En curso</Badge>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="En nómina" value={s.enNomina} detail={`${s.totalEmpleados} en el organigrama · ${s.conBasico} con básico`} />
        <StatCard label="Neto total estimado" value={money(s.netos)} tone="violet" detail="suma de netos del período" />
        <StatCard label="Costo empresa" value={money(s.costo)} detail={`contribuciones patronales ${s.contribPct.toFixed(2)}% (incluye ART ${s.art}%)`} />
        <StatCard label="Validaciones" value={s.errores ? `${s.errores} errores` : s.avisos ? `${s.avisos} avisos` : 'OK'} tone={s.errores ? 'red' : s.avisos ? 'orange' : 'green'} detail={s.errores || s.avisos ? 'revisar en Liquidación' : 'listo para liquidar'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ciclo del período</CardTitle>
          <p className="text-sm text-muted-foreground">El flujo mensual del modelo: maestro completo → novedades → pre-liquidación validada → cierre.</p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Paso n={1} done={p.pasoMaestro} current={!p.pasoMaestro} title="Maestro completo" desc={`${s.conBasico}/${s.enNomina} con básico`} />
          <Paso n={2} done={p.pasoNov} current={p.pasoMaestro && !p.pasoNov} title="Novedades" desc={`${s.novCount} empleado(s) con carga`} />
          <Paso n={3} done={p.pasoVal} current={p.pasoNov && !p.pasoVal} title="Validación" desc={`${s.errores} err · ${s.avisos} avisos`} />
          <Paso n={4} done={p.cerrado} current={p.pasoVal && !p.cerrado} title="Cierre" desc={d.cerrado ? fechaHora(d.fechaCierre) : 'pendiente'} />
        </CardContent>
      </Card>

      {s.enNomina > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">Reconocimientos <Badge className="bg-violet-600 text-white hover:bg-violet-600">Gamification</Badge></CardTitle>
            <p className="text-sm text-muted-foreground">Bonos comunes a toda la empresa y bonos específicos por área, calculados con las novedades del período. Al otorgar un bono con premio, el monto se suma automáticamente en Novedades → Liquidación. El catálogo se edita en Parámetros. Por diseño, nunca expone sueldos.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {comunes.length > 0 && (
              <div>
                <p className="mb-2 border-b border-border pb-1 font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Bonos comunes — toda la empresa</p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{comunes.map((b) => <BonoCard key={b.bono.id} b={b} cerrado={d.cerrado} onOtorgar={() => setOtorgar(b)} />)}</div>
              </div>
            )}
            {porArea.length > 0 && (
              <div>
                <p className="mb-2 border-b border-border pb-1 font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Bonos por área</p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{porArea.map((b) => <BonoCard key={b.bono.id} b={b} cerrado={d.cerrado} onOtorgar={() => setOtorgar(b)} />)}</div>
              </div>
            )}
            {!d.bonos.length && <p className="text-sm text-muted-foreground">Sin bonos activos. Activá o creá bonos en Parámetros.</p>}
            {d.medallero.length > 0 && (
              <div>
                <p className="mb-2 font-semibold">Medallero histórico <span className="text-xs font-normal text-muted-foreground">bonos otorgados</span></p>
                <Table>
                  <TableBody>
                    {d.medallero.map((m, i) => (
                      <TableRow key={m.emp.id}>
                        <TableCell className="w-10 font-mono font-bold">{i + 1}º</TableCell>
                        <TableCell><EmpleadoCell empleado={m.emp} sub={m.emp.area} /></TableCell>
                        <TableCell className="text-right font-mono font-bold text-violet-600 dark:text-violet-400">{'●'.repeat(Math.min(m.n, 8))} {m.n}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">último: {m.ultimo}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Accesos rápidos</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link href="/admin/nomina/maestro">Completar Maestro</Link></Button>
          <Button variant="outline" asChild><Link href="/admin/nomina/novedades">Cargar novedades</Link></Button>
          <Button asChild><Link href="/admin/nomina/liquidacion">Pre-liquidar →</Link></Button>
          <Button variant="ghost" asChild><Link href="/admin/nomina/parametros">Ajustar parámetros</Link></Button>
        </CardContent>
      </Card>

      <AlertDialog open={!!otorgar} onOpenChange={(o) => !o && setOtorgar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Otorgar «{otorgar?.bono.nombre}»</AlertDialogTitle>
            <AlertDialogDescription>
              A {otorgar?.ganador?.emp.nombre} — {periodLabel(periodo)}.{' '}
              {otorgar && otorgar.bono.monto > 0
                ? `Se sumará un premio de ${money(otorgar.bono.monto)} en sus novedades del mes (impacta en la liquidación).`
                : 'Reconocimiento honorífico (sin monto asociado).'} ¿Confirmás?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const b = otorgar; setOtorgar(null); if (b) confirmarOtorgar(b); }}>Otorgar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
