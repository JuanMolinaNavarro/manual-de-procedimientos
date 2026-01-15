/**
 * Botón para volver al inicio y cerrar sesión.
 */

'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function AdminBackButton() {
  const router = useRouter();

  const handleBack = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' });
    router.push('/retencion/inicio');
    router.refresh();
  };

  return (
    <Button variant="secondary" className="text-sm" onClick={handleBack}>
      Volver al inicio
    </Button>
  );
}
