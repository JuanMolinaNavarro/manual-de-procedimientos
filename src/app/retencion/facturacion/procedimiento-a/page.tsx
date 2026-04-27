import Link from 'next/link';
import CopyButton from '@/components/CopyButton';
import Bonificaciones from '@/components/Bonificaciones';

const msgDescuentoVencido =
  'Entiendo, revisando tu cuenta veo que tenías un descuento que venció recientemente. Vamos a ver qué podemos hacer para que puedas seguir disfrutando del servicio.';

const msgServicioAgregado =
  'Revisando tu cuenta veo que se agregó un servicio adicional en tu última factura. Te explico exactamente qué es y cómo aparece en el detalle.';

const msgCargoEquipo =
  'El monto adicional corresponde al cargo por el equipo instalado en tu domicilio. Te explico cómo está compuesto ese cargo.';

const msgAumentoPrecio =
  'Entiendo perfectamente, un aumento siempre genera incomodidad. Vamos a ver cuál es la mejor opción para que puedas seguir con el servicio sin que impacte tanto en tu presupuesto.';

const msgDebitoAutomatico =
  'Si querés, podemos inscribirte en débito automático, lo que te da acceso a beneficios exclusivos. Es la forma más cómoda y evita que se te pase algún vencimiento.';

const msgDowngradePlan =
  'Otra opción es ajustar tu plan a uno más económico que se adapte mejor a tu presupuesto actual.';

