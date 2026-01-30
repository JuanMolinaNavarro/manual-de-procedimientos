/**
 * Boton para volver al inicio sin cerrar sesion.
 */

'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function AdminBackButton() {
  const router = useRouter();

  const handleBack = () => {
    router.push('/retencion/inicio');
    router.refresh();
  };

  return (
    <Button variant="secondary" className="text-sm" onClick={handleBack}>
      Volver al inicio
    </Button>
  );
}
