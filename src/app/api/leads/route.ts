import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { createLead, type CreateLeadData } from '@/lib/leads';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
};

/** Comparación en tiempo constante (sobre sha256 para igualar largos). Sin clave configurada, nadie pasa. */
function claveValida(recibida: string | null): boolean {
  const esperada = process.env.LEADS_API_KEY;
  if (!recibida || !esperada) return false;
  const a = createHash('sha256').update(recibida).digest();
  const b = createHash('sha256').update(esperada).digest();
  return timingSafeEqual(a, b);
}

const TEXTO_MAX = 500;

/** Campo de texto opcional: string recortado (con tope) o null. Cualquier otro tipo → error. */
function texto(v: unknown, campo: string): string | null {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') throw new Error(`El campo ${campo} debe ser texto`);
  return v.trim().slice(0, TEXTO_MAX) || null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  if (!claveValida(request.headers.get('X-Api-Key'))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: CORS_HEADERS });
  }

  let data: CreateLeadData;
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') throw new Error('Body JSON inválido');
    const telefono = texto(body.telefono, 'telefono');
    const origen = texto(body.origen, 'origen');
    if (!telefono || !origen) throw new Error('Los campos telefono y origen son requeridos');
    if (body.tv_pack != null && typeof body.tv_pack !== 'boolean') throw new Error('El campo tv_pack debe ser booleano');
    data = {
      telefono,
      origen,
      nombre: texto(body.nombre, 'nombre'),
      apellido: texto(body.apellido, 'apellido'),
      email: texto(body.email, 'email'),
      direccion: texto(body.direccion, 'direccion'),
      plan: texto(body.plan, 'plan'),
      tv_pack: (body.tv_pack as boolean | null | undefined) ?? null,
      asignado: texto(body.asignado, 'asignado'),
    };
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    const lead = await createLead(data);
    return NextResponse.json(lead, { status: 201, headers: CORS_HEADERS });
  } catch (error) {
    console.error('Error en POST /api/leads:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
