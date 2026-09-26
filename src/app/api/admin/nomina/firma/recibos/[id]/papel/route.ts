import { NextRequest, NextResponse } from 'next/server';
import { getSessionUsername } from '@/lib/admin-auth';
import { NominaError } from '@/lib/nomina';
import { handle, pdfResponse } from '@/lib/nomina-api';
import { papelDeRecibo, registrarEntregaPapel } from '@/lib/recibos-finnegans';

type Ctx = { params: Promise<{ id: string }> };

/** Escaneo de la entrega en papel. */
export async function GET(_request: NextRequest, { params }: Ctx) {
  return handle('GET /api/admin/nomina/firma/recibos/[id]/papel', async () => {
    const { id } = await params;
    const { pdf, nombre } = await papelDeRecibo(id);
    return pdfResponse(pdf, nombre);
  });
}

/** Registra la entrega en papel: FormData `archivo` = PDF del recibo impreso y firmado a mano. */
export async function POST(request: NextRequest, { params }: Ctx) {
  return handle('POST /api/admin/nomina/firma/recibos/[id]/papel', async () => {
    const { id } = await params;
    const form = await request.formData();
    const file = form.get('archivo');
    if (!(file instanceof File) || !file.size) throw new NominaError('Falta el PDF escaneado', 400);
    if (!file.name.toLowerCase().endsWith('.pdf')) throw new NominaError('El escaneo debe ser un PDF', 400);
    await registrarEntregaPapel(id, new Uint8Array(await file.arrayBuffer()), await getSessionUsername());
    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
