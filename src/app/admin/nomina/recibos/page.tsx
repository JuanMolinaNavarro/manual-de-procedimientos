import { redirect } from 'next/navigation';

/** "Nómina · Recibos" pasó a ser el módulo propio Gestión de recibos: la dirección vieja redirige. */
export default function Page() {
  redirect('/admin/gestion-recibos');
}
