import type { Metadata } from 'next';
import { getSesion } from '@/lib/admin-auth';
import { getModulosForUser, modulosEfectivos } from '@/lib/modulos';
import { isEmpleadoRole } from '@/lib/roles';
import AdminLogoutButton from '@/components/AdminLogoutButton';
import ThemeToggle from '@/components/ThemeToggle';
import AdminSidebar from '@/components/AdminSidebar';
import AdminModuleGuard from '@/components/AdminModuleGuard';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'AURELIUS',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuarioRecord = await getSesion();

  // Superadmin ve todos los módulos ([] = sin restricción); empleado, solo su portal.
  const modulos = modulosEfectivos(usuarioRecord?.rol, usuarioRecord?.modulos);
  const allowedNavLinks = getModulosForUser(modulos);
  const fallbackHref = allowedNavLinks[0]?.href ?? '/admin';

  const nombreCompleto = usuarioRecord
    ? [usuarioRecord.nombre, usuarioRecord.apellido].filter(Boolean).join(' ').trim() || usuarioRecord.usuario
    : null;

  const isAuthed = Boolean(usuarioRecord);

  return (
    <div className="min-h-screen bg-background">
      {/* Client-side guard: redirects away from restricted module paths */}
      <AdminModuleGuard modulos={modulos} fallbackHref={fallbackHref} />

      <header className="border-b border-border bg-card">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <AdminSidebar
              nombreCompleto={nombreCompleto}
              navLinks={allowedNavLinks}
              titulo={isEmpleadoRole(usuarioRecord?.rol) ? 'Aurelius' : undefined}
            />
            {/* El logo es blanco: en tema claro se invierte para que se vea. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="AURELIUS"
              className="h-9 w-9 object-contain invert dark:invert-0"
            />
            {/* En teléfonos angostos queda solo el logo: el título no entra junto a los botones. */}
            <h1 className="hidden font-[family-name:var(--font-playfair)] text-2xl font-semibold tracking-wide text-foreground min-[420px]:block">
              AURELIUS
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isAuthed && <AdminLogoutButton />}
          </div>
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* Único Toaster del panel: antes vivía dentro de NominaProvider y los
          toasts de los demás módulos no se renderizaban. */}
      <Toaster position="top-center" richColors />
    </div>
  );
}
