import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getModulosForUser } from '@/lib/modulos';
import AdminBackButton from '@/components/AdminBackButton';
import AdminLogoutButton from '@/components/AdminLogoutButton';
import ThemeToggle from '@/components/ThemeToggle';
import AdminSidebar from '@/components/AdminSidebar';
import AdminModuleGuard from '@/components/AdminModuleGuard';

export const metadata: Metadata = {
  title: 'CRM Comercial',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get('site_session')?.value;
  const usuario = sessionValue ? sessionValue.split('|')[0] : null;

  const usuarioRecord = usuario
    ? await prisma.usuario.findUnique({
        where: { usuario },
        select: { nombre: true, apellido: true, usuario: true, modulos: true },
      })
    : null;

  const modulos = usuarioRecord?.modulos ?? [];
  const allowedNavLinks = getModulosForUser(modulos);
  const fallbackHref = allowedNavLinks[0]?.href ?? '/admin';

  const nombreCompleto = usuarioRecord
    ? [usuarioRecord.nombre, usuarioRecord.apellido].filter(Boolean).join(' ').trim() || usuarioRecord.usuario
    : null;

  const isAuthed = Boolean(sessionValue);

  return (
    <div className="min-h-screen bg-background">
      {/* Client-side guard: redirects away from restricted module paths */}
      <AdminModuleGuard modulos={modulos} fallbackHref={fallbackHref} />

      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <AdminSidebar nombreCompleto={nombreCompleto} navLinks={allowedNavLinks} />
            <h1 className="text-xl font-semibold text-foreground">
              Panel de administracion
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AdminBackButton />
            {isAuthed && <AdminLogoutButton />}
          </div>
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
