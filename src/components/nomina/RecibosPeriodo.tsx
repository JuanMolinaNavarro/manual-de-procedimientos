'use client';

/**
 * Nómina › Recibos › pestaña "Recibos": un renglón por recibo PDF del período con su estado de
 * entrega (pendiente / no retirado / firmado / en papel). Buscador + filtros, y las acciones
 * de cada recibo (PDF, constancia, entrega en papel) en un menú. Cada trabajador firma desde
 * el portal con su PIN; a los 15 días del aviso sin firmar corresponde entregarlo en papel.
 */

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileSignature, FileText, MoreHorizontal, ScanLine, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fechaCorta, money, periodLabel } from '@/lib/nomina-calc';
import type { EstadoEntrega } from '@/lib/recibos-finnegans-calc';
import type { PanelRecibos, ReciboPanelView } from '@/lib/recibos-finnegans';
import { mensajeError, nominaFetch } from './api';
import ConstanciaCard from './ConstanciaCard';
import { useNomina } from './NominaContext';
import { BarraFiltros, coincide } from './PasoCard';
import { Empty } from './ui';

export function BadgeEntrega({ r }: { r: Pick<ReciboPanelView, 'entrega' | 'dias' | 'constancia'> }) {
  if (r.entrega === 'firmado') {
    const conforme = r.constancia?.conformidad !== 'disconforme';
    return <Badge className={conforme ? 'bg-emerald-600 text-white hover:bg-emerald-600' : 'bg-amber-600 text-white hover:bg-amber-600'}>{conforme ? 'Firmado' : 'Firmado disconforme'}</Badge>;
  }
  if (r.entrega === 'papel') return <Badge className="bg-sky-700 text-white hover:bg-sky-700">En papel</Badge>;
  if (r.entrega === 'no_retirado') return <Badge variant="destructive">No retirado · {r.dias} días</Badge>;
  return <Badge variant="outline">Pendiente</Badge>;
}

type FiltroEntrega = 'todos' | EstadoEntrega;

function detalle(x: ReciboPanelView): string {
  if (x.constancia) return `Firmó el ${fechaCorta(x.constancia.fecha)}${x.caso ? ` · caso ${x.caso.estado}` : ''}`;
  if (x.papel) return `Papel registrado ${x.papel.registradoEn ? fechaCorta(x.papel.registradoEn) : ''}${x.papel.registradoPor ? ` por ${x.papel.registradoPor}` : ''}`;
  return x.adherido ? 'Puede firmar en el portal' : 'Sin adhesión completa: va en papel';
}

export default function RecibosPeriodo({ panel, onCambio }: { panel: PanelRecibos | null; onCambio: () => void }) {
  const { periodo } = useNomina();
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState<FiltroEntrega>('todos');
  const [constancia, setConstancia] = useState<ReciboPanelView | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const papelPara = useRef<string | null>(null);

  function elegirPapel(id: string) {
    papelPara.current = id;
    fileRef.current?.click();
  }
  async function subirPapel(file: File) {
    const id = papelPara.current;
    if (!id) return;
    setSubiendo(id);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      await nominaFetch(`/api/admin/nomina/firma/recibos/${id}/papel`, { method: 'POST', body: fd });
      toast.success('Entrega en papel registrada');
      onCambio();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setSubiendo(null);
    }
  }

  if (!panel) return null;
  if (!panel.recibos.length) {
    return (
      <Empty title={`No hay recibos publicados de ${periodLabel(periodo)}`}>
        Importalos de Finnegans en el paso 1.
      </Empty>
    );
  }

  const r = panel.resumen;
  const filtros: { valor: FiltroEntrega; label: string; cuenta: number }[] = [
    { valor: 'todos', label: 'Todos', cuenta: r.total },
    { valor: 'pendiente', label: 'Pendientes', cuenta: r.pendientes },
    { valor: 'no_retirado', label: 'No retirados', cuenta: r.noRetirados },
    { valor: 'firmado', label: 'Firmados', cuenta: r.firmados },
    { valor: 'papel', label: 'En papel', cuenta: r.papel },
  ];
  const visibles = panel.recibos.filter((x) => (filtro === 'todos' || x.entrega === filtro) && coincide(x.nombre, buscar));

  return (
    <div className="space-y-3">
      <BarraFiltros buscar={buscar} onBuscar={setBuscar} filtros={filtros.filter((f) => f.valor === 'todos' || f.cuenta > 0)} activo={filtro} onFiltro={setFiltro} />
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {visibles.map((x) => (
          <li key={x.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{x.nombre}</p>
              <p className="truncate text-xs text-muted-foreground">{x.tipoLiquidacion} · {detalle(x)}</p>
            </div>
            <span className="hidden text-sm tabular-nums text-muted-foreground sm:block">{money(x.neto)}</span>
            <div className="shrink-0 text-right sm:w-36"><BadgeEntrega r={x} /></div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" aria-label={`Acciones de ${x.nombre}`} disabled={subiendo === x.id}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a href={`/api/admin/nomina/firma/recibos/${x.id}/pdf`} target="_blank" rel="noopener"><FileText className="h-4 w-4" /> Ver recibo</a>
                </DropdownMenuItem>
                {x.constancia && (
                  <DropdownMenuItem onSelect={() => setConstancia(x)}><FileSignature className="h-4 w-4" /> Ver constancia de firma</DropdownMenuItem>
                )}
                {x.papel && (
                  <DropdownMenuItem asChild>
                    <a href={`/api/admin/nomina/firma/recibos/${x.id}/papel`} target="_blank" rel="noopener"><ScanLine className="h-4 w-4" /> Ver escaneo en papel</a>
                  </DropdownMenuItem>
                )}
                {(x.entrega === 'pendiente' || x.entrega === 'no_retirado') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => elegirPapel(x.id)}><Upload className="h-4 w-4" /> Registrar entrega en papel…</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
        {!visibles.length && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Nadie coincide con el filtro.</li>}
      </ul>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(ev) => {
          const f = ev.target.files?.[0];
          if (f) void subirPapel(f);
          ev.target.value = '';
        }}
      />

      <Dialog open={!!constancia} onOpenChange={(o) => !o && setConstancia(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Constancia de firma · {constancia?.nombre}</DialogTitle>
            <DialogDescription>{constancia ? `${periodLabel(periodo)} · ${constancia.tipoLiquidacion}` : ''}</DialogDescription>
          </DialogHeader>
          {constancia?.constancia && <ConstanciaCard constancia={constancia.constancia} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
