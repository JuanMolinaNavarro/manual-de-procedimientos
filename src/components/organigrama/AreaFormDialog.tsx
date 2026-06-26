'use client';

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { OrgArea, OrgEmpleado } from '@/lib/organigrama';

const PALETTE = [
  '#007AFF', '#5856D6', '#34C759', '#FF9500', '#FF3B30', '#AF52DE',
  '#FF2D55', '#5AC8FA', '#FFCC00', '#A2845E', '#32D74B', '#FF9F0A',
  '#BF5AF2', '#64D2FF', '#FF6482', '#30B0C7', '#86868b', '#000000',
];

interface AreaFormDialogProps {
  open: boolean;
  /** null = crear; con valor = editar. El padre lo remonta con `key`, así el estado
   * inicial sale de la prop sin necesidad de un efecto de sincronización. */
  area: OrgArea | null;
  /** Empleados del área (para elegir el jefe). En alta suele venir vacío. */
  miembros: OrgEmpleado[];
  /** Todas las áreas (para elegir de cuál depende). */
  areas: OrgArea[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    nombre: string;
    color: string;
    jefe_id: number | null;
    parent_id: number | null;
  }) => Promise<void>;
}

export default function AreaFormDialog({
  open,
  area,
  miembros,
  areas,
  onOpenChange,
  onSubmit,
}: AreaFormDialogProps) {
  const [nombre, setNombre] = useState(area?.nombre ?? '');
  const [color, setColor] = useState(area?.color ?? PALETTE[0]);
  const [jefeId, setJefeId] = useState<number | null>(area?.jefe_id ?? null);
  const [parentId, setParentId] = useState<number | null>(area?.parent_id ?? null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // No se puede depender de uno mismo ni de una sub-área propia (evita ciclos).
  const descendientes = useMemo(() => {
    const out = new Set<number>();
    if (!area) return out;
    const stack = [area.id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const a of areas) {
        if (a.parent_id === cur && !out.has(a.id)) {
          out.add(a.id);
          stack.push(a.id);
        }
      }
    }
    return out;
  }, [area, areas]);
  const opcionesPadre = areas.filter((a) => a.id !== area?.id && !descendientes.has(a.id));

  async function submit() {
    if (!nombre.trim()) {
      setErr('El nombre es requerido');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSubmit({ nombre: nombre.trim(), color, jefe_id: jefeId, parent_id: parentId });
      onOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo guardar el área');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{area ? 'Editar área' : 'Nueva área'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Marketing"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  style={{ background: c }}
                  className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition ${
                    color === c ? 'ring-foreground' : 'ring-transparent'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Depende de área</Label>
            <Select
              value={parentId != null ? String(parentId) : 'none'}
              onValueChange={(v) => setParentId(v === 'none' ? null : Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Área raíz (no depende de otra)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Área raíz —</SelectItem>
                {opcionesPadre.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Jefe de área</Label>
            <Select
              value={jefeId != null ? String(jefeId) : 'none'}
              onValueChange={(v) => setJefeId(v === 'none' ? null : Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin jefe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sin jefe —</SelectItem>
                {miembros.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.nombre} · {m.rol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {miembros.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Asigná empleados a esta área para poder elegir un jefe.
              </p>
            )}
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Guardando…' : area ? 'Guardar' : 'Crear área'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
