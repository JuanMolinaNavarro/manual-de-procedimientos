import { NextRequest, NextResponse } from 'next/server';
import { handle, parseId, parseOrgId, parsePeriodo, readJson } from '@/lib/nomina-api';
import { firmarKiosco } from '@/lib/nomina';

export async function POST(request: NextRequest) {
  return handle('POST /api/admin/nomina/recibos/firmar', async () => {
    const body = await readJson(request);
    const constancia = await firmarKiosco(parseOrgId(body.organigramaId), parsePeriodo(body.periodo), parseId(body.empleadoId, 'empleadoId'), {
      pin: body.pin,
      conformidad: body.conformidad,
      observaciones: body.observaciones,
      leido: body.leido,
      dispositivo: request.headers.get('user-agent') ?? '',
    });
    return NextResponse.json(constancia, { status: 201 });
  });
}
