import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getModulosForUser } from '@/lib/modulos';
import AdminHomeModulos from '@/components/AdminHomeModulos';
import CumplesBanner from '@/components/CumplesBanner';

export default async function AdminHomePage() {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get('site_session')?.value;
  const usuario = sessionValue ? sessionValue.split('|')[0] : null;

  const usuarioRecord = usuario
    ? await prisma.usuario.findUnique({
        where: { usuario },
        select: { nombre: true, apellido: true, modulos: true },
      })
    : null;

  const modulos = usuarioRecord?.modulos ?? [];
  const allowedModules = getModulosForUser(modulos);

  const nombreCompleto = usuarioRecord
    ? [usuarioRecord.nombre, usuarioRecord.apellido].filter(Boolean).join(' ').trim() || usuario
    : usuario;

  return (
    <div className="space-y-8">
      <CumplesBanner />
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Bienvenido{nombreCompleto ? `, ${nombreCompleto}` : ''}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Seleccioná una categoría para comenzar.
        </p>
      </div>

      <AdminHomeModulos modulos={allowedModules.map((m) => ({ ...m }))} />
    </div>
  );
}
