import { NextRequest, NextResponse } from 'next/server';
import { canEditModule, getSessionUsername } from '@/lib/admin-auth';
import { getLicenciaById, updateLicencia, deleteLicencia } from '@/lib/organigrama';
import {
  LicenciaFormError,
  borrarIcono,
  guardarFaviconDe,
  guardarIcono,
  parseLicenciaForm,
} from '@/lib/licencias-icono';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }
    const { id } = await params;
    const actual = await getLicenciaById(Number(id));
    if (!actual) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const form = await parseLicenciaForm(await request.formData());

    // Reglas del ícono:
    // - archivo nuevo → pisa lo que haya y queda como 'subido';
    // - quitar_icono → se borra;
    // - si cambió la URL (o no había ícono) y el actual NO es subido → se busca el favicon.
    // Un ícono subido a mano nunca se pisa por cambiar la URL.
    let icono_archivo = actual.icono_archivo;
    let icono_origen = actual.icono_origen;
    const cambioUrl = (form.sitio_url ?? null) !== (actual.sitio_url ?? null);
    if (form.icono) {
      borrarIcono(actual.icono_archivo);
      icono_archivo = guardarIcono(form.icono.buffer, form.icono.ext);
      icono_origen = 'subido';
    } else if (form.quitar_icono) {
      borrarIcono(actual.icono_archivo);
      icono_archivo = null;
      icono_origen = null;
    } else if ((cambioUrl || !icono_archivo) && icono_origen !== 'subido' && form.sitio_url) {
      const nuevo = await guardarFaviconDe(form.sitio_url);
      if (nuevo) {
        borrarIcono(actual.icono_archivo);
        icono_archivo = nuevo;
        icono_origen = 'favicon';
      } else if (cambioUrl) {
        // Sin favicon para el sitio nuevo: no dejamos el del sitio viejo.
        borrarIcono(actual.icono_archivo);
        icono_archivo = null;
        icono_origen = null;
      }
    }

    const licencia = await updateLicencia(actual.id, {
      titulo: form.titulo,
      cuenta: form.cuenta,
      password: form.password,
      sitio_url: form.sitio_url,
      icono_archivo,
      icono_origen,
      costo: form.costo,
      moneda: form.moneda,
      periodicidad: form.periodicidad,
      updated_by: await getSessionUsername(),
    });
    return NextResponse.json(licencia);
  } catch (error) {
    if (error instanceof LicenciaFormError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error en PUT /api/admin/organigrama/licencias/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await canEditModule('organigrama'))) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }
    const { id } = await params;
    const licencia = await deleteLicencia(Number(id));
    if (!licencia) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    borrarIcono(licencia.icono_archivo);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error en DELETE /api/admin/organigrama/licencias/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
