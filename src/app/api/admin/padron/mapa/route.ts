import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { guardarMapaKml, obtenerMapaKml } from '@/lib/mapa-abonados';

export const dynamic = 'force-dynamic';

async function getSesion(): Promise<{ usuario: string; rol: string } | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get('site_session')?.value;
  if (!raw) return null;
  const [usuario, rol] = raw.split('|');
  return { usuario: usuario ?? '', rol: rol ?? '' };
}

/**
 * GET: metadatos del mapa (para la UI) o, con `?raw=1`, el KML crudo para que
 * Leaflet lo parsee. El KML solo se sirve detrás de la auth de /api/admin/*.
 */
export async function GET(request: NextRequest) {
  const sesion = await getSesion();
  if (sesion?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const mapa = await obtenerMapaKml();
    const raw = request.nextUrl.searchParams.get('raw');

    if (raw) {
      if (!mapa) {
        return NextResponse.json({ error: 'Todavía no se cargó ningún mapa.' }, { status: 404 });
      }
      return new NextResponse(mapa.contenido, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.google-earth.kml+xml; charset=utf-8',
          // Dato privado: nunca cachear en proxies/CDN.
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({
      exists: Boolean(mapa),
      nombre_archivo: mapa?.nombre_archivo ?? null,
      actualizado_por: mapa?.actualizado_por ?? null,
      updated_at: mapa?.updated_at ?? null,
    });
  } catch (error) {
    console.error('Error en GET /api/admin/padron/mapa:', error);
    return NextResponse.json({ error: 'Error al consultar el mapa.' }, { status: 500 });
  }
}

/** POST: sube un .kml (exportado de My Maps) y reemplaza el mapa actual. */
export async function POST(request: NextRequest) {
  const sesion = await getSesion();
  if (sesion?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se recibió el archivo.' }, { status: 400 });
    }
    if (!/\.kml$/i.test(file.name)) {
      // My Maps ofrece .kmz (comprimido) o .kml. Pedimos el .kml para evitar
      // tener que descomprimir en el servidor.
      return NextResponse.json(
        { error: 'El archivo debe ser un .kml. En My Maps, tildá “Exportar a un archivo .KML”.' },
        { status: 400 },
      );
    }

    const contenido = await file.text();
    if (!contenido.includes('<kml')) {
      return NextResponse.json(
        {
          error:
            'El archivo no parece un KML válido. Si descargaste un .kmz, volvé a exportar como .kml.',
        },
        { status: 400 },
      );
    }

    const guardado = await guardarMapaKml(file.name, contenido, sesion.usuario);
    return NextResponse.json({
      exists: true,
      nombre_archivo: guardado.nombre_archivo,
      actualizado_por: guardado.actualizado_por,
      updated_at: guardado.updated_at,
    });
  } catch (error) {
    console.error('Error en POST /api/admin/padron/mapa:', error);
    return NextResponse.json({ error: 'Error al guardar el mapa.' }, { status: 500 });
  }
}
