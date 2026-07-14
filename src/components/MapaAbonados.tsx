'use client';

/**
 * Mapa de abonados renderizado con Leaflet a partir del KML (privado) exportado
 * de Google My Maps. El KML se pide a /api/admin/padron/mapa?raw=1 (detrás de la
 * auth de admin) y se convierte a GeoJSON en el cliente con togeojson.
 *
 * Solo los tiles del mapa base salen a OpenStreetMap; los puntos de abonados
 * nunca abandonan el servidor. Se carga con next/dynamic (ssr:false) porque
 * Leaflet accede a `window`.
 */
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { kml as kmlToGeoJSON } from '@tmcw/togeojson';
import type { FeatureCollection } from 'geojson';
import 'leaflet/dist/leaflet.css';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'sin-mapa' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'listo'; data: FeatureCollection };

// Centro por defecto (aprox. Tucumán) mientras se ajustan los bounds reales.
const CENTRO_DEFECTO: [number, number] = [-26.8241, -65.2226];

/** Encuadra el mapa sobre las geometrías del KML al cargarlas. */
function FitBounds({ data }: { data: FeatureCollection }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.geoJSON(data).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24] });
  }, [data, map]);
  return null;
}

export default function MapaAbonados({ recargarKey }: { recargarKey: number }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  useEffect(() => {
    let cancelado = false;
    setEstado({ tipo: 'cargando' });
    (async () => {
      try {
        const res = await fetch('/api/admin/padron/mapa?raw=1', { cache: 'no-store' });
        if (res.status === 404) {
          if (!cancelado) setEstado({ tipo: 'sin-mapa' });
          return;
        }
        if (!res.ok) throw new Error('No se pudo cargar el mapa.');
        const texto = await res.text();
        const dom = new DOMParser().parseFromString(texto, 'text/xml');
        const data = kmlToGeoJSON(dom) as FeatureCollection;
        if (!cancelado) setEstado({ tipo: 'listo', data });
      } catch (err) {
        if (!cancelado) {
          setEstado({
            tipo: 'error',
            mensaje: err instanceof Error ? err.message : 'Error inesperado al leer el mapa.',
          });
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [recargarKey]);

  if (estado.tipo === 'cargando') return <Placeholder texto="Cargando mapa…" />;
  if (estado.tipo === 'sin-mapa') {
    return (
      <Placeholder texto="Todavía no se cargó ningún mapa. Subí el KML exportado de My Maps para verlo acá." />
    );
  }
  if (estado.tipo === 'error') return <Placeholder texto={estado.mensaje} />;

  const sinFeatures = estado.data.features.length === 0;

  return (
    <div className="relative h-[480px] w-full overflow-hidden rounded-md border border-border">
      <MapContainer center={CENTRO_DEFECTO} zoom={12} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {!sinFeatures && (
          <>
            <GeoJSON
              key={recargarKey}
              data={estado.data}
              pointToLayer={(_feature, latlng) =>
                L.circleMarker(latlng, {
                  radius: 6,
                  color: '#2563eb',
                  weight: 2,
                  fillColor: '#3b82f6',
                  fillOpacity: 0.7,
                })
              }
              onEachFeature={(feature, layer) => {
                const p = (feature.properties ?? {}) as Record<string, unknown>;
                const nombre = typeof p.name === 'string' ? p.name : '';
                const desc = typeof p.description === 'string' ? p.description : '';
                if (!nombre && !desc) return;
                // El nombre lo escapamos; la descripción de My Maps suele traer
                // HTML propio (enlaces, formato) y es contenido interno confiable.
                const tituloHtml = nombre ? `<strong>${escapeHtml(nombre)}</strong>` : '';
                const descHtml = desc ? `<div class="mt-1">${desc}</div>` : '';
                layer.bindPopup(`${tituloHtml}${descHtml}`);
              }}
            />
            <FitBounds data={estado.data} />
          </>
        )}
      </MapContainer>
    </div>
  );
}

function Placeholder({ texto }: { texto: string }) {
  return (
    <div className="flex h-[480px] w-full items-center justify-center rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
      {texto}
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
