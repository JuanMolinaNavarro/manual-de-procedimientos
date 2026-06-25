'use client';

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';

export const RELACION_EDGE_TYPE = 'relacion';

export interface RelacionEdgeData {
  estilo?: string; // solid | dashed | dotted
  color?: string;
  etiqueta?: string | null;
  lineaId?: number; // presente solo en líneas especiales (editables)
  [key: string]: unknown;
}

function dashFor(estilo?: string): string | undefined {
  if (estilo === 'dashed') return '8 6';
  if (estilo === 'dotted') return '1 6';
  return undefined;
}

export default function RelacionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  selected,
}: EdgeProps) {
  const d = (data ?? {}) as RelacionEdgeData;
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const color = d.color ?? '#86868b';

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: dashFor(d.estilo),
        }}
      />
      {d.etiqueta ? (
        <EdgeLabelRenderer>
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              borderColor: color,
            }}
            className="pointer-events-none absolute rounded-full border bg-card px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm"
          >
            {d.etiqueta}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
