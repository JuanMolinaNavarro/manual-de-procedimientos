import { NextRequest, NextResponse } from 'next/server';
import { getPlanConfig, upsertPlanConfig, type PlanConfigData } from '@/lib/planes';
import { isEmpresa } from '@/lib/empresas';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const empresaRaw = request.nextUrl.searchParams.get('empresa')?.trim();

  if (!empresaRaw || !isEmpresa(empresaRaw)) {
    return NextResponse.json(
      { error: 'El parámetro "empresa" es requerido y debe ser válido' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    const data = await getPlanConfig(empresaRaw);
    return NextResponse.json(data, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('Error en GET /api/plans:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function PUT(request: NextRequest) {
  const apiKey = request.headers.get('X-Api-Key');
  if (!apiKey || apiKey !== process.env.PLANS_API_KEY) {
    return NextResponse.json(
      { error: 'No autorizado' },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const empresaRaw = request.nextUrl.searchParams.get('empresa')?.trim();
  if (!empresaRaw || !isEmpresa(empresaRaw)) {
    return NextResponse.json(
      { error: 'El parámetro "empresa" es requerido y debe ser válido' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    const body = (await request.json()) as PlanConfigData;

    if (!Array.isArray(body.plans) || typeof body.tvAddonPrice !== 'number') {
      return NextResponse.json(
        { error: 'El cuerpo debe incluir "plans" (array) y "tvAddonPrice" (número)' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const updated = await upsertPlanConfig(empresaRaw, body);
    return NextResponse.json(updated, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('Error en PUT /api/plans:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
