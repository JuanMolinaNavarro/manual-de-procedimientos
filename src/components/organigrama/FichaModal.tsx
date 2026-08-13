'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X, Trash2, Upload, Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type {
  OrgEmpleado,
  OrgArea,
  CreateOrgEmpleadoData,
  UpdateOrgEmpleadoData,
  Experiencia,
  HardSkill,
  SoftSkill,
  HorarioDia,
} from '@/lib/organigrama';

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
import { fotoUrl, iniciales } from './EmpleadoNode';
import { resizeImageTo } from './image';
import ProyectosDelEmpleado, { useProyectosDeEmpleado } from './ProyectosDelEmpleado';
import DocumentosDelEmpleado, { useDocumentosDeEmpleado } from './DocumentosDelEmpleado';

interface FichaModalProps {
  empleado: OrgEmpleado | null;
  empleados: OrgEmpleado[];
  areas: OrgArea[];
  open: boolean;
  /** true → modal en modo alta: form en blanco, se crea recién al Guardar. */
  creating?: boolean;
  startInEdit?: boolean;
  /** Si es false, la ficha es de solo lectura (sin botón Editar ni alta). */
  canEdit?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: number, data: UpdateOrgEmpleadoData) => Promise<void>;
  onCreate: (data: CreateOrgEmpleadoData, foto?: Blob) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onUploadFoto: (id: number, blob: Blob) => Promise<void>;
  onDeleteFoto: (id: number) => Promise<void>;
}

type Form = OrgEmpleado;

const SEDE_LABEL = 'Sede';

