/**
 * Botón para cerrar sesión del sitio (no admin).
 */

'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function SiteLogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/login', { method: 'DELETE' });
    router.push('/login');
  };

  return (
    <Button variant="outline" size="sm" onClick={handleLogout}>
      Cerrar sesión
    </Button>
  );
}
