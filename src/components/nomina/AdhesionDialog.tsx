'use client';

/**
 * Adhesión al recibo digital (acto único, presencial): el trabajador declara su email (ahí le
 * llegan los avisos de recibos disponibles) y tipea su PIN dos veces delante de RR.HH.; el PIN
 * solo viaja al servidor para guardar su hash. La adhesión queda PENDIENTE
 * hasta subir el acta firmada en papel. RR.HH. no cambia PINs: el trabajador lo cambia desde
 * su portal (con el PIN actual); si lo olvidó, se revoca y se hace una adhesión nueva.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PIN_RE } from '@/lib/nomina-datos';
import { emailValido } from '@/lib/recibos-aviso';
import type { EmpleadoNomina } from '@/lib/nomina-calc';
import { mensajeError, nominaFetch } from './api';

export default function AdhesionDialog({ organigramaId, empleado, onClose, onOk }: {
  organigramaId: number;
  empleado: EmpleadoNomina | null;
  onClose: () => void;
  onOk: () => void;
}) {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [enviando, setEnviando] = useState(false);

  function cerrar() { setEmail(''); setPin(''); setPin2(''); onClose(); }

  async function confirmar() {
    if (!empleado) return;
    if (!emailValido(email)) { toast.error('Ingresá un email válido'); return; }
    if (!PIN_RE.test(pin.trim())) { toast.error('El PIN debe tener entre 4 y 8 dígitos'); return; }
    if (pin.trim() !== pin2.trim()) { toast.error('Los PIN no coinciden'); return; }
    setEnviando(true);
    try {
      await nominaFetch('/api/admin/nomina/adhesiones', { method: 'POST', body: JSON.stringify({ organigramaId, empleadoId: empleado.id, email: email.trim(), pin: pin.trim(), pin2: pin2.trim() }) });
      toast.success(`Adhesión de ${empleado.nombre} registrada: imprimí el acta, firmala y subila para habilitar la firma`);
      cerrar();
      onOk();
    } catch (e) { toast.error(mensajeError(e)); } finally { setEnviando(false); }
  }

  return (
    <Dialog open={!!empleado} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adhesión al recibo digital</DialogTitle>
          <DialogDescription>
            {empleado?.nombre}. El trabajador declara el email donde quiere recibir los avisos y elige un PIN personal de 4 a 8
            dígitos: es suyo, no lo compartas. Lo va a usar para firmar cada recibo desde el portal y lo puede cambiar él mismo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Después de guardar: imprimí el acta (dos copias), que el trabajador y un representante de la empresa la firmen, escaneala y subila en su fila.
            Hasta entonces la adhesión queda <b>pendiente</b> y no permite firmar recibos.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="adh-email">Email para los avisos</Label>
            <Input id="adh-email" type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@dominio.com" />
            <p className="text-xs text-muted-foreground">Queda impreso en el acta. Solo se usa para avisar que hay recibos para firmar: nunca se mandan recibos por mail.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adh-pin">PIN personal (lo tipea el trabajador)</Label>
            <Input id="adh-pin" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} className="font-mono tracking-[.4em]" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adh-pin2">Repetí el PIN</Label>
            <Input id="adh-pin2" type="password" inputMode="numeric" autoComplete="off" value={pin2} onChange={(e) => setPin2(e.target.value)} className="font-mono tracking-[.4em]" onKeyDown={(e) => e.key === 'Enter' && confirmar()} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={cerrar}>Cancelar</Button>
          <Button onClick={confirmar} disabled={enviando}>Adherir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
