/**
 * Pagina de inicio para el flujo de Retencion.
 */

import NuevoCasoLauncher from '@/components/retencion/NuevoCasoLauncher';

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

export default function RetencionInicioPage() {
  return (
    <div className="flex flex-col gap-6">
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
