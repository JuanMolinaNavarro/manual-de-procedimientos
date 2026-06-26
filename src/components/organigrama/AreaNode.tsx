'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TITLE_H } from './layout';

export const AREA_NODE_TYPE = 'area';

export interface AreaNodeData {
  areaId: number;
  nombre: string;
  color: string;
  width: number;
  height: number;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  [key: string]: unknown;
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function AreaNodeComp({ data }: NodeProps) {
  const d = data as AreaNodeData;
  return (
    // pointer-events-none en el cuerpo: la zona no bloquea el paneo del lienzo ni los
    // clics sobre las viñetas (que van por encima). Solo el título es interactivo.
    <div
      style={{
        width: d.width,
        height: d.height,
        borderColor: hexToRgba(d.color, 0.45),
        background: hexToRgba(d.color, 0.05),
      }}
      className="pointer-events-none rounded-3xl border-2"
    >
      {/* Anclas (ocultas) para las líneas jerárquicas área→área. */}
      <Handle type="target" position={Position.Top} isConnectable={false} className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="!opacity-0" />
      <div
        className="pointer-events-auto flex items-center justify-between gap-2 rounded-t-3xl px-4"
        style={{ height: TITLE_H, background: hexToRgba(d.color, 0.16) }}
      >
        <div className="flex items-center gap-2 truncate">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: d.color }} />
          <span className="truncate text-sm font-semibold text-foreground">{d.nombre}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded-md p-1 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Opciones del área"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => d.onEdit(d.areaId)}>Editar</DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => d.onDelete(d.areaId)}
              className="text-destructive focus:text-destructive"
            >
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default memo(AreaNodeComp);
