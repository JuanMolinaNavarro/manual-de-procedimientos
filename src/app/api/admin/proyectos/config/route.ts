import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, getSessionUsername } from '@/lib/admin-auth';
import { getConfig, updateConfig } from '@/lib/proyectos';

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json(await getConfig());
  } catch (error) {
    console.error('Error en GET /api/admin/proyectos/config:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const body = (await request.json()) as Record<string, unknown>;

    const fxArs = body.fx_ars != null ? Number(body.fx_ars) : undefined;
    const inflUsd = body.infl_usd != null ? Number(body.infl_usd) : undefined;
    const anioBase = body.anio_base != null ? Number(body.anio_base) : undefined;

    if (fxArs != null && (!Number.isFinite(fxArs) || fxArs <= 0)) {
      return NextResponse.json({ error: 'El tipo de cambio debe ser mayor a 0' }, { status: 400 });
    }
    if (inflUsd != null && !Number.isFinite(inflUsd)) {
      return NextResponse.json({ error: 'Inflación inválida' }, { status: 400 });
    }
    if (anioBase != null && (!Number.isInteger(anioBase) || anioBase < 1900 || anioBase > 2200)) {
      return NextResponse.json({ error: 'Año base inválido' }, { status: 400 });
    }

    const config = await updateConfig(
      { fx_ars: fxArs, infl_usd: inflUsd, anio_base: anioBase },
      await getSessionUsername(),
    );
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error en PUT /api/admin/proyectos/config:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
