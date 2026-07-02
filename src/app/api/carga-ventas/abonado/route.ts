import { NextRequest, NextResponse } from 'next/server';
import { consultarAbonadoPorDni, IspbossError } from '@/lib/ispboss';

// Siempre dinámico: depende del query param y no debe cachearse.
export const dynamic = 'force-dynamic';

/**
 * GET /api/carga-ventas/abonado?dni=<documento>
 *
 * Protegido por el middleware (requiere sesión). Actúa como proxy a ISPBoss
 * para no exponer la API key al navegador.
 */
export async function GET(request: NextRequest) {
  const dni = (request.nextUrl.searchParams.get('dni') ?? '').trim();

  if (!/^\d{6,15}$/.test(dni)) {
    return NextResponse.json(
      { error: 'Ingresá un número de documento válido (solo dígitos).' },
      { status: 400 },
    );
  }

  try {
    const result = await consultarAbonadoPorDni(dni);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof IspbossError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error en GET /api/carga-ventas/abonado:', error);
    return NextResponse.json({ error: 'Error interno al consultar el abonado.' }, { status: 500 });
  }
}
