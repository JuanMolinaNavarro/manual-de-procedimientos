import CopyButton from '@/components/CopyButton';
import Bonificaciones from '@/components/Bonificaciones';

export default function ProcedimientoBFacturacionPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold text-foreground">Dificultad con medios de pago</h1>
        <p className="text-muted-foreground">
          Consultar con cual medio de pago desea pagar y ofrecerle las alternativas de pago que se asemejen a ese medio.
        </p>
      </div>

      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-destructive dark:text-red-200">
        <p className="text-xs uppercase tracking-[0.25em] text-destructive/80 dark:text-red-200/70">
          Regla
        </p>
        <p className="mt-2 text-sm text-destructive/90 dark:text-red-100/90">
          Si el cliente insiste con la gestion de baja, ofrecer las bonificaciones de retencion segun sucursal.
        </p>
      </div>

      <Bonificaciones />
    </div>
  );
}
