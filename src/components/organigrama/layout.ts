/**
 * Layout del organigrama: árbol jerárquico top-down (estructura clásica de organigrama).
 *
 * Usa dagre (rankdir 'TB') sobre la relación de reporte (`manager_id`): el jefe queda
 * arriba y sus reportes debajo, centrados, con separación automática y sin solapamiento.
 * Las áreas se dibujan como zonas de color DETRÁS de sus miembros (bounding box), no
 * condicionan el posicionamiento — el que manda es la jerarquía.
 */
import dagre from '@dagrejs/dagre';
import type { OrgEmpleado, OrgArea } from '@/lib/organigrama';

export const CARD_W = 210;
export const CARD_H = 124;
export const TITLE_H = 40;
const AREA_PAD = 26;
const NODESEP = 44; // separación horizontal entre hermanos
const RANKSEP = 96; // separación vertical entre niveles
const MARGIN = 60;

export interface AreaBox {
  nombre: string;
  color: string;
  is_top: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutResult {
  /** Caja absoluta por nombre de área (solo áreas con al menos un miembro). */
  areaBoxes: Record<string, AreaBox>;
  /** Posición absoluta (top-left) auto-calculada por id de empleado. */
  empAbs: Record<number, { x: number; y: number }>;
}

export function computeLayout(empleados: OrgEmpleado[], areas: OrgArea[]): LayoutResult {
  const empAbs: Record<number, { x: number; y: number }> = {};
  const areaBoxes: Record<string, AreaBox> = {};
  if (empleados.length === 0) return { areaBoxes, empAbs };

  const ids = new Set(empleados.map((e) => e.id));

  // 1) Árbol top-down con dagre sobre la jerarquía de reporte.
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: NODESEP, ranksep: RANKSEP, marginx: MARGIN, marginy: MARGIN });
  g.setDefaultEdgeLabel(() => ({}));
  for (const e of empleados) g.setNode(String(e.id), { width: CARD_W, height: CARD_H });
  for (const e of empleados) {
    if (e.manager_id != null && ids.has(e.manager_id)) {
      g.setEdge(String(e.manager_id), String(e.id));
    }
  }
  dagre.layout(g);
  for (const e of empleados) {
    const n = g.node(String(e.id));
    if (n) empAbs[e.id] = { x: n.x - CARD_W / 2, y: n.y - CARD_H / 2 };
  }

  // 2) Posición efectiva por empleado (libre si fue arrastrado; si no, la del árbol).
  const eff = (e: OrgEmpleado): { x: number; y: number } =>
    e.free_x != null && e.free_y != null
      ? { x: e.free_x, y: e.free_y }
      : empAbs[e.id] ?? { x: 0, y: 0 };

  // 3) Cajas de área = bounding box de los miembros + padding + barra de título.
  for (const area of areas) {
    const miembros = empleados.filter((e) => e.area === area.nombre);
    if (miembros.length === 0) continue; // áreas sin gente no dibujan caja
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const m of miembros) {
      const p = eff(m);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + CARD_W);
      maxY = Math.max(maxY, p.y + CARD_H);
    }
    areaBoxes[area.nombre] = {
      nombre: area.nombre,
      color: area.color,
      is_top: area.is_top,
      x: minX - AREA_PAD,
      y: minY - AREA_PAD - TITLE_H,
      w: maxX - minX + 2 * AREA_PAD,
      h: maxY - minY + 2 * AREA_PAD + TITLE_H,
    };
  }

  return { areaBoxes, empAbs };
}
