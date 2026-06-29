'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Organigrama } from '@/lib/organigrama';

interface EmpresaFormDialogProps {
  open: boolean;
  /** null = crear; con valor = editar. El padre lo remonta con `key`. */
  empresa: Organigrama | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { nombre: string; direccion: string }) => Promise<void>;
}

export default function EmpresaFormDialog({
  open,
  empresa,
  onOpenChange,
  onSubmit,
}: EmpresaFormDialogProps) {
  const [nombre, setNombre] = useState(empresa?.nombre ?? '');
  const [direccion, setDireccion] = useState(empresa?.direccion ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!nombre.trim()) {
      setErr('El nombre es requerido');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSubmit({ nombre: nombre.trim(), direccion: direccion.trim() });
      onOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo crear la empresa');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="neu-surface max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>{empresa ? 'Editar empresa' : 'Nueva empresa / ubicación'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Casa Central"
              autoFocus
              className="neu-field rounded-lg focus-visible:ring-0"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Dirección</Label>
            <Input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Ej. Av. Siempre Viva 742"
              className="neu-field rounded-lg focus-visible:ring-0"
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
            />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Guardando…' : empresa ? 'Guardar' : 'Crear empresa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
