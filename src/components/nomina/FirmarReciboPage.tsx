'use client';

/**
 * Ver y firmar un recibo propio (`/admin/mis-recibos/[id]`), pensado para el celular: el
 * trabajador lee el PDF oficial de Finnegans, declara que lo leyó, elige conformidad o
 * disconformidad (con observaciones) y firma con su PIN. La ficha sale de la sesión.
 */

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Banner } from '@/components/comunes/ui';
import { fmtMes } from '@/lib/asistencia-calendario';
import type { ConstanciaView } from '@/lib/nomina';
import { fechaHora } from '@/lib/nomina-calc';
import type { MiReciboView } from '@/lib/recibos-finnegans';
import { cn } from '@/lib/utils';
import { mensajeError, nominaFetch } from './api';
import ConstanciaCard from './ConstanciaCard';
import VisorPdf from './VisorPdf';

type Recibo = MiReciboView & { sha256: string; adhesion: 'sin_adhesion' | 'pendiente_acta' | 'completa' };

const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

function Paso({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2.5 font-semibold text-foreground">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export default function FirmarReciboPage({ id }: { id: string }) {
  const [r, setR] = useState<Recibo | null>(null);
  const [constancia, setConstancia] = useState<ConstanciaView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    nominaFetch<Recibo>(`/api/admin/mis-recibos/${id}`)
      .then(async (d) => {
        const c = d.entrega === 'firmado'
          ? (await nominaFetch<{ constancia: ConstanciaView | null }>(`/api/admin/mis-recibos/${id}/constancia`)).constancia
          : null;
        if (!vivo) return;
        setR(d);
        setConstancia(c);
      })
      .catch((e: unknown) => vivo && setError(mensajeError(e)));
    return () => { vivo = false; };
  }, [id, version]);

  const pdf = `/api/admin/mis-recibos/${id}/pdf`;
  const porFirmar = !!r && (r.entrega === 'pendiente' || r.entrega === 'no_retirado');
  const puedeFirmar = porFirmar && r?.adhesion === 'completa';

  const visor = (
    <div className="overflow-hidden rounded-xl border border-border bg-muted/30 p-2">
      <VisorPdf url={pdf} />
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <Link href="/admin/mis-recibos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Mis recibos
      </Link>
      {error && <Banner variant="warn">{error}</Banner>}
      {!r && !error && <Skeleton className="h-96 w-full rounded-xl" />}
      {r && (
        <>
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold capitalize text-foreground">{fmtMes(r.periodo)}</h1>
              <p className="text-sm text-muted-foreground">{r.tipoLiquidacion} · {r.empresa}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Neto <b className="text-base tabular-nums text-foreground">{pesos.format(r.neto)}</b>
                {r.fechaPago && ` · pagado el ${fechaCorta(r.fechaPago)}`}
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <a href={`${pdf}?descargar=1`} aria-label="Descargar PDF"><Download className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Descargar</span></a>
            </Button>
          </header>

          {r.entrega === 'firmado' && constancia && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 p-4">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
                <p className="text-sm text-foreground">
                  <b>Ya firmaste este recibo</b> {constancia.conformidad === 'conforme' ? 'en conformidad' : 'en disconformidad'} el {fechaHora(constancia.fecha)}.
                  {constancia.conformidad === 'disconforme' && ' RR.HH. se va a comunicar con vos.'}
                </p>
              </div>
              <details>
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">Ver la constancia de firma</summary>
                <div className="mt-3"><ConstanciaCard constancia={constancia} /></div>
              </details>
            </div>
          )}
          {r.entrega === 'papel' && <Banner>Este recibo se te entregó en papel: no se firma acá.</Banner>}
          {porFirmar && !puedeFirmar && (
            <Banner>
              {r.adhesion === 'sin_adhesion'
                ? 'Podés ver y descargar el recibo. Para firmarlo desde acá primero tenés que adherir al recibo digital: acercate a RR.HH.'
                : 'Podés ver y descargar el recibo. Vas a poder firmarlo cuando RR.HH. termine de cargar tu adhesión.'}
            </Banner>
          )}

          {puedeFirmar ? (
            <>
              <Paso n={1} titulo="Leé tu recibo">{visor}</Paso>
              <Paso n={2} titulo="Firmalo con tu PIN">
                <FormularioFirma id={id} onFirmado={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setVersion((n) => n + 1); }} />
              </Paso>
            </>
          ) : visor}

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Datos técnicos</summary>
            <p className="mt-1 break-all font-mono">SHA-256 del recibo: {r.sha256}</p>
          </details>
        </>
      )}
    </div>
  );
}

function OpcionConformidad({ activa, titulo, detalle, onClick }: { activa: boolean; titulo: string; detalle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
        activa ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/30',
      )}
    >
      <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', activa ? 'border-primary' : 'border-muted-foreground/50')}>
        {activa && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      <span>
        <span className="block text-sm font-medium text-foreground">{titulo}</span>
        <span className="block text-xs text-muted-foreground">{detalle}</span>
      </span>
    </button>
  );
}

function FormularioFirma({ id, onFirmado }: { id: string; onFirmado: () => void }) {
  const [leido, setLeido] = useState(false);
  const [conformidad, setConformidad] = useState<'conforme' | 'disconforme' | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listo = leido && !!conformidad && /^\d{4,8}$/.test(pin) && (conformidad === 'conforme' || observaciones.trim() !== '');

  async function firmar() {
    if (!listo || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await nominaFetch<ConstanciaView>(`/api/admin/mis-recibos/${id}/firmar`, {
        method: 'POST',
        body: JSON.stringify({ pin, conformidad, observaciones, leido: true }),
      });
      toast.success('Recibo firmado');
      onFirmado();
    } catch (e) {
      setError(mensajeError(e));
      setPin('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-4">
      <label className="flex items-start gap-3 text-sm">
        <Checkbox checked={leido} onCheckedChange={(v) => setLeido(v === true)} className="mt-0.5" />
        <span>Recibí este recibo de sueldo y lo leí completo.</span>
      </label>

      <div className="space-y-2" role="radiogroup" aria-label="Conformidad">
        <OpcionConformidad
          activa={conformidad === 'conforme'}
          titulo="Firmo en conformidad"
          detalle="Estoy de acuerdo con lo liquidado."
          onClick={() => setConformidad('conforme')}
        />
        <OpcionConformidad
          activa={conformidad === 'disconforme'}
          titulo="Firmo en disconformidad"
          detalle="Lo recibo, pero hay algo que quiero observar. No pierdo ningún derecho y RR.HH. se va a comunicar conmigo."
          onClick={() => setConformidad('disconforme')}
        />
      </div>

      {conformidad === 'disconforme' && (
        <div className="space-y-1.5">
          <Label htmlFor="obs">¿Qué observás?</Label>
          <Textarea id="obs" rows={3} maxLength={2000} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Contá qué no te cierra del recibo" />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="pin">Tu PIN personal</Label>
        <Input
          id="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
          onKeyDown={(e) => e.key === 'Enter' && firmar()}
          className="h-12 text-center font-mono text-lg tracking-[.5em]"
        />
      </div>

      {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}

      <Button size="lg" className="w-full" disabled={!listo || enviando} onClick={firmar}>
        {enviando ? 'Firmando…' : 'Firmar recibo'}
      </Button>
    </div>
  );
}
