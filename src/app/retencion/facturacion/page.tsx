import Link from 'next/link';
import CopyButton from '@/components/CopyButton';

export default function RetencionFacturacionPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold text-white">Motivo: Facturación</h1>
        <p className="text-white/70">
          Una vez que detectamos el problema en facturación vamos a indagar en el tema en detalle.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-white/60">Mensaje sugerido</p>
        <p className="mt-2 text-white/90">
          “Entiendo, entonces el problema estuvo en la facturación. Vamos a revisarlo ahora
          para ver exactamente qué pasó.”
        </p>
        <div className="mt-4">
          <CopyButton text="Entiendo, entonces el problema estuvo en la facturación. Vamos a revisarlo ahora para ver exactamente qué pasó." />
        </div>
      </div>

      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5 text-red-100">
        <p className="text-xs uppercase tracking-[0.25em] text-red-200/70">Importante</p>
        <p className="mt-2 text-sm text-red-100/90">
          Entrar en detalle es clave, para tomar puntos críticos para mejoras.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Ahora vamos a identificar el motivo en detalle:</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:border-white/30 hover:text-white"
            href="/retencion/facturacion/procedimiento-a"
          >
            Factura mal cargada
          </Link>
          <Link
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:border-white/30 hover:text-white"
            href="/retencion/facturacion/procedimiento-a"
          >
            Monto mayor al esperado
          </Link>
          <Link
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:border-white/30 hover:text-white"
            href="/retencion/facturacion/procedimiento-b"
          >
            Dificultad de pago (medios)
          </Link>
          <Link
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:border-white/30 hover:text-white"
            href="/retencion/facturacion/procedimiento-b"
          >
            Caso X
          </Link>
        </div>
      </div>
    </div>
  );
}
