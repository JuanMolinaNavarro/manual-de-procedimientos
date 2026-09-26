import { NextRequest, NextResponse } from 'next/server';
import { canEditModule, getSessionUsername } from '@/lib/admin-auth';
import { getEmpleadoById, getLicenciasDeEmpleado, createLicencia } from '@/lib/organigrama';
import {
  LicenciaFormError,
  guardarFaviconDe,
  guardarIcono,
  parseLicenciaForm,
} from '@/lib/licencias-icono';

// A diferencia del resto del organigrama, acá la LECTURA también exige permiso
// de edición: las licencias (con sus cuentas y claves) las ven solo superadmin
// y los admin habilitados a editar el organigrama.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canEditModule('organigrama'))) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }
  const { id } = await params;
  const empleadoId = Number(id);
  if (!Number.isInteger(empleadoId) || empleadoId <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }
  try {
    return NextResponse.json(await getLicenciasDeEmpleado(empleadoId));
  } catch (error) {
    console.error('Error en GET /api/admin/organigrama/empleados/[id]/licencias:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }
    const { id } = await params;
    const empleadoId = Number(id);
    const empleado = await getEmpleadoById(empleadoId);
    if (!empleado) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const form = await parseLicenciaForm(await request.formData());

    // Ícono: el subido a mano manda; si no hay, se intenta el favicon del sitio.
    let icono_archivo: string | null = null;
    let icono_origen: string | null = null;
    if (form.icono) {
      icono_archivo = guardarIcono(form.icono.buffer, form.icono.ext);
      icono_origen = 'subido';
    } else if (form.sitio_url) {
      icono_archivo = await guardarFaviconDe(form.sitio_url);
      icono_origen = icono_archivo ? 'favicon' : null;
    }

    const licencia = await createLicencia({
      empleado_id: empleadoId,
      titulo: form.titulo,
      cuenta: form.cuenta,
      password: form.password,
      sitio_url: form.sitio_url,
      icono_archivo,
      icono_origen,
      costo: form.costo,
      moneda: form.moneda,
      periodicidad: form.periodicidad,
      created_by: await getSessionUsername(),
    });
    return NextResponse.json(licencia, { status: 201 });
  } catch (error) {
    if (error instanceof LicenciaFormError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error en POST /api/admin/organigrama/empleados/[id]/licencias:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
