/**
 * Página principal: redirige al flujo de Retención.
 */

import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/retencion/inicio');
}
