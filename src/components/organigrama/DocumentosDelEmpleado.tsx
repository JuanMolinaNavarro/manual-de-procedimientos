'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Download, FileText, Pencil, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { OrgDocumento } from '@/lib/organigrama';

export interface EstadoDocumentosEmpleado {
  /** null mientras carga. */
  documentos: OrgDocumento[] | null;
  error: string;
  /** Vuelve a pedir la lista (tras subir/borrar/editar). */
  recargar: () => void;
}

/**
 * Trae la documentación de procedimientos de una persona. Vive en el modal (y no
 * en la pestaña) porque el resultado decide si la pestaña se muestra: en modo
 * lectura las pestañas vacías se ocultan.
 */
export function useDocumentosDeEmpleado(
  empleadoId: number | null,
  activo: boolean,
): EstadoDocumentosEmpleado {
  const [cache, setCache] = useState<{ id: number; datos: OrgDocumento[] } | null>(null);
  const [fallo, setFallo] = useState<{ id: number; msg: string } | null>(null);
  // Bump para refetchear tras una mutación sin perder el patrón id-junto-al-dato.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    // id 0 o null = empleado sin guardar (modo alta): no hay nada que buscar.
    if (!activo || !empleadoId) return;
    let vigente = true;

    fetch(`/api/admin/organigrama/empleados/${empleadoId}/documentos`)
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudo cargar la documentación');
        return (await res.json()) as OrgDocumento[];
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

  if (!empleadoId) return { documentos: [], error: '', recargar };
  return {
    documentos: cache?.id === empleadoId ? cache.datos : null,
    error: fallo?.id === empleadoId ? fallo.msg : '',
    recargar,
  };
}

function formatoTamano(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Documentación de procedimientos del rol, agrupada por categoría. En modo
 * edición permite subir (eligiendo categoría), renombrar/recategorizar y borrar.
 * Las mutaciones pegan directo a la API (como la foto): no pasan por "Guardar".
 */
export default function DocumentosDelEmpleado({
  empleadoId,
  documentos,
  error,
  recargar,
  edit,
}: EstadoDocumentosEmpleado & { empleadoId: number; edit: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [categoria, setCategoria] = useState('');
  const [editando, setEditando] = useState<{ id: number; titulo: string; categoria: string } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const categorias = Array.from(new Set((documentos ?? []).map((d) => d.categoria)));

  async function subir(files: FileList) {
    setSubiendo(true);
    setMsg(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('archivo', file);
        fd.append('categoria', categoria);
        const res = await fetch(`/api/admin/organigrama/empleados/${empleadoId}/documentos`, {
          method: 'POST',
          body: fd,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? `No se pudo subir ${file.name}`);
        }
      }
      recargar();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo subir el archivo');
    } finally {
      setSubiendo(false);
    }
  }

  async function guardarEdicion() {
    if (!editando) return;
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/organigrama/documentos/${editando.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: editando.titulo, categoria: editando.categoria }),
      });
      if (!res.ok) throw new Error('No se pudo guardar el cambio');
      setEditando(null);
      recargar();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo guardar el cambio');
    }
  }

  async function borrar(doc: OrgDocumento) {
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/organigrama/documentos/${doc.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo eliminar el documento');
      recargar();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo eliminar el documento');
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (documentos === null)
    return <p className="text-sm text-muted-foreground">Cargando documentación…</p>;

  return (
    <div className="space-y-4">
      {edit && (
        <div className="space-y-2 rounded-lg border border-dashed p-3">
          <Label className="text-[11px] text-muted-foreground">Subir documento</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="neu-field h-8 w-48 rounded-lg"
              list="org-doc-categorias"
              placeholder="Categoría (ej: Procedimientos)"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            />
            <datalist id="org-doc-categorias">
              {categorias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.gif"
              onChange={(e) => {
                if (e.target.files?.length) subir(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={subiendo}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-1 h-3.5 w-3.5" />
              {subiendo ? 'Subiendo…' : 'Elegir archivos'}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            PDF, Office, texto o imágenes. Sin categoría van a “General”.
          </p>
        </div>
      )}

      {msg && <p className="text-sm text-destructive">{msg}</p>}

      {documentos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {edit
            ? 'Sin documentación cargada todavía.'
            : 'Sin documentación cargada.'}
        </p>
      ) : (
        <div className="max-h-[350px] space-y-4 overflow-y-auto pr-1.5">
          {categorias.map((cat) => (
            <div key={cat} className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {cat}
              </p>
              {documentos
                .filter((d) => d.categoria === cat)
                .map((d) =>
                  editando?.id === d.id ? (
                    <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                      <Input
                        className="neu-field h-8 flex-1 rounded-lg"
                        value={editando.titulo}
                        placeholder="Título"
                        onChange={(e) => setEditando({ ...editando, titulo: e.target.value })}
                      />
                      <Input
                        className="neu-field h-8 w-40 rounded-lg"
                        list="org-doc-categorias"
                        value={editando.categoria}
                        placeholder="Categoría"
                        onChange={(e) => setEditando({ ...editando, categoria: e.target.value })}
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={guardarEdicion}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditando(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div key={d.id} className="flex items-center gap-2 rounded-lg border p-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <a
                        href={`/api/admin/organigrama/documentos/${d.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 truncate text-sm text-foreground hover:underline"
                        title={d.nombre_original}
                      >
                        {d.titulo}
                      </a>
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        {formatoTamano(d.tamano)}
                      </span>
                      <a
                        href={`/api/admin/organigrama/documentos/${d.id}`}
                        download={d.nombre_original}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label={`Descargar ${d.titulo}`}
                      >
                        <Download className="h-4 w-4" />
                      </a>
                      {edit && (
                        <>
                          <button
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                            aria-label={`Editar ${d.titulo}`}
                            onClick={() =>
                              setEditando({ id: d.id, titulo: d.titulo, categoria: d.categoria })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            aria-label={`Eliminar ${d.titulo}`}
                            onClick={() => borrar(d)}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  ),
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
