'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { OrgEmpleado } from '@/lib/organigrama';
import { CARD_W, CARD_H } from './layout';

export const EMPLEADO_NODE_TYPE = 'empleado';

export interface EmpleadoNodeData {
  empleado: OrgEmpleado;
  dimmed?: boolean;
  areaColor?: string;
  esJefe?: boolean;
  [key: string]: unknown;
}

export function fotoUrl(emp: OrgEmpleado): string | null {
  return emp.foto_archivo
    ? `/api/admin/organigrama/empleados/${emp.id}/foto?n=${encodeURIComponent(emp.foto_archivo)}`
    : null;
}

export function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function EmpleadoNodeComp({ data, selected }: NodeProps) {
  const { empleado: emp, dimmed, areaColor, esJefe } = data as EmpleadoNodeData;
  const url = fotoUrl(emp);
  const inactivo = emp.estado === 'inactive';

  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        borderLeftWidth: areaColor ? 5 : undefined,
        borderLeftColor: areaColor,
      }}
      className={[
        'group relative flex flex-col rounded-2xl border bg-card p-3 shadow-sm transition-all',
        selected
          ? 'border-primary ring-2 ring-primary/30'
          : esJefe
            ? 'border-amber-300 ring-2 ring-amber-400/60'
            : 'border-border',
        dimmed ? 'opacity-25' : 'opacity-100',
        inactivo ? 'grayscale' : '',
      ].join(' ')}
    >
      {esJefe && (
        <div className="absolute -top-2 left-3 z-10 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-amber-950 shadow">
          Jefe de área
        </div>
      )}
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-muted-foreground" />

      <div className="flex items-start gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={emp.nombre}
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {iniciales(emp.nombre)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{emp.nombre}</p>
          <p className="truncate text-xs text-muted-foreground">{emp.rol}</p>
        </div>
        <span
          className={[
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
            inactivo ? 'bg-muted text-muted-foreground' : 'bg-green-500/15 text-green-600 dark:text-green-400',
          ].join(' ')}
        >
          {inactivo ? 'Inactivo' : 'Activo'}
        </span>
      </div>

      <div className="mt-auto space-y-0.5 pt-2 text-[11px] text-muted-foreground">
        {emp.email && <p className="truncate">✉ {emp.email}</p>}
        {emp.telefono && <p className="truncate">☎ Interno {emp.telefono}</p>}
      </div>

      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-muted-foreground" />
    </div>
  );
}

export default memo(EmpleadoNodeComp);
