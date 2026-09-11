'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, Pencil, Plus, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OrgLicencia } from '@/lib/organigrama';

export interface EstadoLicenciasEmpleado {
  /** null mientras carga. */
  licencias: OrgLicencia[] | null;
  error: string;
  /** Vuelve a pedir la lista (tras crear/editar/borrar). */
  recargar: () => void;
}

/**
 * Trae las licencias de software de una persona. Se llama desde el modal con
 * `activo = open && !creating && canEdit`: quien no puede editar el organigrama
 * no ve la pestaña y tampoco pega al endpoint (que devuelve 403).
 */
export function useLicenciasDeEmpleado(
  empleadoId: number | null,
  activo: boolean,
): EstadoLicenciasEmpleado {
  const [cache, setCache] = useState<{ id: number; datos: OrgLicencia[] } | null>(null);
  const [fallo, setFallo] = useState<{ id: number; msg: string } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!activo || !empleadoId) return;
    let vigente = true;

    fetch(`/api/admin/organigrama/empleados/${empleadoId}/licencias`)
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudieron cargar las licencias');
        return (await res.json()) as OrgLicencia[];
      })
      .then((datos) => {
        if (vigente) setCache({ id: empleadoId, datos });
      })
      .catch((e) => {
        if (vigente) {
          setFallo({ id: empleadoId, msg: e instanceof Error ? e.message : 'Error al cargar' });
        }
      });

    return () => {
      vigente = false;
    };
  }, [empleadoId, activo, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  if (!empleadoId) return { licencias: [], error: '', recargar };
  return {
    licencias: cache?.id === empleadoId ? cache.datos : null,
    error: fallo?.id === empleadoId ? fallo.msg : '',
    recargar,
  };
}

/** El `?n=` es cache-buster: cambia cuando se reemplaza el ícono (como `fotoUrl`). */
export function licenciaIconoUrl(l: Pick<OrgLicencia, 'id' | 'icono_archivo'>): string | null {
  return l.icono_archivo
    ? `/api/admin/organigrama/licencias/${l.id}/icono?n=${encodeURIComponent(l.icono_archivo)}`
    : null;
}

const PERIODICIDAD_LABEL: Record<string, string> = {
  mensual: '/ mes',
  anual: '/ año',
  unica: 'único',
};

function costoTexto(l: OrgLicencia): string | null {
  if (l.costo == null) return null;
  const monto = l.costo.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const per = l.periodicidad ? ` ${PERIODICIDAD_LABEL[l.periodicidad] ?? l.periodicidad}` : '';
  return `${l.moneda ?? 'USD'} ${monto}${per}`;
}

// ── Borrador del formulario (alta y edición comparten el mismo shape) ──

interface Borrador {
  titulo: string;
  cuenta: string;
  password: string;
  sitio_url: string;
  costo: string;
  moneda: string;
  periodicidad: string;
  icono: File | null;
  quitar_icono: boolean;
}

const BORRADOR_VACIO: Borrador = {
  titulo: '',
  cuenta: '',
  password: '',
  sitio_url: '',
  costo: '',
  moneda: 'USD',
  periodicidad: 'mensual',
  icono: null,
  quitar_icono: false,
};

function borradorDe(l: OrgLicencia): Borrador {
  return {
    titulo: l.titulo,
    cuenta: l.cuenta,
    password: l.password ?? '',
    sitio_url: l.sitio_url ?? '',
    costo: l.costo == null ? '' : String(l.costo),
    moneda: l.moneda ?? 'USD',
    periodicidad: l.periodicidad ?? 'mensual',
    icono: null,
    quitar_icono: false,
  };
}

function aFormData(b: Borrador): FormData {
  const fd = new FormData();
  fd.append('titulo', b.titulo);
  fd.append('cuenta', b.cuenta);
  fd.append('password', b.password);
  fd.append('sitio_url', b.sitio_url);
  fd.append('costo', b.costo);
  if (b.costo.trim()) {
    fd.append('moneda', b.moneda);
    fd.append('periodicidad', b.periodicidad);
  }
  if (b.icono) fd.append('icono', b.icono);
  if (b.quitar_icono) fd.append('quitar_icono', '1');
  return fd;
}

