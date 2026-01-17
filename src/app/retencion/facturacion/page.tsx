import Link from 'next/link';
import CopyButton from '@/components/CopyButton';

export default function RetencionFacturacionPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold text-foreground">Motivo: Facturación</h1>
        <p className="text-muted-foreground">
          Una vez que detectamos el problema en facturación vamos a indagar en el tema en detalle.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Mensaje sugerido</p>
        <p className="mt-2 text-foreground">
          “Entiendo, entonces el problema estuvo en la facturación. Vamos a revisarlo ahora para ver exactamente qué pasó.”
        </p>
        <div className="mt-4">
          <CopyButton text="Entiendo, entonces el problema estuvo en la facturación. Vamos a revisarlo ahora para ver exactamente qué pasó." />
        </div>
      </div>

      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-destructive dark:text-red-200">
        <p className="text-xs uppercase tracking-[0.25em] text-destructive/80 dark:text-red-200/70">Importante</p>
        <p className="mt-2 text-sm text-destructive/90 dark:text-red-100/90">
          Entrar en detalle es clave, para tomar puntos críticos para mejoras.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Ahora vamos a identificar el motivo en detalle:</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground hover:text-foreground"
            href="/retencion/facturacion/factura-mal-cargada"
          >
            Factura mal cargada
          </Link>
          <Link
            className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground hover:text-foreground"
            href="/retencion/facturacion/procedimiento-a"
          >
            Monto mayor al esperado
          </Link>
          <Link
            className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground hover:text-foreground"
            href="/retencion/facturacion/procedimiento-b"
          >
            Dificultad de pago (medios)
          </Link>
          <Link
            className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground hover:text-foreground"
            href="/retencion/facturacion/procedimiento-b"
          >
            Caso X
          </Link>
        </div>
      </div>
    </div>
  );
}
