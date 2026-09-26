'use client';

/**
 * Paso 2 de Nómina › Recibos: avisar por mail que los recibos del mes están disponibles. El
 * mail no lleva el recibo ni importes, solo el enlace al portal, donde cada uno lo firma con su
 * PIN. Antes de enviar se ve a quién le llega y a quién no (y por qué); cada envío queda
 * registrado como prueba de la puesta a disposición.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { fechaHora, periodLabel } from '@/lib/nomina-calc';
import type { AvisoView, PreviaAviso, ResultadoAviso, SinAviso } from '@/lib/recibos-finnegans';
import { mensajeError, nominaFetch } from './api';
import { useNomina, useNominaData } from './NominaContext';
import { PasoCard, type EstadoPaso } from './PasoCard';

const MOTIVO: Record<SinAviso['motivo'], string> = {
  sin_adhesion: 'Sin adhesión',
  pendiente_acta: 'Falta subir el acta',
  sin_email: 'Sin email',
};

export default function PasoAviso({ onEnviado }: { onEnviado: () => void }) {
  const { organigramaId, periodo } = useNomina();
  const url = organigramaId != null ? `/api/admin/nomina/firma/aviso?organigramaId=${organigramaId}&periodo=${periodo}` : null;
  const q = useNominaData<PreviaAviso & { historial: AvisoView[] }>(url);
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const d = q.data;
  const total = d?.destinatarios.length ?? 0;
  const nuevos = d ? d.destinatarios.filter((x) => !x.yaAvisado).length : 0;
  const ultimo = d?.historial[0];
  const hayRecibos = !!d && total + d.sinAviso.length > 0;

  async function enviar() {
    setEnviando(true);
    try {
      const r = await nominaFetch<ResultadoAviso>('/api/admin/nomina/firma/aviso', {
        method: 'POST',
        body: JSON.stringify({ organigramaId, periodo }),
      });
      if (r.fallidos.length) toast.warning(`${r.enviados} aviso(s) enviados, ${r.fallidos.length} con error`);
      else toast.success(`${r.enviados} aviso(s) ${r.modo === 'prueba' ? 'generados en modo prueba (no se enviaron)' : 'enviados'}`);
      q.reload();
      onEnviado();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }

  const estado: EstadoPaso = !hayRecibos ? 'bloqueado'
    : ultimo && nuevos === 0 ? 'hecho'
    : 'pendiente';

  // Motivos agrupados: con 50 personas sin aviso, una lista plana no se lee.
  const porMotivo = new Map<SinAviso['motivo'], SinAviso[]>();
  for (const s of d?.sinAviso ?? []) porMotivo.set(s.motivo, [...(porMotivo.get(s.motivo) ?? []), s]);

  return (
    <>
      <PasoCard
        n={2}
        titulo="Avisar por mail"
        estado={estado}
        accion={hayRecibos && (
          <Button size="sm" variant={estado === 'hecho' ? 'outline' : 'default'} disabled={!total || enviando} onClick={() => setAbierto(true)}>
            <Mail className="mr-1.5 h-4 w-4" />
            {enviando ? 'Enviando…' : !total ? 'Nadie para avisar' : nuevos ? `Avisar a ${nuevos}` : 'Enviar recordatorio'}
          </Button>
        )}
      >
        {!d ? <p>Cargando…</p>
          : !hayRecibos ? <p>Primero importá los recibos del mes.</p>
          : (
            <>
              <p>
                {ultimo
                  ? <>Último aviso <b className="text-foreground">{fechaHora(ultimo.fecha)}</b> · {ultimo.enviados} enviado(s)</>
                  : 'Todavía no se avisó a nadie.'}
              </p>
              <p>{total} con email · {d.sinAviso.length} sin aviso (van en papel)</p>
              {d.modo === 'prueba' && <p className="text-amber-700 dark:text-amber-300">Modo prueba: los mails no salen.</p>}
            </>
          )}
      </PasoCard>

      <AlertDialog open={abierto} onOpenChange={setAbierto}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Avisar que los recibos de {periodLabel(periodo)} están disponibles</AlertDialogTitle>
            <AlertDialogDescription>
              Le llega un mail a <b>{total}</b> persona(s) con recibos sin firmar
              {nuevos < total ? ` (${total - nuevos} ya avisada(s): les llega como recordatorio)` : ''}. No lleva el recibo ni
              importes, solo el enlace para verlo y firmarlo con su PIN. Desde el primer aviso corren los 15 días para
              considerarlo «no retirado».
            </AlertDialogDescription>
          </AlertDialogHeader>
          {d?.modo === 'prueba' && (
            <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-foreground">
              <b>Modo prueba:</b> no hay servidor de correo configurado (SMTP). Los mails se guardan como archivos en
              <code className="mx-1">uploads/nomina/mails-prueba</code> y no se envían.
            </p>
          )}
          {d && d.sinAviso.length > 0 && (
            <details className="rounded-md border border-border p-3 text-sm">
              <summary className="cursor-pointer font-medium">{d.sinAviso.length} no reciben aviso: se les entrega en papel</summary>
              <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                {[...porMotivo].map(([motivo, lista]) => (
                  <div key={motivo}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{MOTIVO[motivo]} ({lista.length})</p>
                    <p className="text-muted-foreground">{lista.map((s) => s.nombre).join(', ')}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
          {d && d.historial.length > 0 && (
            <details className="rounded-md border border-border p-3 text-sm">
              <summary className="cursor-pointer font-medium">Avisos anteriores ({d.historial.length})</summary>
              <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                {d.historial.map((a) => (
                  <li key={a.id}>
                    {fechaHora(a.fecha)} · {a.enviados} enviado(s){a.fallidos ? ` · ${a.fallidos} con error` : ''}
                    {a.modo === 'prueba' ? ' · prueba' : ''}{a.enviadoPor ? ` · ${a.enviadoPor}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void enviar()}>Enviar aviso</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