// ── Subcomponentes ──

/** Input de contraseña con botón de ojo. */
function PasswordInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [ver, setVer] = useState(false);
  return (
    <div className={`relative ${className ?? ''}`}>
      <Input
        className="neu-field h-8 rounded-lg pr-8"
        type={ver ? 'text' : 'password'}
        autoComplete="off"
        placeholder="Contraseña"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        onClick={() => setVer((v) => !v)}
      >
        {ver ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

/** Ícono de la licencia con fallback si no hay archivo o no carga. */
function IconoLicencia({ licencia }: { licencia: OrgLicencia }) {
  // Se guarda la URL que falló (no un booleano) para que un ícono nuevo se
  // vuelva a intentar sin necesidad de resetear estado en un efecto.
  const [urlRota, setUrlRota] = useState<string | null>(null);
  const url = licenciaIconoUrl(licencia);
  if (!url || urlRota === url) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted">
        <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="h-6 w-6 shrink-0 rounded-md object-contain"
      onError={() => setUrlRota(url)}
    />
  );
}

function LicenciaForm({
  valor,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  busy,
  tieneIcono,
}: {
  valor: Borrador;
  onChange: (b: Borrador) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel: string;
  busy: boolean;
  /** La licencia ya tiene ícono guardado (para ofrecer "Quitar ícono"). */
  tieneIcono?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => onChange({ ...valor, [k]: v });

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          className="neu-field h-8 rounded-lg"
          placeholder="Título (ej: Microsoft 365)"
          value={valor.titulo}
          onChange={(e) => set('titulo', e.target.value)}
        />
        <Input
          className="neu-field h-8 rounded-lg"
          placeholder="Usuario o mail vinculado"
          autoComplete="off"
          value={valor.cuenta}
          onChange={(e) => set('cuenta', e.target.value)}
        />
        <PasswordInput value={valor.password} onChange={(v) => set('password', v)} />
        <Input
          className="neu-field h-8 rounded-lg"
          placeholder="URL del proveedor (ej: microsoft.com)"
          value={valor.sitio_url}
          onChange={(e) => set('sitio_url', e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="neu-field h-8 w-28 rounded-lg"
          placeholder="Costo"
          inputMode="decimal"
          value={valor.costo}
          onChange={(e) => set('costo', e.target.value)}
        />
        <Select value={valor.moneda} onValueChange={(v) => set('moneda', v)}>
          <SelectTrigger className="neu-field h-8 w-24 rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="ARS">ARS</SelectItem>
          </SelectContent>
        </Select>
        <Select value={valor.periodicidad} onValueChange={(v) => set('periodicidad', v)}>
          <SelectTrigger className="neu-field h-8 w-28 rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mensual">Mensual</SelectItem>
            <SelectItem value="anual">Anual</SelectItem>
            <SelectItem value="unica">Pago único</SelectItem>
          </SelectContent>
        </Select>

        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            onChange({ ...valor, icono: f, quitar_icono: false });
            e.target.value = '';
          }}
        />
        <Button size="sm" variant="outline" type="button" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1 h-3.5 w-3.5" />
          {valor.icono ? valor.icono.name : 'Ícono…'}
        </Button>
        {valor.icono && (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Descartar ícono elegido"
            onClick={() => set('icono', null)}
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {tieneIcono && !valor.icono && (
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={valor.quitar_icono}
              onChange={(e) => set('quitar_icono', e.target.checked)}
            />
            Quitar ícono
          </label>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" type="button" disabled={busy} onClick={onSubmit}>
          {submitLabel === 'Agregar' ? (
            <Plus className="mr-1 h-3.5 w-3.5" />
          ) : (
            <Check className="mr-1 h-3.5 w-3.5" />
          )}
          {busy ? 'Guardando…' : submitLabel}
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" type="button" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <p className="text-[11px] text-muted-foreground">
          Con la URL el ícono se busca solo; subí una imagen si querés otro.
        </p>
      </div>
    </div>
  );
}

/** Contraseña en lectura: oculta hasta que se toca el ojo, con copiar. */
function PasswordLectura({ password }: { password: string }) {
  const [ver, setVer] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(password);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1500);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5 pl-8 text-[12px]">
      <span className="text-muted-foreground">Clave:</span>
      <span className="font-mono font-semibold">{ver ? password : '••••••••'}</span>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground"
        aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        onClick={() => setVer((v) => !v)}
      >
        {ver ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground"
        aria-label="Copiar contraseña"
        onClick={copiar}
      >
        {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

/**
 * Licencias de software asignadas a la persona: ícono del proveedor + título +
 * cuenta, todo en negrita. En modo edición permite agregar, editar inline y
 * borrar. Las mutaciones pegan directo a la API (como documentos y foto): no
 * pasan por "Guardar" de la ficha.
 */
export default function LicenciasDelEmpleado({
  empleadoId,
  licencias,
  error,
  recargar,
  edit,
}: EstadoLicenciasEmpleado & { empleadoId: number; edit: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nueva, setNueva] = useState<Borrador>(BORRADOR_VACIO);
  const [editando, setEditando] = useState<{ id: number; borrador: Borrador } | null>(null);

  useEffect(() => {
    setNueva(BORRADOR_VACIO);
    setEditando(null);
    setMsg(null);
  }, [empleadoId]);

  async function enviar(url: string, method: 'POST' | 'PUT', b: Borrador): Promise<boolean> {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, { method, body: aFormData(b) });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'No se pudo guardar la licencia');
      }
      recargar();
      return true;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo guardar la licencia');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function agregar() {
    const ok = await enviar(`/api/admin/organigrama/empleados/${empleadoId}/licencias`, 'POST', nueva);
    if (ok) setNueva(BORRADOR_VACIO);
  }

  async function guardarEdicion() {
    if (!editando) return;
    const ok = await enviar(`/api/admin/organigrama/licencias/${editando.id}`, 'PUT', editando.borrador);
    if (ok) setEditando(null);
  }

  async function borrar(l: OrgLicencia) {
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/organigrama/licencias/${l.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo eliminar la licencia');
      recargar();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo eliminar la licencia');
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (licencias === null)
    return <p className="text-sm text-muted-foreground">Cargando licencias…</p>;

  return (
    <div className="space-y-4">
      {edit && (
        <div className="space-y-2 rounded-lg border border-dashed p-3">
          <Label className="text-[11px] text-muted-foreground">Nueva licencia</Label>
          <LicenciaForm
            valor={nueva}
            onChange={setNueva}
            onSubmit={agregar}
            submitLabel="Agregar"
            busy={busy}
          />
        </div>
      )}

      {msg && <p className="text-sm text-destructive">{msg}</p>}

      {licencias.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin licencias registradas.</p>
      ) : (
        <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1.5">
          {licencias.map((l) =>
            editando?.id === l.id ? (
              <div key={l.id} className="rounded-lg border p-2">
                <LicenciaForm
                  valor={editando.borrador}
                  onChange={(b) => setEditando({ id: l.id, borrador: b })}
                  onSubmit={guardarEdicion}
                  onCancel={() => setEditando(null)}
                  submitLabel="Guardar"
                  busy={busy}
                  tieneIcono={Boolean(l.icono_archivo)}
                />
              </div>
            ) : (
              <div key={l.id} className="space-y-1 rounded-lg border p-2">
                <div className="flex items-center gap-2">
                  <IconoLicencia licencia={l} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                    {l.titulo}
                    <span className="mx-1.5 text-muted-foreground">·</span>
                    <span title={l.cuenta}>{l.cuenta}</span>
                  </span>
                  {costoTexto(l) && (
                    <span className="shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {costoTexto(l)}
                    </span>
                  )}
                  {edit && (
                    <>
                      <button
                        type="button"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label={`Editar ${l.titulo}`}
                        onClick={() => setEditando({ id: l.id, borrador: borradorDe(l) })}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Eliminar ${l.titulo}`}
                        onClick={() => borrar(l)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
                {l.password && <PasswordLectura password={l.password} />}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
