/**
 * Banner con los cumpleaños del día (hora Argentina). Server component: consulta
 * Prisma directo. Si nadie cumple años hoy no renderiza nada.
 */

import { prisma } from '@/lib/prisma';
import { hoyISOArgentina } from '@/lib/cumples';

export default async function CumplesBanner() {
  const hoy = hoyISOArgentina();
  const cumpleaneros = await prisma.orgEmpleado.findMany({
    where: { estado: 'active', fecha_nacimiento: { endsWith: hoy.slice(4) } }, // '-mm-dd'
    select: { id: true, nombre: true, area: true },
    orderBy: { nombre: 'asc' },
  });

  if (cumpleaneros.length === 0) return null;

  return (
    <div className="rounded-2xl border border-pink-500/40 bg-pink-500/10 p-5 text-pink-900 dark:text-pink-200">
      <p className="text-xs uppercase tracking-[0.25em] text-pink-800/70 dark:text-pink-200/70">
        🎂 Cumpleaños de hoy
      </p>
      <ul className="mt-2 space-y-1">
        {cumpleaneros.map((c) => (
          <li key={c.id} className="text-lg font-semibold">
            ¡Feliz cumpleaños, {c.nombre}!
            {c.area && (
              <span className="ml-2 text-sm font-normal text-pink-900/70 dark:text-pink-200/70">
                ({c.area})
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
