'use client';

import { useState } from 'react';
import { Search, UserPlus, FolderPlus, LayoutGrid, Plus, Pencil, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { EmpleadoOculto, Organigrama } from '@/lib/organigrama';

interface ToolbarProps {
  organigramas: Organigrama[];
  orgId: number | null;
  onSelectOrg: (id: number) => void;
  onCreateOrg: () => void;
  onEditOrg: () => void;
  search: string;
  onSearch: (v: string) => void;
  onAddEmpleado: () => void;
  onAddArea: () => void;
  onReorganizar: () => void;
  /** Fichas quitadas del lienzo; con «Restaurar» vuelven activas. */
  ocultos: EmpleadoOculto[];
  onRestaurar: (id: number) => Promise<void>;
  /** Si es false, se ocultan todas las acciones de escritura (solo lectura). */
  canEdit: boolean;
}

export default function Toolbar({
  organigramas,
  orgId,
  onSelectOrg,
  onCreateOrg,
  onEditOrg,
  search,
  onSearch,
  onAddEmpleado,
  onAddArea,
  onReorganizar,
  ocultos,
  onRestaurar,
  canEdit,
}: ToolbarProps) {
  const [verOcultos, setVerOcultos] = useState(false);
  const [restaurando, setRestaurando] = useState<number | null>(null);

  async function restaurar(id: number) {
    setRestaurando(id);
    try {
      await onRestaurar(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo restaurar');
    } finally {
      setRestaurando(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3">
      {/* Selector de empresa / ubicación */}
      <div className="flex items-center gap-1.5">
        <Select
          value={orgId != null ? String(orgId) : undefined}
          onValueChange={(v) => onSelectOrg(Number(v))}
        >
          <SelectTrigger className="neu-field h-10 w-48 rounded-xl">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            {organigramas.map((o) => (
              <SelectItem key={o.id} value={String(o.id)}>
                {o.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canEdit && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={onEditOrg}
              disabled={orgId == null}
              className="neu-btn h-10 rounded-xl px-3"
              title="Editar empresa seleccionada"
              aria-label="Editar empresa"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onCreateOrg}
              className="neu-btn h-10 rounded-xl px-3"
              title="Nueva empresa / ubicación"
              aria-label="Nueva empresa"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--neu-fg-soft)]" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar por nombre, rol, área, email o skill…"
          className="neu-field h-10 w-72 rounded-xl pl-9 placeholder:text-[var(--neu-fg-soft)] focus-visible:ring-0"
        />
      </div>

      {canEdit && (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onAddEmpleado} className="neu-btn h-10 rounded-xl">
            <UserPlus className="mr-1 h-4 w-4" /> Empleado
          </Button>
          <Button size="sm" variant="ghost" onClick={onAddArea} className="neu-btn h-10 rounded-xl">
            <FolderPlus className="mr-1 h-4 w-4" /> Área
          </Button>
          <Button size="sm" variant="ghost" onClick={onReorganizar} className="neu-btn h-10 rounded-xl">
            <LayoutGrid className="mr-1 h-4 w-4" /> Reorganizar
          </Button>
          {ocultos.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setVerOcultos(true)} className="neu-btn h-10 rounded-xl">
              <EyeOff className="mr-1 h-4 w-4" /> Ocultos ({ocultos.length})
            </Button>
          )}
        </div>
      )}

      <Dialog open={verOcultos && ocultos.length > 0} onOpenChange={setVerOcultos}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Quitados del organigrama</DialogTitle>
            <DialogDescription>
              Siguen guardados con todo su historial (recibos, asistencia, nómina, documentos) y figuran como
              inactivos. Restaurar los vuelve a mostrar en el lienzo, activos.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-[60vh] divide-y overflow-y-auto">
            {ocultos.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{o.nombre}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[o.rol, o.area].filter(Boolean).join(' · ')} · quitado el{' '}
                    {new Date(o.oculto_en).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={restaurando != null}
                  onClick={() => restaurar(o.id)}
                >
                  {restaurando === o.id ? 'Restaurando…' : 'Restaurar'}
                </Button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