/** Empleado en blanco para el modo alta (id 0 = placeholder en memoria). */
function blankEmpleado(areaDefault: string): OrgEmpleado {
  return {
    id: 0,
    organigrama_id: null,
    nombre: '',
    rol: '',
    area: areaDefault,
    manager_id: null,
    email: null,
    telefono: null,
    foto_archivo: null,
    estado: 'active',
    sede: null,
    horario: null,
    modalidad: null,
    guardias: null,
    horarios: null,
    actualizado: null,
    summary: null,
    antiguedad: null,
    formacion: null,
    seniority: null,
    especialidad: null,
    fecha_nacimiento: null,
    experiencia: [],
    resp_primarias: [],
    resp_secundarias: [],
    inputs: [],
    outputs: [],
    hard_skills: [],
    soft_skills: [],
    skills: [],
    projects: [],
    proyectos_actuales: [],
    free_x: null,
    free_y: null,
    created_by: null,
    updated_by: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

export default function FichaModal({
  empleado,
  empleados,
  areas,
  open,
  creating,
  startInEdit,
  canEdit = true,
  onOpenChange,
  onSave,
  onCreate,
  onDelete,
  onUploadFoto,
  onDeleteFoto,
}: FichaModalProps) {
  const defaultArea = areas[0]?.nombre ?? '';
  const [form, setForm] = useState<Form | null>(empleado);
  const [edit, setEdit] = useState(false);
  const [tab, setTab] = useState('resumen');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // En alta, la foto se difiere: se guarda el blob y se sube recién al crear.
  const [pendingFoto, setPendingFoto] = useState<Blob | null>(null);
  const pendingFotoUrl = useMemo(
    () => (pendingFoto ? URL.createObjectURL(pendingFoto) : null),
    [pendingFoto],
  );
  const fileRef = useRef<HTMLInputElement>(null);

  // Proyectos del módulo Proyectos y finanzas en los que participa la persona.
  // Se pide acá (y no en la pestaña) porque el resultado define si la pestaña
  // se muestra: en modo lectura las vacías se ocultan.
  const estadoProyectos = useProyectosDeEmpleado(empleado?.id ?? null, open && !creating);
  // Documentación de procedimientos del rol (su pestaña se muestra siempre).
  const estadoDocs = useDocumentosDeEmpleado(empleado?.id ?? null, open && !creating);

  useEffect(() => {
    setForm(creating ? blankEmpleado(defaultArea) : empleado);
    setEdit(canEdit ? (creating ? true : Boolean(startInEdit)) : false);
    setErr(null);
    setPendingFoto(null);
    setTab('resumen');
  }, [empleado, creating, startInEdit, open, defaultArea, canEdit]);

  // Descendientes del empleado actual: no pueden ser su jefe (anti-ciclos en cliente).
  const descendientes = useMemo(() => {
    if (!empleado) return new Set<number>();
    const out = new Set<number>();
    const stack = [empleado.id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const e of empleados) {
        if (e.manager_id === cur && !out.has(e.id)) {
          out.add(e.id);
          stack.push(e.id);
        }
      }
    }
    return out;
  }, [empleado, empleados]);

  if (!form) return null;
  const emp = form;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const url = creating ? pendingFotoUrl : fotoUrl(emp);

  // ── Visibilidad de pestañas ──
  // En modo lectura ocultamos las pestañas sin información cargada; en edición se
  // muestran todas para poder agregar datos.
  const hasText = (s?: string | null) => Boolean(s && s.trim());
  const hasList = (a?: (string | null)[] | null) =>
    (a ?? []).some((s) => s != null && String(s).trim() !== '');
  const hasItems = (a?: unknown[] | null) => (a ?? []).length > 0;
  const tieneHorarios = (emp.horarios ?? []).some((h) => h.valor && h.valor.trim() !== '');

  const TABS: { value: string; label: string; full: boolean }[] = [
    { value: 'resumen', label: 'Resumen', full: hasText(emp.summary) || tieneHorarios },
    {
      value: 'resp',
      label: 'Responsabilidades',
      full: hasList(emp.resp_primarias) || hasList(emp.resp_secundarias),
    },
    { value: 'io', label: 'Inputs/Outputs', full: hasList(emp.inputs) || hasList(emp.outputs) },
    {
      value: 'hab',
      label: 'Habilidades',
      full: hasItems(emp.hard_skills) || hasItems(emp.soft_skills) || hasList(emp.skills),
    },
    { value: 'exp', label: 'Experiencia', full: hasItems(emp.experiencia) },
    {
      value: 'proy',
      label: 'Proyectos',
      full: hasList(emp.projects) || (estadoProyectos.proyectos ?? []).length > 0,
    },
    // Siempre visible (a diferencia del resto): la documentación del rol debe
    // poder encontrarse aunque todavía no haya archivos cargados.
    { value: 'docs', label: 'Documentación', full: true },
    {
      value: 'mas',
      label: 'Más Info',
      full:
        hasText(emp.antiguedad) ||
        hasText(emp.formacion) ||
        hasText(emp.seniority) ||
        hasText(emp.especialidad) ||
        hasText(emp.actualizado),
    },
  ];
  const visibleTabs = edit ? TABS : TABS.filter((t) => t.full);
  const activeTab = visibleTabs.some((t) => t.value === tab) ? tab : visibleTabs[0]?.value ?? '';

  async function handleSave() {
    if (!form) return;
    if (!form.nombre.trim()) {
      setErr('El nombre es requerido');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const data = {
        nombre: form.nombre.trim(),
        rol: form.rol.trim() || 'Sin rol',
        area: form.area,
        manager_id: form.manager_id,
        email: form.email,
        telefono: form.telefono,
        estado: form.estado,
        sede: form.sede,
        horario: form.horario,
        modalidad: form.modalidad,
        guardias: form.guardias,
        horarios: form.horarios ?? [],
        actualizado: form.actualizado,
        summary: form.summary,
        antiguedad: form.antiguedad,
        formacion: form.formacion,
        seniority: form.seniority,
        especialidad: form.especialidad,
        fecha_nacimiento: form.fecha_nacimiento || null,
        experiencia: form.experiencia ?? [],
        resp_primarias: form.resp_primarias ?? [],
        resp_secundarias: form.resp_secundarias ?? [],
        inputs: form.inputs ?? [],
        outputs: form.outputs ?? [],
        hard_skills: form.hard_skills ?? [],
        soft_skills: form.soft_skills ?? [],
        skills: form.skills ?? [],
        projects: form.projects ?? [],
      };
      if (creating) {
        await onCreate(data as CreateOrgEmpleadoData, pendingFoto ?? undefined);
        // el padre cierra el modal al crear con éxito
      } else {
        await onSave(form.id, data as UpdateOrgEmpleadoData);
        setEdit(false);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleFoto(file: File) {
    if (!form) return;
    try {
      const blob = await resizeImageTo(file, 240, 240);
      if (creating) {
        setPendingFoto(blob);
      } else {
        await onUploadFoto(form.id, blob);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo procesar la imagen');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* sm:max-w-5xl pisa el sm:max-w-lg (512px) que trae DialogContent por defecto;
          sin esto el modal quedaba clavado en 512px en pantallas ≥640px. */}
      <DialogContent
        showCloseButton={false}
        className="neu-surface w-[95vw] max-w-5xl gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-5xl"
      >
        <div className="grid md:grid-cols-[260px_1fr]">
          {/* Panel lateral */}
          <aside className="flex flex-col gap-3 p-5">
            <div className="relative mx-auto">
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={emp.nombre} className="h-24 w-24 rounded-2xl object-cover" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-semibold text-primary">
                  {iniciales(emp.nombre)}
                </div>
              )}
              {edit && (
                <div className="mt-2 flex justify-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFoto(f);
                      e.target.value = '';
                    }}
                  />
                  <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                    <Upload className="mr-1 h-3 w-3" /> Foto
                  </Button>
                  {(creating ? pendingFoto : emp.foto_archivo) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => (creating ? setPendingFoto(null) : onDeleteFoto(emp.id))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            <DialogHeader className="space-y-1 text-center">
              {edit ? (
                <>
                  <DialogTitle className="sr-only">
                    {creating ? 'Nuevo empleado' : emp.nombre || 'Empleado'}
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    Edición de ficha del empleado
                  </DialogDescription>
                  <Input
                    value={emp.nombre}
                    onChange={(e) => set('nombre', e.target.value)}
                    placeholder="Nombre y apellido"
                    className="neu-field rounded-lg text-center focus-visible:ring-0"
                  />
                  <Input
                    value={emp.rol}
                    onChange={(e) => set('rol', e.target.value)}
                    placeholder="Rol / puesto"
                    className="neu-field rounded-lg text-center text-sm focus-visible:ring-0"
                  />
                </>
              ) : (
                <>
                  <DialogTitle className="text-center text-lg">{emp.nombre}</DialogTitle>
                  <DialogDescription className="text-center">{emp.rol}</DialogDescription>
                </>
              )}
            </DialogHeader>

            <div className="space-y-2.5 text-xs">
              <Field label="Email" value={emp.email} edit={edit} onChange={(v) => set('email', v)} />
              <Field label="Interno" value={emp.telefono} edit={edit} onChange={(v) => set('telefono', v)} />
              <Field label={SEDE_LABEL} value={emp.sede} edit={edit} onChange={(v) => set('sede', v)} />
              <Field label="Modalidad" value={emp.modalidad} edit={edit} onChange={(v) => set('modalidad', v)} />
              <Field label="Guardias" value={emp.guardias} edit={edit} onChange={(v) => set('guardias', v)} />

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Fecha de nacimiento</Label>
                {edit ? (
                  <input
                    type="date"
                    value={emp.fecha_nacimiento ?? ''}
                    onChange={(e) => set('fecha_nacimiento', e.target.value || null)}
                    className="neu-field h-8 w-full rounded-lg px-2 text-xs text-foreground focus-visible:outline-none"
                  />
                ) : (
                  <p className="text-foreground">
                    {emp.fecha_nacimiento
                      ? emp.fecha_nacimiento.split('-').reverse().join('/')
                      : '—'}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Área</Label>
                {edit ? (
                  <Select
                    value={emp.area || 'none'}
                    onValueChange={(v) => set('area', v === 'none' ? '' : v)}
                  >
                    <SelectTrigger className="neu-field h-8 rounded-lg">
                      <SelectValue placeholder="Sin área" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Sin área —</SelectItem>
                      {areas.map((a) => (
                        <SelectItem key={a.id} value={a.nombre}>
                          {a.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-foreground">{emp.area || '—'}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Reporta a</Label>
                {edit ? (
                  <Select
                    value={emp.manager_id != null ? String(emp.manager_id) : 'none'}
                    onValueChange={(v) => set('manager_id', v === 'none' ? null : Number(v))}
                  >
                    <SelectTrigger className="neu-field h-8 rounded-lg">
                      <SelectValue placeholder="Sin jefe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Sin jefe —</SelectItem>
                      {empleados
                        .filter((e) => e.id !== emp.id && !descendientes.has(e.id))
                        .map((e) => (
                          <SelectItem key={e.id} value={String(e.id)}>
                            {e.nombre} · {e.rol}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-foreground">
                    {empleados.find((e) => e.id === emp.manager_id)?.nombre ?? '—'}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Estado</Label>
                {edit ? (
                  <Select value={emp.estado} onValueChange={(v) => set('estado', v)}>
                    <SelectTrigger className="neu-field h-8 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="inactive">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-foreground">{emp.estado === 'inactive' ? 'Inactivo' : 'Activo'}</p>
                )}
              </div>
            </div>
          </aside>

          {/* Panel principal */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <span className="truncate text-sm font-medium text-muted-foreground">
                {err ? (
                  <span className="text-destructive">{err}</span>
                ) : creating ? (
                  'Nuevo empleado'
                ) : edit ? (
                  'Modo edición'
                ) : (
                  'Ficha del empleado'
                )}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {creating ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? 'Creando…' : 'Crear empleado'}
                    </Button>
                  </>
                ) : edit ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDelete(emp.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Eliminar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setForm(empleado);
                        setEdit(false);
                        setErr(null);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? 'Guardando…' : 'Guardar'}
                    </Button>
                  </>
                ) : canEdit ? (
                  <Button size="sm" variant="outline" onClick={() => setEdit(true)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                  </Button>
                ) : null}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  aria-label="Cerrar"
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={setTab}
              orientation="vertical"
              className="flex min-h-0 flex-1 gap-0"
            >
              <TabsList className="w-44 shrink-0 flex-col items-stretch justify-start gap-1 rounded-none bg-transparent p-3">
                {visibleTabs.map((t) => (
                  <TabsTrigger key={t.value} value={t.value}>
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="flex-1 p-5">
                {visibleTabs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sin información cargada. Usá “Editar” para agregar datos.
                  </p>
                ) : (
                  <>
                    <TabsContent value="resumen" className="mt-0 space-y-5">
                      {edit ? (
                        <Textarea
                          value={emp.summary ?? ''}
                          onChange={(e) => set('summary', e.target.value)}
                          rows={4}
                          placeholder="Resumen profesional…"
                          className="neu-field rounded-lg focus-visible:ring-0"
                        />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm text-foreground">{emp.summary || 'Sin resumen.'}</p>
                      )}
                      <HorariosEditor horarios={emp.horarios} edit={edit} onChange={(v) => set('horarios', v)} />
                    </TabsContent>

                    <TabsContent value="resp" className="mt-0 space-y-4">
                      <StringList title="Responsabilidades primarias" items={emp.resp_primarias} edit={edit} onChange={(v) => set('resp_primarias', v)} />
                      <StringList title="Responsabilidades secundarias" items={emp.resp_secundarias} edit={edit} onChange={(v) => set('resp_secundarias', v)} />
                    </TabsContent>

                    <TabsContent value="io" className="mt-0 space-y-4">
                      <StringList title="Inputs" items={emp.inputs} edit={edit} onChange={(v) => set('inputs', v)} />
                      <StringList title="Outputs" items={emp.outputs} edit={edit} onChange={(v) => set('outputs', v)} />
                    </TabsContent>

                    <TabsContent value="hab" className="mt-0 space-y-4">
                      <HardSkillsEditor items={emp.hard_skills} edit={edit} onChange={(v) => set('hard_skills', v)} />
                      <SoftSkillsEditor items={emp.soft_skills} edit={edit} onChange={(v) => set('soft_skills', v)} />
                      <StringList title="Etiquetas / skills" items={emp.skills} edit={edit} onChange={(v) => set('skills', v)} />
                    </TabsContent>

                    <TabsContent value="exp" className="mt-0">
                      <ExperienciaEditor items={emp.experiencia} edit={edit} onChange={(v) => set('experiencia', v)} />
                    </TabsContent>

                    <TabsContent value="proy" className="mt-0 space-y-5">
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Proyectos asignados
                        </p>
                        <ProyectosDelEmpleado {...estadoProyectos} />
                      </div>
                      <StringList title="Otros proyectos (nota libre)" items={emp.projects} edit={edit} onChange={(v) => set('projects', v)} />
                    </TabsContent>

                    <TabsContent value="docs" className="mt-0 space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Documentación de procedimientos del rol
                      </p>
                      {creating ? (
                        <p className="text-sm text-muted-foreground">
                          Creá el empleado primero: la documentación se sube desde su ficha.
                        </p>
                      ) : (
                        <DocumentosDelEmpleado
                          empleadoId={emp.id}
                          edit={edit}
                          {...estadoDocs}
                        />
                      )}
                    </TabsContent>

                    <TabsContent value="mas" className="mt-0">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Antigüedad" value={emp.antiguedad} edit={edit} onChange={(v) => set('antiguedad', v)} block hideWhenEmpty />
                        <Field label="Formación" value={emp.formacion} edit={edit} onChange={(v) => set('formacion', v)} block hideWhenEmpty />
                        <Field label="Seniority" value={emp.seniority} edit={edit} onChange={(v) => set('seniority', v)} block hideWhenEmpty />
                        <Field label="Especialidad" value={emp.especialidad} edit={edit} onChange={(v) => set('especialidad', v)} block hideWhenEmpty />
                        <Field label="Actualizado" value={emp.actualizado} edit={edit} onChange={(v) => set('actualizado', v)} block hideWhenEmpty />
                      </div>
                    </TabsContent>
                  </>
                )}
              </div>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────────────────

function Field({
  label,
  value,
  edit,
  onChange,
  block,
  hideWhenEmpty,
}: {
  label: string;
  value: string | null;
  edit: boolean;
  onChange: (v: string | null) => void;
  block?: boolean;
  /** En modo lectura, no renderiza nada si el valor está vacío. */
  hideWhenEmpty?: boolean;
}) {
  if (!edit && hideWhenEmpty && !(value && value.trim())) return null;
  return (
    <div className={block ? 'space-y-1' : 'space-y-0.5'}>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {edit ? (
        <Input className="neu-field h-8 rounded-lg" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />
      ) : (
        <p className="truncate text-foreground">{value || '—'}</p>
      )}
    </div>
  );
}

function HorariosEditor({
  horarios,
  edit,
  onChange,
}: {
  horarios: HorarioDia[] | null;
  edit: boolean;
  onChange: (v: HorarioDia[]) => void;
}) {
  const valorDe = (dia: string) => (horarios ?? []).find((h) => h.dia === dia)?.valor ?? '';
  const setDia = (dia: string, valor: string) =>
    onChange(DIAS_SEMANA.map((d) => ({ dia: d, valor: d === dia ? valor : valorDe(d) })));
  // En lectura solo se listan los días con horario cargado; si no hay ninguno, la
  // sección no se renderiza (mantiene limpia la pestaña Resumen).
  const dias = edit ? DIAS_SEMANA : DIAS_SEMANA.filter((d) => valorDe(d).trim() !== '');
  if (!edit && dias.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">Horarios</h4>
      <div className="space-y-1.5">
        {dias.map((d) => (
          <div key={d} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-[var(--neu-fg-soft)]">{d}</span>
            {edit ? (
              <Input
                className="neu-field h-8 flex-1 rounded-lg focus-visible:ring-0"
                value={valorDe(d)}
                placeholder="—"
                onChange={(e) => setDia(d, e.target.value)}
              />
            ) : (
              <span className="text-sm text-foreground">{valorDe(d)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StringList({
  title,
  items,
  edit,
  onChange,
}: {
  title: string;
  items: string[] | null;
  edit: boolean;
  onChange: (v: string[]) => void;
}) {
  const list = items ?? [];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        {edit && (
          <Button size="sm" variant="ghost" onClick={() => onChange([...list, ''])}>
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>
      {list.length === 0 && !edit && <p className="text-xs text-muted-foreground">Sin datos.</p>}
      <ul className="space-y-1.5">
        {list.map((it, i) => (
          <li key={i} className="flex items-center gap-2">
            {edit ? (
              <>
                <Input
                  className="neu-field h-8 rounded-lg"
                  value={it}
                  onChange={(e) => {
                    const next = [...list];
                    next[i] = e.target.value;
                    onChange(next);
                  }}
                />
                <button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onChange(list.filter((_, j) => j !== i))}
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <span className="text-sm text-foreground">• {it}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function HardSkillsEditor({
  items,
  edit,
  onChange,
}: {
  items: HardSkill[] | null;
  edit: boolean;
  onChange: (v: HardSkill[]) => void;
}) {
  const list = items ?? [];
  const upd = (i: number, patch: Partial<HardSkill>) => {
    const next = [...list];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Habilidades duras</h4>
        {edit && (
          <Button size="sm" variant="ghost" onClick={() => onChange([...list, { name: '', level: 50 }])}>
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="space-y-3">
        {list.map((s, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-2">
              {edit ? (
                <Input className="h-7 flex-1" value={s.name} onChange={(e) => upd(i, { name: e.target.value })} />
              ) : (
                <span className="flex-1 text-sm text-foreground">{s.name}</span>
              )}
              <span className="w-10 text-right text-xs text-muted-foreground">{s.level}%</span>
              {edit && (
                <button className="text-muted-foreground hover:text-destructive" onClick={() => onChange(list.filter((_, j) => j !== i))}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {edit ? (
              <Slider value={[s.level]} max={100} step={5} onValueChange={(v) => upd(i, { level: v[0] })} />
            ) : (
              <div className="h-2 w-full rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${s.level}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SoftSkillsEditor({
  items,
  edit,
  onChange,
}: {
  items: SoftSkill[] | null;
  edit: boolean;
  onChange: (v: SoftSkill[]) => void;
}) {
  const list = items ?? [];
  const upd = (i: number, patch: Partial<SoftSkill>) => {
    const next = [...list];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Habilidades blandas</h4>
        {edit && (
          <Button size="sm" variant="ghost" onClick={() => onChange([...list, { name: '', rating: 3 }])}>
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {list.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            {edit ? (
              <Input className="h-7 flex-1" value={s.name} onChange={(e) => upd(i, { name: e.target.value })} />
            ) : (
              <span className="flex-1 text-sm text-foreground">{s.name}</span>
            )}
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  disabled={!edit}
                  onClick={() => upd(i, { rating: n })}
                  className={`h-3.5 w-3.5 rounded-full ${n <= s.rating ? 'bg-primary' : 'bg-muted'} ${edit ? 'cursor-pointer' : ''}`}
                  aria-label={`${n} de 5`}
                />
              ))}
            </div>
            {edit && (
              <button className="text-muted-foreground hover:text-destructive" onClick={() => onChange(list.filter((_, j) => j !== i))}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExperienciaEditor({
  items,
  edit,
  onChange,
}: {
  items: Experiencia[] | null;
  edit: boolean;
  onChange: (v: Experiencia[]) => void;
}) {
  const list = items ?? [];
  const upd = (i: number, patch: Partial<Experiencia>) => {
    const next = [...list];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Experiencia</h4>
        {edit && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange([...list, { role: '', company: '', period: '' }])}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="space-y-3">
        {list.map((x, i) => (
          <div key={i} className="rounded-lg border border-border p-3">
            {edit ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <Input className="neu-field h-8 rounded-lg" placeholder="Rol" value={x.role} onChange={(e) => upd(i, { role: e.target.value })} />
                <Input className="neu-field h-8 rounded-lg" placeholder="Empresa" value={x.company} onChange={(e) => upd(i, { company: e.target.value })} />
                <div className="flex items-center gap-2">
                  <Input className="neu-field h-8 rounded-lg" placeholder="Período" value={x.period} onChange={(e) => upd(i, { period: e.target.value })} />
                  <button className="text-muted-foreground hover:text-destructive" onClick={() => onChange(list.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-foreground">{x.role}</p>
                <p className="text-xs text-muted-foreground">{x.company} · {x.period}</p>
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && !edit && <p className="text-xs text-muted-foreground">Sin experiencia cargada.</p>}
      </div>
    </div>
  );
}
