/**
 * Layout del organigrama por ÁREAS con dependencias (sub-áreas) y jefe de área:
 *
 *  - La jerarquía entre áreas es EXPLÍCITA: `OrgArea.parent_id` ("Depende de Área").
 *    Cada sub-área se ubica DEBAJO de su área padre (dagre, top-down) conectada por línea.
 *  - Cada área puede tener un jefe (`OrgArea.jefe_id`): se ubica arriba del área (tier 0,
 *    centrado) y el resto de los miembros debajo, en grilla. No hay líneas dentro del área.
 *  - Se muestran las áreas con miembros y, además, sus áreas ancestro (aunque estén vacías)
 *    para que la cadena de dependencias se vea completa.
 */
import dagre from '@dagrejs/dagre';
import type { OrgEmpleado, OrgArea } from '@/lib/organigrama';

export const CARD_W = 210;
export const CARD_H = 124;
export const TITLE_H = 44;
const GAP_X = 24;
const GAP_Y = 28;
const PAD = 22;
const COLS = 3; // miembros por fila (debajo del jefe)
const AREA_NODESEP = 72; // separación horizontal entre áreas hermanas
const AREA_RANKSEP = 104; // separación vertical entre niveles de áreas
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
  areaBoxes: Record<string, AreaBox>;
  empAbs: Record<number, { x: number; y: number }>;
  /** Aristas jerárquicas área→área (padre → sub-área). */
  areaEdges: Array<{ parent: string; child: string }>;
}

export function computeLayout(empleados: OrgEmpleado[], areas: OrgArea[]): LayoutResult {
  const areaBoxes: Record<string, AreaBox> = {};
  const empAbs: Record<number, { x: number; y: number }> = {};
  const areaEdges: Array<{ parent: string; child: string }> = [];

  const areaByName = new Map(areas.map((a) => [a.nombre, a] as const));
  const areaById = new Map(areas.map((a) => [a.id, a] as const));

  const membersByArea = new Map<string, OrgEmpleado[]>();
  for (const e of empleados) {
    if (!areaByName.has(e.area)) continue; // flotantes (área inexistente)
    const list = membersByArea.get(e.area) ?? [];
    list.push(e);
    membersByArea.set(e.area, list);
  }

  // Áreas a mostrar = las que tienen miembros + todos sus ancestros (vía parent_id),
  // así una sub-área se ve aunque su padre esté vacío.
  const shown = new Set<string>();
  for (const a of areas) {
    if ((membersByArea.get(a.nombre)?.length ?? 0) === 0) continue;
    shown.add(a.nombre);
    let cur = a.parent_id;
    const seen = new Set<number>();
    while (cur != null && !seen.has(cur)) {
      seen.add(cur);
      const parent = areaById.get(cur);
      if (!parent) break;
      shown.add(parent.nombre);
      cur = parent.parent_id;
    }
  }
  const shownAreas = areas.filter((a) => shown.has(a.nombre));
  if (shownAreas.length === 0) return { areaBoxes, empAbs, areaEdges };

  // Filas por área (jefe arriba, resto en grilla) y tamaño de la caja.
  interface Info {
    rows: OrgEmpleado[][];
    w: number;
    h: number;
  }
  const info = new Map<string, Info>();
  for (const a of shownAreas) {
    const members = membersByArea.get(a.nombre) ?? [];
    const jefe = a.jefe_id != null ? members.find((m) => m.id === a.jefe_id) : undefined;
    const rest = members.filter((m) => m.id !== jefe?.id);
    const rows: OrgEmpleado[][] = [];
    if (jefe) rows.push([jefe]);
    for (let i = 0; i < rest.length; i += COLS) rows.push(rest.slice(i, i + COLS));
    const maxCols = rows.length ? Math.max(1, ...rows.map((r) => r.length)) : 1;
    const innerW = maxCols * CARD_W + (maxCols - 1) * GAP_X;
    const innerH = rows.length ? rows.length * CARD_H + (rows.length - 1) * GAP_Y : 0;
    info.set(a.nombre, {
      rows,
      w: innerW + 2 * PAD,
      h: (rows.length ? innerH + 2 * PAD : PAD) + TITLE_H,
    });
  }

  // Aristas: parent_id → área (si el padre también se muestra).
  for (const a of shownAreas) {
    if (a.parent_id == null) continue;
    const parent = areaById.get(a.parent_id);
    if (parent && parent.nombre !== a.nombre && shown.has(parent.nombre)) {
      areaEdges.push({ parent: parent.nombre, child: a.nombre });
    }
  }

  // Árbol de áreas con dagre.
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'TB',
    nodesep: AREA_NODESEP,
    ranksep: AREA_RANKSEP,
    marginx: MARGIN,
    marginy: MARGIN,
  });
  g.setDefaultEdgeLabel(() => ({}));
  for (const a of shownAreas) {
    const i = info.get(a.nombre)!;
    g.setNode(a.nombre, { width: i.w, height: i.h });
  }
  for (const e of areaEdges) g.setEdge(e.parent, e.child);
  dagre.layout(g);

  for (const a of shownAreas) {
    const i = info.get(a.nombre)!;
    const n = g.node(a.nombre);
    const x = n.x - i.w / 2;
    const y = n.y - i.h / 2;
    areaBoxes[a.nombre] = { nombre: a.nombre, color: a.color, is_top: a.is_top, x, y, w: i.w, h: i.h };

    i.rows.forEach((row, ri) => {
      const rowW = row.length * CARD_W + (row.length - 1) * GAP_X;
      const startX = x + (i.w - rowW) / 2;
      const rowY = y + TITLE_H + PAD + ri * (CARD_H + GAP_Y);
      row.forEach((m, ci) => {
        empAbs[m.id] = { x: startX + ci * (CARD_W + GAP_X), y: rowY };
      });
    });
  }

  return { areaBoxes, empAbs, areaEdges };
}