export default function ProcedimientoAFacturacionPage() {
  return (
    <div className="space-y-10">

      {/* Header */}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-foreground/40">Facturación</p>
        <h1 className="text-3xl font-semibold text-foreground">Monto mayor al esperado</h1>
        <p className="text-muted-foreground">
          Antes de responder al cliente, identificá la causa exacta del monto mayor en el sistema.
          Cada sub-caso tiene un abordaje distinto.
        </p>
      </div>

      {/* Verificación inicial */}
      <div className="rounded-2xl border border-blue-500/40 bg-blue-500/10 p-5 text-blue-900 dark:text-blue-200">
        <p className="text-xs uppercase tracking-[0.25em] text-blue-800/70 dark:text-blue-200/70">
          Verificación previa en ISP / Columbo
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-blue-900/90 dark:text-blue-200/90">
          <li>Plan actual del abonado</li>
          <li>Historial de pagos y facturas anteriores</li>
          <li>Historial de tickets</li>
          <li>Beneficios y bonificaciones activas</li>
          <li>Equipos asociados a la cuenta</li>
        </ul>
        <p className="mt-3 text-sm text-blue-900/80 dark:text-blue-200/80">
          Identificá la causa antes de hablar — cada sub-caso requiere un abordaje diferente.
        </p>
      </div>

      {/* Navegación por sub-casos */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">¿Cuál es la causa del monto mayor?</h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="#descuento-vencido"
            className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            Descuento vencido
          </a>
          <a
            href="#servicio-adicional"
            className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            Plan / servicio adicional agregado
          </a>
          <a
            href="#cargo-equipo"
            className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            Cargo de equipo
          </a>
          <a
            href="#aumento-precio"
            className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            Aumento de precio general
          </a>
        </div>
      </div>

      <hr className="border-border" />

      {/* Sub-caso 1: Descuento vencido */}
      <section id="descuento-vencido" className="space-y-4 scroll-mt-6">
        <h2 className="text-xl font-semibold text-foreground">Descuento vencido</h2>
        <p className="text-sm text-muted-foreground">
          El abonado tenía una promoción o descuento por tiempo limitado que llegó a su vencimiento.
          El monto mayor refleja el precio regular del plan.
        </p>

        <div className="rounded-2xl border border-blue-500/40 bg-blue-500/10 p-4 text-blue-900 dark:text-blue-200">
          <p className="text-xs uppercase tracking-[0.25em] text-blue-800/70 dark:text-blue-200/70">
            Nota para el agente
          </p>
          <p className="mt-2 text-sm text-blue-900/90 dark:text-blue-200/90">
            Verificá la fecha exacta en que venció el descuento y el monto original vs. el actual.
            Aclarar al cliente que el descuento fue por tiempo limitado, sin generar confrontación.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Mensaje sugerido</p>
            <CopyButton text={msgDescuentoVencido} />
          </div>
          <p className="mt-3 text-foreground">"{msgDescuentoVencido}"</p>
        </div>

        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
          <p className="text-xs uppercase tracking-[0.25em] text-amber-800/70 dark:text-amber-200/70">
            Siguiente paso
          </p>
          <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/90">
            Pasar a las opciones de retención disponibles más abajo.
          </p>
        </div>
      </section>

      <hr className="border-border" />

      {/* Sub-caso 2: Servicio adicional */}
      <section id="servicio-adicional" className="space-y-4 scroll-mt-6">
        <h2 className="text-xl font-semibold text-foreground">Plan o servicio adicional agregado</h2>
        <p className="text-sm text-muted-foreground">
          Se sumó un plan o servicio a la cuenta del abonado que generó un cargo extra en la factura.
        </p>

        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
          <p className="text-xs uppercase tracking-[0.25em] text-amber-800/70 dark:text-amber-200/70">
            Regla operativa
          </p>
          <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/90">
            Explicar claramente qué fue lo que se agregó — nombre del servicio, fecha y monto — antes de ofrecer cualquier solución.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Mensaje sugerido</p>
            <CopyButton text={msgServicioAgregado} />
          </div>
          <p className="mt-3 text-foreground">"{msgServicioAgregado}"</p>
        </div>

        <div className="rounded-2xl border border-blue-500/40 bg-blue-500/10 p-4 text-blue-900 dark:text-blue-200">
          <p className="text-xs uppercase tracking-[0.25em] text-blue-800/70 dark:text-blue-200/70">
            ¿El cargo fue un error?
          </p>
          <p className="mt-2 text-sm text-blue-900/90 dark:text-blue-200/90">
            Si el servicio fue agregado por error (sin autorización del cliente), derivar al procedimiento de factura mal cargada.
          </p>
          <div className="mt-3">
            <Link
              href="/retencion/facturacion/factura-mal-cargada"
              className="inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-500/20 dark:text-blue-200 transition-colors"
            >
              Ir a: Factura mal cargada →
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
          <p className="text-xs uppercase tracking-[0.25em] text-amber-800/70 dark:text-amber-200/70">
            Siguiente paso
          </p>
          <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/90">
            Si el servicio fue solicitado y el cliente igual quiere bajar, pasar a las opciones de retención.
          </p>
        </div>
      </section>

      <hr className="border-border" />

      {/* Sub-caso 3: Cargo de equipo */}
      <section id="cargo-equipo" className="space-y-4 scroll-mt-6">
        <h2 className="text-xl font-semibold text-foreground">Cargo de equipo</h2>
        <p className="text-sm text-muted-foreground">
          La factura incluye un cargo por alquiler o comodato del equipo instalado en el domicilio del abonado.
        </p>

        <div className="rounded-2xl border border-blue-500/40 bg-blue-500/10 p-4 text-blue-900 dark:text-blue-200">
          <p className="text-xs uppercase tracking-[0.25em] text-blue-800/70 dark:text-blue-200/70">
            Nota para el agente
          </p>
          <p className="mt-2 text-sm text-blue-900/90 dark:text-blue-200/90">
            Verificar en Columbo: tipo y modelo del equipo, fecha de instalación y condiciones del comodato.
            Tener el detalle a mano antes de explicar.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Mensaje sugerido</p>
            <CopyButton text={msgCargoEquipo} />
          </div>
          <p className="mt-3 text-foreground">"{msgCargoEquipo}"</p>
        </div>

        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
          <p className="text-xs uppercase tracking-[0.25em] text-amber-800/70 dark:text-amber-200/70">
            Siguiente paso
          </p>
          <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/90">
            Pasar a las opciones de retención disponibles más abajo.
          </p>
        </div>
      </section>

      <hr className="border-border" />

      {/* Sub-caso 4: Aumento de precio */}
      <section id="aumento-precio" className="space-y-4 scroll-mt-6">
        <h2 className="text-xl font-semibold text-foreground">Aumento de precio general</h2>
        <p className="text-sm text-muted-foreground">
          El plan del abonado tuvo un aumento de tarifa general.
        </p>

        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-destructive dark:text-red-200">
          <p className="text-xs uppercase tracking-[0.25em] text-destructive/80 dark:text-red-200/70">
            Regla crítica
          </p>
          <p className="mt-2 text-sm font-medium text-destructive/90 dark:text-red-100/90">
            Nunca defender el aumento. Defender al cliente.
          </p>
        </div>

        <div className="rounded-2xl border border-blue-500/40 bg-blue-500/10 p-4 text-blue-900 dark:text-blue-200">
          <p className="text-xs uppercase tracking-[0.25em] text-blue-800/70 dark:text-blue-200/70">
            Nota para el agente
          </p>
          <p className="mt-2 text-sm text-blue-900/90 dark:text-blue-200/90">
            En este punto el cliente ya declaró intención de baja. No prometer descuento ni discutir el
            precio — primero entender y validar al cliente.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Mensaje sugerido</p>
            <CopyButton text={msgAumentoPrecio} />
          </div>
          <p className="mt-3 text-foreground">"{msgAumentoPrecio}"</p>
        </div>
      </section>

      <hr className="border-border" />

      {/* Opciones de retención */}
      <section id="opciones-retencion" className="space-y-6 scroll-mt-6">
        <h2 className="text-xl font-semibold text-foreground">Opciones de retención</h2>

        {/* Opción principal: débito automático */}
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-emerald-900 dark:text-emerald-200">
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-800/70 dark:text-emerald-200/70">
            Opción principal — Débito automático
          </p>
          <p className="mt-2 text-sm text-emerald-900/80 dark:text-emerald-200/80">
            El cliente siente que está ganando algo. Presentarlo como un beneficio, no como una obligación.
          </p>
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-emerald-800/70 dark:text-emerald-200/70">Mensaje sugerido</p>
              <CopyButton text={msgDebitoAutomatico} />
            </div>
            <p className="mt-2 text-sm">"{msgDebitoAutomatico}"</p>
          </div>
        </div>

        {/* Opción secundaria: downgrade */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-medium text-foreground">Opción secundaria — Downgrade de plan</p>

            <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive dark:text-red-200">
              <p className="text-xs text-destructive/80 dark:text-red-200/70">
                No aplicable si el cliente tiene el plan mínimo (10 Mb).
              </p>
            </div>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Mensaje sugerido</p>
              <CopyButton text={msgDowngradePlan} />
            </div>
            <p className="mt-2 text-foreground">"{msgDowngradePlan}"</p>
          </div>
        </div>

        {/* Bonificaciones */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-destructive dark:text-red-200">
            <p className="text-xs uppercase tracking-[0.25em] text-destructive/80 dark:text-red-200/70">
              Regla
            </p>
            <p className="mt-2 text-sm text-destructive/90 dark:text-red-100/90">
              Si el cliente continúa firme con la baja, ofrecer las bonificaciones de retención según sucursal.
            </p>
          </div>
          <Bonificaciones />
        </div>
      </section>

    </div>
  );
}
