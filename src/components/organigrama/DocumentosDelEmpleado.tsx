'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Download, Eye, FileText, Folder, Pencil, Upload, X } from 'lucide-react';
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

/** Trae la documentación de procedimientos de una persona. */
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

function esPdf(doc: OrgDocumento): boolean {
  return doc.tipo_mime === 'application/pdf' || doc.nombre_archivo.toLowerCase().endsWith('.pdf');
}

function formatoTamano(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Documentación de procedimientos del rol en dos niveles: bloques de categoría
 * y, al abrir una, sus archivos. En modo edición permite subir (a la categoría
 * abierta, o eligiendo una desde la raíz), renombrar/recategorizar y borrar.
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
  // Categoría abierta (drill-in); null = grilla de bloques.
  const [catAbierta, setCatAbierta] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ id: number; titulo: string; categoria: string } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  // Al cambiar de persona se vuelve a la grilla de categorías.
  useEffect(() => {
    setCatAbierta(null);
    setEditando(null);
    setMsg(null);
  }, [empleadoId]);

  const categorias = Array.from(new Set((documentos ?? []).map((d) => d.categoria)));
  const docsAbiertos = (documentos ?? []).filter((d) => d.categoria === catAbierta);

  async function subir(files: FileList) {
    setSubiendo(true);
    setMsg(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('archivo', file);
        // Dentro de una categoría se sube directo a ella; en la raíz, a la elegida.
        fd.append('categoria', catAbierta ?? categoria);
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
          <Label className="text-[11px] text-muted-foreground">
            {catAbierta ? `Subir a “${catAbierta}”` : 'Subir documento'}
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            {catAbierta === null && (
              <>
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
              </>
            )}
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
          {catAbierta === null && (
            <p className="text-[11px] text-muted-foreground">
              PDF, Office, texto o imágenes. Sin categoría van a “General”.
            </p>
          )}
        </div>
      )}

      {msg && <p className="text-sm text-destructive">{msg}</p>}

      {catAbierta === null ? (
        // ── Nivel 1: bloques de categoría ──
        documentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin documentación cargada.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {categorias.map((cat) => {
              const n = documentos.filter((d) => d.categoria === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setCatAbierta(cat)}
                  className="flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <Folder className="h-5 w-5 text-primary" />
                  <span className="w-full truncate text-sm font-medium text-foreground" title={cat}>
                    {cat}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {n} {n === 1 ? 'documento' : 'documentos'}
                  </span>
                </button>
              );
            })}
          </div>
        )
      ) : (
        // ── Nivel 2: archivos de la categoría abierta ──
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-muted-foreground"
              onClick={() => setCatAbierta(null)}
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Categorías
            </Button>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {catAbierta}
            </span>
          </div>

          {docsAbiertos.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin documentos en esta categoría.</p>
          )}

          <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1.5">
            {docsAbiertos.map((d) =>
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
                  {esPdf(d) && (
                    // El endpoint sirve con Content-Disposition inline: el PDF
                    // se abre en el lector del navegador, en pestaña nueva.
                    <a
                      href={`/api/admin/organigrama/documentos/${d.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                      aria-label={`Ver ${d.titulo}`}
                    >
                      <Eye className="h-3.5 w-3.5" /> Ver
                    </a>
                  )}
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
        </div>
      )}
    </div>
  );
}
