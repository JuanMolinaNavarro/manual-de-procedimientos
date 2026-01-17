import Link from 'next/link';
import Bonificaciones from '@/components/Bonificaciones';
import CopyButton from '@/components/CopyButton';

export default function RetencionPersonalesPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold text-foreground">Motivo: Personales</h1>
        <p className="text-muted-foreground">
          Una vez que detectamos el motivo personal, vamos a indagar en el tema en detalle.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Mensaje sugerido</p>
        <p className="mt-2 text-foreground">
          “Entiendo, son cuestiones personales. Veamos entonces cómo podemos adaptarnos a tu situación actual.”
        </p>
        <div className="mt-4">
          <CopyButton text="Entiendo, son cuestiones personales. Veamos entonces cómo podemos adaptarnos a tu situación actual." />
        </div>
      </div>

      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-destructive dark:text-red-200">
        <p className="text-xs uppercase tracking-[0.25em] text-destructive/80 dark:text-red-200/70">Regla</p>
        <p className="mt-2 text-sm text-destructive/90 dark:text-red-100/90">
          No entrar en detalles, recordar que son cuestiones personales.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Mensaje sugerido</p>
        <p className="mt-2 text-foreground">
          “Recordá que si el motivo es mudanza podés acceder a una de las promociones de tu nuevo barrio, de acuerdo a la disponibilidad”
        </p>
        <div className="mt-4">
          <CopyButton text="Recordá que si el motivo es mudanza podés acceder a una de las promociones de tu nuevo barrio, de acuerdo a la disponibilidad" />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xl font-semibold text-foreground">Motivos</h3>
        <Link
          href="/retencion/mudanza"
          className="inline-flex h-10 items-center rounded-full border border-border bg-card px-4 text-sm text-foreground transition hover:text-foreground"
        >
          Mudanza
        </Link>
      </div>

      <Bonificaciones />
    </div>
  );
}
