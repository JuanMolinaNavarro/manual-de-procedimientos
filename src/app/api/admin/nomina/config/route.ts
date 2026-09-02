import { NextRequest, NextResponse } from 'next/server';
import { getSessionUsername } from '@/lib/admin-auth';
import { handle, parseOrgId, readJson } from '@/lib/nomina-api';
import { getConfig, updateConfig } from '@/lib/nomina';

export async function GET(request: NextRequest) {
  return handle('GET /api/admin/nomina/config', async () => {
    return NextResponse.json(await getConfig(parseOrgId(request.nextUrl.searchParams.get('organigramaId'))));
  });
}

export async function PUT(request: NextRequest) {
  return handle('PUT /api/admin/nomina/config', async () => {
    const body = await readJson(request);
    const orgId = parseOrgId(body.organigramaId ?? request.nextUrl.searchParams.get('organigramaId'));
    const data = { params: body.params, empresa: body.empresa, resetParams: body.resetParams === true };
    return NextResponse.json(await updateConfig(orgId, data, await getSessionUsername()));
  });
}
