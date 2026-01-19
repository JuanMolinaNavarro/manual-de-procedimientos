import CopyButton from '@/components/CopyButton';
import Bonificaciones from '@/components/Bonificaciones';

export default function FacturaMalCargadaPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold text-foreground">Factura mal cargada</h1>
        <p className="text-muted-foreground">
          El asesor debe identificar el error en la factura y corregirla.
        </p>
        <p className="text-muted-foreground">
          Luego enviarle directamente la nueva factura.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Mensaje sugerido</p>
        <p className="mt-2 text-foreground">
          “Lamento mucho lo sucedido, ya corregimos nuestro error en la factura, esta es la factura que te corresponde.”
        </p>
        <div className="mt-4">
          <CopyButton text="Lamento mucho lo sucedido, ya corregimos nuestro error en la factura, esta es la factura que te corresponde." />
        </div>
      </div>

      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-destructive dark:text-red-200">
        <p className="text-xs uppercase tracking-[0.25em] text-destructive/80 dark:text-red-200/70">
          Regla
        </p>
        <p className="mt-2 text-sm text-destructive/90 dark:text-red-100/90">
          Si el cliente continua firme con la gestion de baja, ofrecer las bonificaciones de retencion segun sucursal.
        </p>
      </div>

      <Bonificaciones />
    </div>
  );
}
