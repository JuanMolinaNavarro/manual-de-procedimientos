/**
 * Layout del Panel de Administración
 *
 * Proporciona la estructura común para todas las páginas de admin.
 */

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' });
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-foreground">
              Panel de administración
            </h1>
            <nav className="hidden md:flex space-x-4">
              <a
                href="/admin/bonificaciones"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Bonificaciones
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" className="text-sm">
              <Link href="/retencion/inicio">Volver al inicio</Link>
            </Button>
            <Button variant="outline" onClick={handleLogout} className="text-sm">
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
