/**
 * Botón de cierre de sesión del panel admin.
 */

'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function AdminLogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' });
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <Button variant="outline" onClick={handleLogout} className="text-sm">
      Cerrar sesión
    </Button>
  );
}
