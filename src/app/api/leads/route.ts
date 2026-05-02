import { NextRequest, NextResponse } from 'next/server';
import { createLead, type CreateLeadData } from '@/lib/leads';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-Api-Key');
  if (!apiKey || apiKey !== process.env.LEADS_API_KEY) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: CORS_HEADERS });
  }

  try {
    const body = await request.json() as CreateLeadData;
    const { nombre, apellido, telefono, direccion, plan, origen } = body;

    if (!nombre || !apellido || !telefono || !direccion || !plan || !origen) {
      return NextResponse.json(
        { error: 'Los campos nombre, apellido, telefono, direccion, plan y origen son requeridos' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const lead = await createLead(body);
    return NextResponse.json(lead, { status: 201, headers: CORS_HEADERS });
  } catch (error) {
    console.error('Error en POST /api/leads:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
