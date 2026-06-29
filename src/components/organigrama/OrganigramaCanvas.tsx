'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Panel,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useOrganigrama } from './useOrganigrama';
import { computeLayout, CARD_W, CARD_H, type AreaBox } from './layout';
import EmpleadoNode, { EMPLEADO_NODE_TYPE, type EmpleadoNodeData } from './EmpleadoNode';
import AreaNode, { AREA_NODE_TYPE, type AreaNodeData } from './AreaNode';
import RelacionEdge, { RELACION_EDGE_TYPE, type RelacionEdgeData } from './RelacionEdge';
import Toolbar from './Toolbar';
import FichaModal from './FichaModal';
import AreaFormDialog from './AreaFormDialog';
import EmpresaFormDialog from './EmpresaFormDialog';
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
import type { OrgEmpleado, OrgLinea, OrgArea, Organigrama } from '@/lib/organigrama';

const nodeTypes = { [EMPLEADO_NODE_TYPE]: EmpleadoNode, [AREA_NODE_TYPE]: AreaNode };
const edgeTypes = { [RELACION_EDGE_TYPE]: RelacionEdge };

function matchesQuery(emp: OrgEmpleado, q: string): boolean {
  if (!q) return true;
  const hay = [
    emp.nombre,
    emp.rol,
    emp.area,
    emp.email ?? '',
    ...(emp.skills ?? []),
    ...((emp.hard_skills ?? []).map((s) => s.name)),
    ...((emp.soft_skills ?? []).map((s) => s.name)),
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

function CanvasInner({ canEdit }: { canEdit: boolean }) {
  const api = useOrganigrama();
  const { empleados, areas, lineas, loading, error, reload, organigramas, orgId } = api;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [search, setSearch] = useState('');
  // Últimas cajas de área y posiciones calculadas, para detección de drop y snap-back.
  const areaBoxesRef = useRef<Record<string, AreaBox>>({});
  const empAbsRef = useRef<Record<number, { x: number; y: number }>>({});
  // Área resaltada como destino mientras se arrastra una viñeta.
  const dragTargetRef = useRef<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [startEdit, setStartEdit] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [creatingEmpleado, setCreatingEmpleado] = useState(false);
  const [editLinea, setEditLinea] = useState<OrgLinea | null>(null);
  const [areaDialog, setAreaDialog] = useState<{ open: boolean; area: OrgArea | null }>({
    open: false,
    area: null,
  });
  const [empresaDialog, setEmpresaDialog] = useState<{ open: boolean; empresa: Organigrama | null }>({
    open: false,
    empresa: null,
  });
  // "Crear jefe" desde el diálogo de área: abre la ficha en alta por encima y, al
  // guardar, el empleado creado se preselecciona como jefe (nuevoJefeId).
  const [creatingJefe, setCreatingJefe] = useState(false);
  const [nuevoJefeId, setNuevoJefeId] = useState<number | null>(null);

  // ── Handlers de áreas (menú del AreaNode / leyenda) ──
  const onEditArea = useCallback(
    (id: number) => {
      if (!canEdit) return;
      const area = areas.find((a) => a.id === id) ?? null;
      if (area) setAreaDialog({ open: true, area });
    },
    [areas, canEdit],
  );
  const onDeleteArea = useCallback(
    (id: number) => {
      if (!canEdit) return;
      const area = areas.find((a) => a.id === id);
      if (window.confirm(`¿Eliminar el área "${area?.nombre}"? Sus empleados quedarán sin área.`)) {
        api.deleteArea(id).catch(() => {});
      }
    },
    [areas, api, canEdit],
  );

  // ── Construcción de nodos/edges desde los datos ──
  useEffect(() => {
    const { areaBoxes, empAbs, areaEdges } = computeLayout(empleados, areas);
    areaBoxesRef.current = areaBoxes;
    empAbsRef.current = empAbs;
    const colorByArea = new Map(areas.map((a) => [a.nombre, a.color] as const));
    const idByArea = new Map(areas.map((a) => [a.nombre, a.id] as const));
    const jefeIds = new Set(
      areas.map((a) => a.jefe_id).filter((id): id is number => id != null),
    );

    // Áreas: cajas de fondo (no arrastrables) detrás de las viñetas. Solo las que
    // tienen miembros (computeLayout omite las vacías).
    const areaNodes: Node[] = areas
      .filter((a) => areaBoxes[a.nombre])
      .map((a) => {
        const box = areaBoxes[a.nombre];
        const data: AreaNodeData = {
          areaId: a.id,
          nombre: a.nombre,
          color: a.color,
          width: box.w,
          height: box.h,
          isDropTarget: false,
          canEdit,
          onEdit: onEditArea,
          onDelete: onDeleteArea,
        };
        return {
          id: `area-${a.id}`,
          type: AREA_NODE_TYPE,
          position: { x: box.x, y: box.y },
          data: data as unknown as Record<string, unknown>,
          draggable: false,
          selectable: false,
          zIndex: 0,
        };
      });

    // Empleados: nodos sueltos en posición absoluta (jefe arriba, miembros debajo).
    const empNodes: Node[] = empleados.map((e) => {
      const data: EmpleadoNodeData = {
        empleado: e,
        dimmed: !matchesQuery(e, search),
        areaColor: colorByArea.get(e.area),
        esJefe: jefeIds.has(e.id),
      };
      return {
        id: `emp-${e.id}`,
        type: EMPLEADO_NODE_TYPE,
        position: empAbs[e.id] ?? { x: 40, y: 40 },
        data: data as unknown as Record<string, unknown>,
        zIndex: 1,
      };
    });

    // áreas (fondo) antes que empleados
    setNodes([...areaNodes, ...empNodes]);

    // Jerarquía: líneas SOLO entre áreas (área padre → área hija). Sin flecha, estilo
    // "smoothstep" (codos) para el look de organigrama. Dentro de cada área no hay líneas.
    const areaHierEdges: Edge[] = areaEdges
      .map(({ parent, child }) => {
        const pid = idByArea.get(parent);
        const cid = idByArea.get(child);
        if (pid == null || cid == null) return null;
        return {
          id: `aedge-${cid}`,
          source: `area-${pid}`,
          target: `area-${cid}`,
          type: 'smoothstep',
          style: { stroke: '#94a3b8', strokeWidth: 2 },
        } as Edge;
      })
      .filter((e): e is Edge => e !== null);

    // Relaciones especiales (opcionales) entre empleados: se mantienen.
    const empIds = new Set(empleados.map((e) => e.id));
    const specialEdges: Edge[] = lineas
      .filter((l) => empIds.has(l.from_id) && empIds.has(l.to_id))
      .map((l) => ({
        id: `lin-${l.id}`,
        source: `emp-${l.from_id}`,
        target: `emp-${l.to_id}`,
        type: RELACION_EDGE_TYPE,
        data: {
          estilo: l.estilo,
          color: l.color,
          etiqueta: l.etiqueta,
          lineaId: l.id,
        } as RelacionEdgeData as unknown as Record<string, unknown>,
        markerEnd: { type: MarkerType.ArrowClosed, color: l.color, width: 16, height: 16 },
      }));
    setEdges([...areaHierEdges, ...specialEdges]);
  }, [empleados, areas, lineas, search, setNodes, setEdges, onEditArea, onDeleteArea, canEdit]);

  // ── Drag: resalta la caja del área (distinta a la actual) bajo el centro de la viñeta.
  const onNodeDrag = useCallback<OnNodeDrag<Node>>(
    (_e, node) => {
      if (node.type !== EMPLEADO_NODE_TYPE) return;
      const empId = Number(node.id.slice(4));
      const areaActual = empleados.find((e) => e.id === empId)?.area;
      const cx = node.position.x + CARD_W / 2;
      const cy = node.position.y + CARD_H / 2;
      let hit: string | null = null;
      for (const [nombre, b] of Object.entries(areaBoxesRef.current)) {
        if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
          hit = nombre;
          break;
        }
      }
      const hl = hit && hit !== areaActual ? hit : null;
      if (hl !== dragTargetRef.current) {
        dragTargetRef.current = hl;
        setNodes((nds) =>
          nds.map((n) =>
            n.type === AREA_NODE_TYPE
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    isDropTarget: (n.data as unknown as AreaNodeData).nombre === hl,
                  },
                }
              : n,
          ),
        );
      }
    },
    [empleados, setNodes],
  );

  // ── Drag stop: si se soltó sobre OTRA área, el empleado cambia de área y su "Reporta a"
  // pasa a ser el jefe de esa área. En cualquier otro caso, vuelve a su lugar (snap-back).
  const onNodeDragStop = useCallback<OnNodeDrag<Node>>(
    (_e, node) => {
      if (!canEdit) return;
      if (node.type !== EMPLEADO_NODE_TYPE) return;
      // Limpiar el resaltado del área destino.
      if (dragTargetRef.current !== null) {
        dragTargetRef.current = null;
        setNodes((nds) =>
          nds.map((n) =>
            n.type === AREA_NODE_TYPE ? { ...n, data: { ...n.data, isDropTarget: false } } : n,
          ),
        );
      }
      const empId = Number(node.id.slice(4));
      const areaActual = empleados.find((e) => e.id === empId)?.area;
      const cx = node.position.x + CARD_W / 2;
      const cy = node.position.y + CARD_H / 2;
      let target: string | null = null;
      for (const [nombre, b] of Object.entries(areaBoxesRef.current)) {
        if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
          target = nombre;
          break;
        }
      }
      if (target && target !== areaActual) {
        const jefeId = areas.find((a) => a.nombre === target)?.jefe_id ?? null;
        const patch: { area: string; manager_id?: number } = { area: target };
        if (jefeId != null && jefeId !== empId) patch.manager_id = jefeId;
        api.updateEmpleado(empId, patch).catch(() => {});
      } else {
        const pos = empAbsRef.current[empId];
        if (pos) setNodes((nds) => nds.map((n) => (n.id === node.id ? { ...n, position: pos } : n)));
      }
    },
    [api, empleados, areas, setNodes, canEdit],
  );

  // ── Conectar (arrastrar handle→handle): crea línea especial ──
  const onConnect = useCallback(
    (c: Connection) => {
      if (!canEdit) return;
      if (!c.source || !c.target || c.source === c.target) return;
      const from = Number(c.source.slice(4));
      const to = Number(c.target.slice(4));
      if (!from || !to) return;
      api
        .createLinea({ from_id: from, to_id: to, tipo: 'special', estilo: 'dashed', color: '#5856D6', etiqueta: '' })
        .catch(() => {});
    },
    [api, canEdit],
  );

  const onNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    if (node.type === EMPLEADO_NODE_TYPE) {
      setSelectedId(Number(node.id.slice(4)));
      setStartEdit(false);
      setModalOpen(true);
    }
  }, []);

  const onEdgeClick = useCallback(
    (_e: React.MouseEvent, edge: Edge) => {
      if (!canEdit) return;
      const lineaId = (edge.data as RelacionEdgeData | undefined)?.lineaId;
      if (lineaId != null) {
        const l = lineas.find((x) => x.id === lineaId);
        if (l) setEditLinea(l);
      }
    },
    [lineas, canEdit],
  );

  // ── Toolbar actions ──
  // "Nuevo empleado": NO crea nada todavía; abre la ficha en modo alta. El alta
  // ocurre recién al Guardar (onCreate).
  const handleAddEmpleado = useCallback(() => {
    setSelectedId(null);
    setCreatingJefe(false);
    setCreatingEmpleado(true);
    setStartEdit(true);
    setModalOpen(true);
  }, []);

  // Crear un empleado nuevo (ficha por encima del diálogo de área) para usarlo de jefe.
  const handleCreateJefe = useCallback(() => {
    setSelectedId(null);
    setCreatingJefe(true);
    setCreatingEmpleado(true);
    setStartEdit(true);
    setModalOpen(true);
  }, []);

  const handleAddArea = useCallback(() => {
    setAreaDialog({ open: true, area: null });
  }, []);

  const handleReorganizar = useCallback(async () => {
    await Promise.all([
      ...empleados
        .filter((e) => e.free_x != null || e.free_y != null)
        .map((e) => api.updateEmpleado(e.id, { free_x: null, free_y: null })),
      ...areas
        .filter((a) => a.pos_x != null || a.pos_y != null)
        .map((a) => api.updateArea(a.id, { pos_x: null, pos_y: null })),
    ]).catch(() => {});
  }, [api, empleados, areas]);

  const handleReiniciar = useCallback(async () => {
    if (
      !window.confirm(
        '¿Reiniciar? Se borrará TODO (todas las empresas) y se cargará la empresa de ejemplo.',
      )
    )
      return;
    try {
      await fetch('/api/admin/organigrama/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });
      await reload();
    } catch {}
  }, [reload]);

  const handleCreateOrg = useCallback(() => setEmpresaDialog({ open: true, empresa: null }), []);

  const handleEditOrg = useCallback(() => {
    const o = organigramas.find((x) => x.id === orgId) ?? null;
    if (o) setEmpresaDialog({ open: true, empresa: o });
  }, [organigramas, orgId]);

  const selectedEmp = useMemo(
    () => empleados.find((e) => e.id === selectedId) ?? null,
    [empleados, selectedId],
  );

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        organigramas={organigramas}
        orgId={orgId}
        onSelectOrg={api.setOrgId}
        onCreateOrg={handleCreateOrg}
        onEditOrg={handleEditOrg}
        search={search}
        onSearch={setSearch}
        onAddEmpleado={handleAddEmpleado}
        onAddArea={handleAddArea}
        onReorganizar={handleReorganizar}
        onReiniciar={handleReiniciar}
        canEdit={canEdit}
      />

      {!canEdit && (
        <div className="bg-[var(--neu-bg)] px-4 py-1.5 text-center text-xs text-[var(--neu-fg-soft)]">
          Modo solo lectura — no tenés permiso para editar este organigrama.
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}

      <div className="relative min-h-0 flex-1">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--neu-bg)]/70 text-sm text-[var(--neu-fg-soft)]">
            Cargando organigrama…
          </div>
        )}
        {!loading && organigramas.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-[var(--neu-fg-soft)]">Todavía no hay empresas.</p>
            {canEdit && (
              <Button
                variant="ghost"
                className="neu-btn h-10 rounded-xl"
                onClick={async () => {
                  try {
                    await fetch('/api/admin/organigrama/seed', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      // reset: limpia datos huérfanos previos y crea la empresa de ejemplo.
                      body: JSON.stringify({ reset: true }),
                    });
                    await reload();
                  } catch {}
                }}
              >
                Cargar empresa de ejemplo
              </Button>
            )}
          </div>
        )}
        {!loading && organigramas.length > 0 && empleados.length === 0 && areas.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-[var(--neu-fg-soft)]">
              Esta empresa está vacía. Agregá un empleado o un área con los botones de arriba.
            </p>
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={canEdit}
          nodesConnectable={canEdit}
          fitView
          minZoom={0.2}
          maxZoom={1.6}
          zoomActivationKeyCode={['Meta', 'Control']}
          panOnScroll
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={26} size={1} className="opacity-50" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!hidden md:!block" />
          {areas.length > 0 && (
            <Panel position="top-left" className="neu-raised !m-3 max-w-[260px] rounded-2xl p-3">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--neu-fg-soft)]">
                  Áreas
                </span>
                {canEdit && (
                  <button
                    onClick={handleAddArea}
                    className="text-xs font-semibold text-[var(--neu-accent)] hover:underline"
                  >
                    + Área
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {areas.map((a) => {
                  const count = empleados.filter((e) => e.area === a.nombre).length;
                  const inner = (
                    <>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
                      <span className="text-[var(--neu-fg)]">{a.nombre}</span>
                      <span className="text-[var(--neu-fg-soft)]">{count}</span>
                    </>
                  );
                  const cls =
                    'neu-raised-sm flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]';
                  return canEdit ? (
                    <button
                      key={a.id}
                      onClick={() => onEditArea(a.id)}
                      className={`${cls} transition-shadow active:shadow-none`}
                      title="Editar área"
                    >
                      {inner}
                    </button>
                  ) : (
                    <div key={a.id} className={cls}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      <FichaModal
        empleado={selectedEmp}
        empleados={empleados}
        areas={areas}
        open={modalOpen}
        creating={creatingEmpleado}
        startInEdit={startEdit}
        canEdit={canEdit}
        onOpenChange={(o) => {
          setModalOpen(o);
          if (!o) {
            setSelectedId(null);
            setCreatingEmpleado(false);
            setCreatingJefe(false);
          }
        }}
        onSave={async (id, data) => {
          await api.updateEmpleado(id, data);
        }}
        onCreate={async (data, foto) => {
          const emp = await api.createEmpleado(data);
          if (foto) {
            try {
              await api.uploadFoto(emp.id, foto);
            } catch {}
          }
          setModalOpen(false);
          setCreatingEmpleado(false);
          setSelectedId(null);
          // Si se creó como jefe, queda preseleccionado en el diálogo de área (sigue abierto).
          if (creatingJefe) {
            setCreatingJefe(false);
            setNuevoJefeId(emp.id);
          }
        }}
        onDelete={async (id) => {
          if (window.confirm('¿Eliminar este empleado?')) {
            await api.deleteEmpleado(id);
            setModalOpen(false);
            setSelectedId(null);
          }
        }}
        onUploadFoto={async (id, blob) => {
          await api.uploadFoto(id, blob);
        }}
        onDeleteFoto={api.deleteFoto}
      />

      <EdgeEditDialog
        key={editLinea?.id ?? 'none'}
        linea={editLinea}
        onClose={() => setEditLinea(null)}
        onSave={async (id, patch) => {
          await api.updateLinea(id, patch);
          setEditLinea(null);
        }}
        onDelete={async (id) => {
          await api.deleteLinea(id);
          setEditLinea(null);
        }}
      />

      <AreaFormDialog
        key={`${areaDialog.area?.id ?? 'new'}:${areaDialog.open}`}
        open={areaDialog.open}
        area={areaDialog.area}
        miembros={empleados}
        areas={areas}
        onCreateJefe={handleCreateJefe}
        forcedJefeId={nuevoJefeId}
        onOpenChange={(o) => {
          setAreaDialog((s) => ({ ...s, open: o }));
          if (!o) setNuevoJefeId(null);
        }}
        onSubmit={async ({ nombre, color, jefe_id, parent_id }) => {
          const area = areaDialog.area
            ? await api.updateArea(areaDialog.area.id, { nombre, color, jefe_id, parent_id })
            : await api.createArea({ nombre, color, jefe_id, parent_id });
          // El jefe elegido se mueve a esta área (sobreescribe su área anterior).
          if (jefe_id != null && area) await api.updateEmpleado(jefe_id, { area: area.nombre });
        }}
      />

      <EmpresaFormDialog
        key={`${empresaDialog.empresa?.id ?? 'new'}:${empresaDialog.open}`}
        open={empresaDialog.open}
        empresa={empresaDialog.empresa}
        onOpenChange={(o) => setEmpresaDialog((s) => ({ ...s, open: o }))}
        onSubmit={async ({ nombre, direccion }) => {
          if (empresaDialog.empresa)
            await api.updateOrganigrama(empresaDialog.empresa.id, { nombre, direccion });
          else await api.createOrganigrama(nombre, direccion);
        }}
      />
    </div>
  );
}

// ── Diálogo de edición de línea especial ──
function EdgeEditDialog({
  linea,
  onClose,
  onSave,
  onDelete,
}: {
  linea: OrgLinea | null;
  onClose: () => void;
  onSave: (id: number, patch: { estilo: string; color: string; etiqueta: string | null }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  // El componente se remonta por `key={linea.id}` desde el padre, así que el estado
  // inicial se toma de la línea sin necesidad de un efecto de sincronización.
  const [estilo, setEstilo] = useState(linea?.estilo ?? 'solid');
  const [color, setColor] = useState(linea?.color ?? '#5856D6');
  const [etiqueta, setEtiqueta] = useState(linea?.etiqueta ?? '');

  return (
    <Dialog open={linea != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="neu-surface max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>Editar relación</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Estilo</Label>
            <Select value={estilo} onValueChange={setEstilo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">Sólida</SelectItem>
                <SelectItem value="dashed">Trazos</SelectItem>
                <SelectItem value="dotted">Puntos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Color</Label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-full cursor-pointer rounded-md border border-input bg-transparent"
            />
          </div>
          <div className="space-y-1">
            <Label>Etiqueta</Label>
            <Input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder="Ej. Vacaciones, Mentoría…" />
          </div>
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={() => linea && onDelete(linea.id)}
          >
            Eliminar
          </Button>
          <Button
            onClick={() => linea && onSave(linea.id, { estilo, color, etiqueta: etiqueta || null })}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function OrganigramaCanvas({ canEdit }: { canEdit: boolean }) {
  return (
    <ReactFlowProvider>
      <CanvasInner canEdit={canEdit} />
    </ReactFlowProvider>
  );
}
