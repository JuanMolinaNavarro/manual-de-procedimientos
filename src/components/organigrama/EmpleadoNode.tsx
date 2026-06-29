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
      style={{ width: CARD_W, height: CARD_H }}
      className={[
        'neu-raised group relative flex flex-col rounded-2xl p-3 transition-shadow',
        selected
          ? 'outline outline-2 outline-offset-2 outline-[var(--neu-accent)]'
          : esJefe
            ? 'outline outline-2 outline-offset-2 outline-amber-400'
            : '',
        dimmed ? 'opacity-40' : 'opacity-100',
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
        <div className="relative shrink-0">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={emp.nombre} className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div className="neu-inset flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-[var(--neu-fg-soft)]">
              {iniciales(emp.nombre)}
            </div>
          )}
          <span
            title={inactivo ? 'Inactivo' : 'Activo'}
            className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--neu-bg)] ${
              inactivo ? 'bg-[var(--neu-fg-soft)]' : 'bg-green-500'
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            {areaColor && (
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                style={{ background: areaColor }}
              />
            )}
            <span className="line-clamp-2 text-sm font-semibold leading-tight text-[var(--neu-fg)]">
              {emp.nombre}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-[var(--neu-fg-soft)]">{emp.rol}</p>
        </div>
      </div>

      <div className="mt-auto space-y-0.5 pt-2 text-[11px] text-[var(--neu-fg-soft)]">
        {emp.email && <p className="truncate">✉ {emp.email}</p>}
        {emp.telefono && <p className="truncate">☎ Interno {emp.telefono}</p>}
      </div>

      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-muted-foreground" />
    </div>
  );
}

export default memo(EmpleadoNodeComp);
