/**
 * Pagina de inicio para el flujo de Retencion.
 */

import NuevoCasoLauncher from '@/components/retencion/NuevoCasoLauncher';
import { prisma } from '@/lib/prisma';
import { hoyISOArgentina } from '@/lib/cumples';

// La página consulta los cumpleaños del día: siempre dinámica.
export const dynamic = 'force-dynamic';

const obligatorios = [
  'Plan actual del abonado',
  'Antiguedad',
  'Historial de tickets',
  'Pagos',
  'Beneficios activos',
  'Fecha de alta',
];

const objetivos = [
  'Evitar confrontacion',
  'Justificar la pregunta siguiente',
  'Posicionarse como solucionador, no retenedor agresivo',
];

export default async function RetencionInicioPage() {
  // Cumpleaños de hoy (hora Argentina): visible para todos los roles, así que se
  // consulta Prisma directo (el middleware bloquea /api/admin/* para agentes).
  const hoy = hoyISOArgentina();
  const cumpleaneros = await prisma.orgEmpleado.findMany({
    where: { estado: 'active', fecha_nacimiento: { endsWith: hoy.slice(4) } }, // '-mm-dd'
    select: { id: true, nombre: true, area: true },
    orderBy: { nombre: 'asc' },
  });

  return (
    <div className="flex flex-col gap-6">
      {cumpleaneros.length > 0 && (
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
      )}

      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.3em] text-foreground/40">
          Inicio
        </p>
        <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
          Manual operativo para agentes de retencion
        </h1>
        <p className="text-muted-foreground">
          Procedimientos claros, lenguaje simple y bonificaciones visibles en el momento justo.
        </p>
      </div>

      <section className="space-y-6">
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-amber-900 dark:text-amber-200">
          <p className="text-xs uppercase tracking-[0.25em] text-amber-800/70 dark:text-amber-200/70">
            Obligatorio
          </p>
          <h2 className="mt-2 text-lg font-semibold">Tener a mano en ISP Boss/Columbo:</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900/90 dark:text-amber-200/90">
            {obligatorios.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-destructive dark:text-red-200">
          <p className="text-xs uppercase tracking-[0.25em] text-destructive/80 dark:text-red-200/70">
            Regla
          </p>
          <h3 className="mt-2 text-lg font-semibold">
            No ofrecer ningun beneficio <span className="italic">hasta entender el motivo real.</span>
          </h3>
        </div>

        <div className="prose dark:prose-invert max-w-none">
          <h2>Objetivo del bloque</h2>
          <ul className="list-disc pl-5 text-foreground">
            {objetivos.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <NuevoCasoLauncher />
    </div>
  );
}
