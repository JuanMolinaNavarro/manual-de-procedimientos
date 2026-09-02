'use client';

/**
 * Adhesión al recibo digital (acto único) o cambio de PIN: el trabajador
 * tipea su PIN dos veces; solo viaja al servidor para guardar su hash.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ADHESION_MODOS, PIN_RE } from '@/lib/nomina-datos';
import type { EmpleadoNomina } from '@/lib/nomina-calc';
import { mensajeError, nominaFetch } from './api';

export default function AdhesionDialog({ organigramaId, empleado, modo: modoDialog, onClose, onOk }: {
  organigramaId: number;
  empleado: EmpleadoNomina | null;
  modo: 'adherir' | 'pin';
  onClose: () => void;
  onOk: () => void;
}) {
  const [modoActa, setModoActa] = useState('papel');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [enviando, setEnviando] = useState(false);

  function cerrar() { setPin(''); setPin2(''); setModoActa('papel'); onClose(); }

  async function confirmar() {
    if (!empleado) return;
    if (!PIN_RE.test(pin.trim())) { toast.error('El PIN debe tener entre 4 y 8 dígitos'); return; }
    if (pin.trim() !== pin2.trim()) { toast.error('Los PIN no coinciden'); return; }
    setEnviando(true);
    try {
      if (modoDialog === 'adherir') {
        await nominaFetch('/api/admin/nomina/adhesiones', { method: 'POST', body: JSON.stringify({ organigramaId, empleadoId: empleado.id, modo: modoActa, pin: pin.trim(), pin2: pin2.trim() }) });
        toast.success(`${empleado.nombre} adherido al recibo digital`);
      } else {
        await nominaFetch(`/api/admin/nomina/adhesiones/${empleado.id}/pin`, { method: 'PUT', body: JSON.stringify({ organigramaId, pin: pin.trim(), pin2: pin2.trim() }) });
        toast.success('PIN actualizado');
      }
      cerrar();
      onOk();
    } catch (e) { toast.error(mensajeError(e)); } finally { setEnviando(false); }
  }

  return (
    <Dialog open={!!empleado} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{modoDialog === 'adherir' ? 'Adhesión al recibo digital' : 'Cambiar PIN'}</DialogTitle>
          <DialogDescription>
            {empleado?.nombre}. {modoDialog === 'adherir'
              ? 'El trabajador elige un PIN personal de 4 a 8 dígitos: es suyo, no lo compartas. Lo va a usar para firmar cada recibo.'
              : 'Nuevo PIN personal de 4 a 8 dígitos.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {modoDialog === 'adherir' && (
            <div className="space-y-1.5">
              <Label>Acta de adhesión</Label>
              <Select value={modoActa} onValueChange={setModoActa}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ADHESION_MODOS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Recomendado: imprimir el acta, que el trabajador la firme en papel, escanearla y subirla como PDF en su fila.</p>
            </div>
          )}
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
          <Button onClick={confirmar} disabled={enviando}>{modoDialog === 'adherir' ? 'Adherir' : 'Guardar PIN'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
