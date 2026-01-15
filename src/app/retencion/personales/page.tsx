import Link from 'next/link';
import Bonificaciones from '@/components/Bonificaciones';
import CopyButton from '@/components/CopyButton';

export default function RetencionPersonalesPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold text-white">Motivo: Personales</h1>
        <p className="text-white/70">
          Una vez que detectamos el motivo por competencia, vamos a indagar en el tema en detalle.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-white/60">Mensaje sugerido</p>
        <p className="mt-2 text-white/90">
          “Entiendo, son cuestiones personales. Veamos entonces cómo podemos adaptarnos a tu situación actual.”
        </p>
        <div className="mt-4">
          <CopyButton text="Entiendo, son cuestiones personales. Veamos entonces cómo podemos adaptarnos a tu situación actual." />
        </div>
      </div>

      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5 text-red-100">
        <p className="text-xs uppercase tracking-[0.25em] text-red-200/70">Regla</p>
        <p className="mt-2 text-sm text-red-100/90">
          No entrar en detalles, recordar que son cuestiones personales.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-white/60">Mensaje sugerido</p>
        <p className="mt-2 text-white/90">
          “Recordá que si el motivo es mudanza podés acceder a una de las promociones de tu nuevo barrio, de acuerdo a la disponibilidad”
        </p>
        <div className="mt-4">
          <CopyButton text="Recordá que si el motivo es mudanza podés acceder a una de las promociones de tu nuevo barrio, de acuerdo a la disponibilidad" />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xl font-semibold text-white">Motivos</h3>
        <Link
          href="/retencion/mudanza"
          className="inline-flex h-10 items-center rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white/80 transition hover:border-white/30 hover:text-white"
        >
          Mudanza
        </Link>
      </div>

      <Bonificaciones />
    </div>
  );
}
