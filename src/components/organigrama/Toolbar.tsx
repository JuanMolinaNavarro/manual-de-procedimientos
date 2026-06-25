'use client';

import { Search, UserPlus, FolderPlus, LayoutGrid, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ToolbarProps {
  search: string;
  onSearch: (v: string) => void;
  onAddEmpleado: () => void;
  onAddArea: () => void;
  onReorganizar: () => void;
  onReiniciar: () => void;
}

export default function Toolbar({
  search,
  onSearch,
  onAddEmpleado,
  onAddArea,
  onReorganizar,
  onReiniciar,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/80 px-3 py-2 backdrop-blur">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar por nombre, rol, área, email o skill…"
          className="h-9 w-72 pl-8"
        />
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={onAddEmpleado}>
          <UserPlus className="mr-1 h-4 w-4" /> Empleado
        </Button>
        <Button size="sm" variant="outline" onClick={onAddArea}>
          <FolderPlus className="mr-1 h-4 w-4" /> Área
        </Button>
        <Button size="sm" variant="outline" onClick={onReorganizar}>
          <LayoutGrid className="mr-1 h-4 w-4" /> Reorganizar
        </Button>
        <Button size="sm" variant="ghost" onClick={onReiniciar} className="text-destructive">
          <RotateCcw className="mr-1 h-4 w-4" /> Reiniciar
        </Button>
      </div>
    </div>
  );
}
