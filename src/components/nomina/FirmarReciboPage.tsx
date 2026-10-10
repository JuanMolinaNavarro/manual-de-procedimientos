'use client';

/**
 * Ver y firmar un recibo propio (`/admin/mis-recibos/[id]`), pensado para el celular: el
 * trabajador lee el PDF oficial de Finnegans, declara que lo recibió y lo leyó y firma con su
 * PIN. Firmar es constancia de recepción, no de conformidad; si algo no le cierra puede dejarle
 * una observación a RR.HH. al firmar. La ficha sale de la sesión.
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
import { fechaCorta, fmtMes } from '@/lib/fechas';
import type { ConstanciaView } from '@/lib/nomina';
import { fechaHora, money } from '@/lib/nomina-calc';
import type { MiReciboView } from '@/lib/recibos-finnegans';
import { tieneObservaciones } from '@/lib/recibos-finnegans-calc';
import { cn } from '@/lib/utils';
import { apiFetch, mensajeError } from '@/components/comunes/api';
import ConstanciaCard from './ConstanciaCard';
import VisorPdf from './VisorPdf';

type Recibo = MiReciboView & { sha256: string; adhesion: 'sin_adhesion' | 'pendiente_acta' | 'completa' };

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
  // El recibo que ya se dibujó entero en pantalla (la firma se habilita recién ahí). Guardado por
  // id: si se navega a otro recibo, el componente se reutiliza con el estado anterior.
  const [dibujado, setDibujado] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    apiFetch<Recibo>(`/api/admin/mis-recibos/${id}`)
      .then(async (d) => {
        const c = d.entrega === 'firmado'
          ? (await apiFetch<{ constancia: ConstanciaView | null }>(`/api/admin/mis-recibos/${id}/constancia`)).constancia
          : null;
        if (!vivo) return;
        setR(d);
        setConstancia(c);
      })
      .catch((e: unknown) => vivo && setError(mensajeError(e)));
    return () => { vivo = false; };
  }, [id, version]);

  const pdf = `/api/admin/mis-recibos/${id}/pdf`;
  const porFirmar = !!r && (r.entrega === 'pendiente' || r.entrega === 'sin_firmar');
  const puedeFirmar = porFirmar && r?.adhesion === 'completa';

  const visor = (
    <div className="overflow-hidden rounded-xl border border-border bg-muted/30 p-2">
      <VisorPdf url={pdf} onListo={() => setDibujado(id)} />
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
                Neto <b className="text-base tabular-nums text-foreground">{money(r.neto)}</b>
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
                  <b>Ya firmaste este recibo</b> el {fechaHora(constancia.fecha)}
                  {tieneObservaciones(constancia.conformidad) ? ', con observaciones. RR.HH. se va a comunicar con vos.' : '.'}
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
                <FormularioFirma
                  key={id}
                  id={id}
                  pdfListo={dibujado === id}
                  onFirmado={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setVersion((n) => n + 1); }}
                />
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

function FormularioFirma({ id, pdfListo, onFirmado }: { id: string; pdfListo: boolean; onFirmado: () => void }) {
  const [leido, setLeido] = useState(false);
  const [conObservacion, setConObservacion] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [firmado, setFirmado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listo = pdfListo && leido && /^\d{4,8}$/.test(pin) && (!conObservacion || observaciones.trim() !== '');

  async function firmar() {
    if (!listo || enviando || firmado) return;
    setEnviando(true);
    setError(null);
    try {
      await apiFetch<ConstanciaView>(`/api/admin/mis-recibos/${id}/firmar`, {
        method: 'POST',
        body: JSON.stringify({ pin, observaciones: conObservacion ? observaciones : '', leido: true }),
      });
      toast.success('Recibo firmado');
      setFirmado(true); // el formulario se cierra ya: un segundo toque no vuelve a firmar
      onFirmado();
    } catch (e) {
      setError(mensajeError(e));
      setPin('');
    } finally {
      setEnviando(false);
    }
  }

  if (firmado) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 p-4 text-sm text-foreground" role="status">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
        Recibo firmado. Cargando la constancia…
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-4">
      <label className={cn('flex items-start gap-3 text-sm', !pdfListo && 'text-muted-foreground')}>
        <Checkbox checked={leido} disabled={!pdfListo} onCheckedChange={(v) => setLeido(v === true)} className="mt-0.5" />
        <span>
          Recibí este recibo de sueldo y lo leí completo.
          {!pdfListo && <span className="block text-xs">Esperá a que se muestre el recibo arriba.</span>}
        </span>
      </label>
      <p className="text-xs text-muted-foreground">
        Firmar confirma que lo recibiste. No significa que estés de acuerdo ni te hace perder ningún derecho.
      </p>

      <div className="space-y-2">
        <label className="flex items-start gap-3 text-sm">
          <Checkbox checked={conObservacion} onCheckedChange={(v) => setConObservacion(v === true)} className="mt-0.5" />
          <span>Quiero dejarle una observación a RR.HH. sobre este recibo.</span>
        </label>
        {conObservacion && (
          <div className="space-y-1.5 pl-7">
            <Label htmlFor="obs">¿Qué observás?</Label>
            <Textarea id="obs" rows={3} maxLength={2000} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Contá qué no te cierra del recibo" />
            <p className="text-xs text-muted-foreground">Queda registrada con la firma y RR.HH. se va a comunicar con vos.</p>
          </div>
        )}
      </div>

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
        {enviando ? 'Firmando…' : 'Firmar: recibí este recibo'}
      </Button>
    </div>
  );
}
