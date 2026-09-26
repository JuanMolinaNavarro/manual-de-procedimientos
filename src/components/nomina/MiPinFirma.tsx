'use client';

/**
 * "Mi PIN de firma" en el portal del trabajador: estado de su adhesión y cambio de PIN por
 * autogestión (PIN actual + nuevo dos veces). RR.HH. no puede cambiar PINs; si lo olvidó, se
 * renueva la adhesión en persona.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MiAdhesionView } from '@/lib/nomina';
import { fechaHora } from '@/lib/nomina-calc';
import { PIN_RE } from '@/lib/nomina-datos';
import { cn } from '@/lib/utils';
import { mensajeError, nominaFetch } from './api';

const soloDigitos = (v: string) => v.replace(/\D/g, '').slice(0, 8);

export default function MiPinFirma({ adhesion, onCambio }: { adhesion: MiAdhesionView; onCambio: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [actual, setActual] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cerrar() {
    setAbierto(false);
    setActual('');
    setPin('');
    setPin2('');
    setError(null);
  }

  async function guardar() {
    setError(null);
    if (!actual) { setError('Ingresá tu PIN actual'); return; }
    if (!PIN_RE.test(pin)) { setError('El PIN nuevo debe tener entre 4 y 8 dígitos'); return; }
    if (pin !== pin2) { setError('Los PIN nuevos no coinciden'); return; }
    if (pin === actual) { setError('El PIN nuevo tiene que ser distinto del actual'); return; }
    setEnviando(true);
    try {
      await nominaFetch('/api/admin/mis-recibos/pin', { method: 'POST', body: JSON.stringify({ pinActual: actual, pin, pin2 }) });
      toast.success('PIN cambiado. Usalo desde ahora para firmar tus recibos');
      cerrar();
      onCambio();
    } catch (e) {
      setError(mensajeError(e));
      setActual('');
    } finally {
      setEnviando(false);
    }
  }

  const bloqueada = !!adhesion.bloqueadaHasta && new Date(adhesion.bloqueadaHasta).getTime() > Date.now();

  const estadoTexto = adhesion.estado === 'sin_adhesion'
    ? 'Todavía no adheriste al recibo digital: se hace una sola vez, en persona con RR.HH.'
    : bloqueada ? `Bloqueado por intentos fallidos hasta ${fechaHora(adhesion.bloqueadaHasta!)}.`
    : adhesion.estado === 'pendiente_acta' ? 'Tu adhesión está pendiente: RR.HH. tiene que cargar el acta firmada.'
    : `Activo${adhesion.pinCambiado ? ` · cambiado el ${fechaHora(adhesion.pinCambiado)}` : ''}. Solo vos lo conocés; si lo olvidaste, pedí a RR.HH. que renueve tu adhesión.`;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <KeyRound className={cn('mt-0.5 h-5 w-5 shrink-0', bloqueada ? 'text-destructive' : 'text-muted-foreground')} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">Mi PIN de firma</p>
          <p className="text-sm text-muted-foreground">{estadoTexto}</p>
          {adhesion.codigo && <p className="mt-1 font-mono text-[11px] text-muted-foreground">{adhesion.codigo}</p>}
        </div>
        {adhesion.estado !== 'sin_adhesion' && (
          <Button size="sm" variant="outline" disabled={bloqueada} onClick={() => setAbierto(true)}>Cambiar</Button>
        )}
      </div>

      <Dialog open={abierto} onOpenChange={(o) => !o && cerrar()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar mi PIN</DialogTitle>
            <DialogDescription>
              Necesitás tu PIN actual. El nuevo tiene entre 4 y 8 dígitos: no lo compartas con nadie, ni siquiera con RR.HH.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pin-actual">PIN actual</Label>
              <Input id="pin-actual" type="password" inputMode="numeric" autoComplete="off" value={actual} onChange={(e) => setActual(soloDigitos(e.target.value))} className="font-mono tracking-[.4em]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pin-nuevo">PIN nuevo</Label>
              <Input id="pin-nuevo" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(soloDigitos(e.target.value))} className="font-mono tracking-[.4em]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pin-nuevo2">Repetí el PIN nuevo</Label>
              <Input id="pin-nuevo2" type="password" inputMode="numeric" autoComplete="off" value={pin2} onChange={(e) => setPin2(soloDigitos(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && guardar()} className="font-mono tracking-[.4em]" />
            </div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cerrar}>Cancelar</Button>
            <Button onClick={guardar} disabled={enviando}>{enviando ? 'Guardando…' : 'Cambiar PIN'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
