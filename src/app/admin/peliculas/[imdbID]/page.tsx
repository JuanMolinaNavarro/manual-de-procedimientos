'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { FanartImage, FanartMovieImages } from '@/lib/fanart';

const PAGE_SIZE = 8;

interface SelectedMovie {
  title: string;
  year: string;
  imdbID: string;
  type: string;
  poster: string | null;
}

function ImageThumbnail({
  img,
  selected,
  onClick,
}: {
  img: FanartImage;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`overflow-hidden rounded-md border-2 transition-all ${
        selected ? 'border-primary ring-2 ring-primary/40' : 'border-transparent hover:border-muted-foreground/40'
      }`}
    >
      <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.url} alt="" className="h-full w-full object-contain" />
      </div>
      <div className="bg-muted px-2 py-1 text-xs text-muted-foreground flex items-center justify-between gap-1">
        <span className="uppercase">{img.lang === '00' ? 'neutro' : img.lang}</span>
        <span>{img.likes} ♥</span>
      </div>
    </button>
  );
}

function PaginatedGrid({
  images,
  selectedId,
  onSelect,
  label,
}: {
  images: FanartImage[];
  selectedId: string | undefined;
  onSelect: (img: FanartImage) => void;
  label: string;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(images.length / PAGE_SIZE);
  const slice = images.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {label} ({images.length})
        </h3>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(p => p - 1)}
              disabled={page <= 1}
            >
              ←
            </Button>
            <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages}
            >
              →
            </Button>
          </div>
        )}
      </div>

      {images.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay {label.toLowerCase()} disponibles.</p>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {slice.map(img => (
            <ImageThumbnail
              key={img.id}
              img={img}
              selected={selectedId === img.id}
              onClick={() => onSelect(img)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PeliculaDetallePage() {
  const { imdbID } = useParams<{ imdbID: string }>();
  const router = useRouter();

  const [movie, setMovie] = useState<SelectedMovie | null>(null);
  const [fanart, setFanart] = useState<FanartMovieImages | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedBg, setSelectedBg] = useState<FanartImage | null>(null);
  const [selectedLogo, setSelectedLogo] = useState<FanartImage | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const handleSave = async () => {
    if (!movie) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/admin/on-demand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imdbID: movie.imdbID,
          title: movie.title,
          year: movie.year,
          poster: movie.poster,
          background: selectedBg?.url ?? null,
          logo: selectedLogo?.url ?? null,
        }),
      });
      if (!res.ok) throw new Error();
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const raw = sessionStorage.getItem('omdb.selected_movie');
    if (raw) {
      try { setMovie(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (!imdbID) return;
    fetch(`/api/admin/fanart/${imdbID}`)
      .then(r => r.json())
      .then((data: FanartMovieImages & { error?: string }) => {
        if (data.error) throw new Error(data.error);
        setFanart(data);
        const topBg = data.backgrounds.reduce<FanartImage | null>(
          (best, img) => !best || img.likes > best.likes ? img : best, null
        );
        const topLogo = data.logos.reduce<FanartImage | null>(
          (best, img) => !best || img.likes > best.likes ? img : best, null
        );
        if (topBg) setSelectedBg(topBg);
        if (topLogo) setSelectedLogo(topLogo);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [imdbID]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            ← Volver
          </Button>
          {movie && (
            <div>
              <h2 className="text-2xl font-bold text-foreground">{movie.title}</h2>
              <p className="text-sm text-muted-foreground">
                {movie.year} · <Badge variant="secondary">{imdbID}</Badge>
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saved' && (
            <span className="text-sm text-green-400">Guardado correctamente</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-sm text-red-400">Error al guardar</span>
          )}
          <Button onClick={handleSave} disabled={saving || !movie}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 p-4 text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          Cargando imágenes de fanart.tv...
        </div>
      )}

      {fanart && (
        <div className="flex gap-6">
          {/* Left: selectable grids */}
          <div className="flex-1 min-w-0 space-y-6">
            <PaginatedGrid
              images={fanart.backgrounds}
              selectedId={selectedBg?.id}
              onSelect={img => setSelectedBg(prev => prev?.id === img.id ? null : img)}
              label="Fondos"
            />
            <PaginatedGrid
              images={fanart.logos}
              selectedId={selectedLogo?.id}
              onSelect={img => setSelectedLogo(prev => prev?.id === img.id ? null : img)}
              label="Logos"
            />
          </div>

          {/* Right: sticky preview */}
          <div className="w-96 shrink-0">
            <div className="sticky top-6 space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Vista previa
              </h3>
              <div
                className="relative overflow-hidden rounded-xl border border-border bg-black"
                style={{ aspectRatio: '16/9' }}
              >
                {selectedBg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedBg.url} alt="Fondo" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                    Seleccioná un fondo
                  </div>
                )}
                {selectedLogo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedLogo.url}
                    alt="Logo"
                    className="absolute bottom-4 left-4 h-12 object-contain drop-shadow-lg"
                  />
                )}
              </div>
              {(selectedBg || selectedLogo) && (
                <div className="space-y-1 pt-1 text-xs text-muted-foreground">
                  {selectedBg && <p>Fondo: {selectedBg.lang.toUpperCase()} · {selectedBg.likes} ♥</p>}
                  {selectedLogo && <p>Logo: {selectedLogo.lang.toUpperCase()} · {selectedLogo.likes} ♥</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
