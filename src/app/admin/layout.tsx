import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import AdminBackButton from '@/components/AdminBackButton';
import AdminLogoutButton from '@/components/AdminLogoutButton';
import ThemeToggle from '@/components/ThemeToggle';

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
        select: { nombre: true, apellido: true, usuario: true },
      })
    : null;

  const nombreCompleto = usuarioRecord
    ? [usuarioRecord.nombre, usuarioRecord.apellido].filter(Boolean).join(' ').trim() || usuarioRecord.usuario
    : null;

  const isAuthed = Boolean(sessionValue);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-foreground">
              Panel de administracion
            </h1>
            <nav className="hidden md:flex space-x-4">
              <a
                href="/admin/bonificaciones"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Bonificaciones
              </a>
              <a
                href="/admin/usuarios"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Usuarios
              </a>
              <a
                href="/admin/peliculas"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Películas
              </a>
              <a
                href="/admin/peliculas/catalogo"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Catálogo
              </a>
              <a
                href="/admin/deportes"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Deportes
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {nombreCompleto && (
              <span className="hidden text-sm text-muted-foreground md:inline">{nombreCompleto}</span>
            )}
            <ThemeToggle />
            <AdminBackButton />
            {isAuthed && <AdminLogoutButton />}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
