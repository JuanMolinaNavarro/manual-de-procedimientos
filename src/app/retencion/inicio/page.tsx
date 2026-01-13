import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Bonificaciones from '@/components/Bonificaciones';
import CopyButton from '@/components/CopyButton';

export default function RetencionInicioPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.3em] text-white/40">
          Primeros pasos
        </p>
        <h1 className="text-3xl font-semibold text-white md:text-4xl">
          Manual operativo para agentes de retención
        </h1>
        <p className="text-white/70">
          Procedimientos claros, lenguaje simple y bonificaciones visibles en el momento justo.
        </p>
      </div>

      <section className="space-y-6">
        <div className="rounded-2xl border border-yellow-400/40 bg-yellow-500/10 p-5 text-yellow-100">
          <p className="text-xs uppercase tracking-[0.25em] text-yellow-200/70">Obligatorio</p>
          <h2 className="mt-2 text-lg font-semibold">Tener a mano en ISP Boss/Columbo:</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-yellow-100/90">
            <li>Plan actual del abonado</li>
            <li>Antigüedad</li>
            <li>Historial de tickets</li>
            <li>Pagos</li>
            <li>Beneficios activos</li>
            <li>Fecha de alta</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5 text-red-100">
          <p className="text-xs uppercase tracking-[0.25em] text-red-200/70">Regla</p>
          <h3 className="mt-2 text-lg font-semibold">
            No ofrecer ningún beneficio <span className="italic">hasta entender el motivo real.</span>
          </h3>
        </div>

        <div className="prose prose-invert max-w-none">
          <h2>Objetivo del bloque</h2>
          <ul className="list-disc pl-5 text-white/80">
            <li>Evitar confrontación</li>
            <li>Justificar la pregunta siguiente</li>
            <li>Posicionarse como solucionador, no retenedor agresivo</li>
          </ul>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-white/60">Respuesta sugerida</p>
            <p className="mt-2 text-white/90">
              “Hola, mi nombre es [Agente], gracias por comunicarte. Lamento que estés pasando
              por esta situación, voy a acompañarte para resolverlo de la mejor manera posible.”
            </p>
            <div className="mt-4">
              <CopyButton text="Hola, mi nombre es [Agente], gracias por comunicarte. Lamento que estés pasando por esta situación, voy a acompañarte para resolverlo de la mejor manera posible." />
            </div>
          </div>

          <p className="text-sm text-white/60">Nota: No mencionar la palabra baja aún.</p>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-white/60">Respuesta sugerida</p>
            <p className="mt-2 text-white/90">
              “Antes de avanzar con el trámite, necesito entender bien qué fue lo que pasó para ayudarte correctamente.”
            </p>
            <div className="mt-4">
              <CopyButton text="Antes de avanzar con el trámite, necesito entender bien qué fue lo que pasó para ayudarte correctamente." />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-yellow-400/40 bg-yellow-500/10 p-5 text-yellow-100">
          <p className="text-xs uppercase tracking-[0.25em] text-yellow-200/70">Regla operativa del bloque</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-yellow-100/90">
            <li>No interrumpir</li>
            <li>No corregir</li>
            <li>No explicar políticas</li>
            <li>No ofrecer soluciones todavía</li>
            <li>Entender y tomar nota literal del motivo</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-white/60">Respuesta sugerida</p>
          <p className="mt-2 text-white/90">“¿Me contás qué fue lo que te llevó a elegir este proceso?”</p>
          <div className="mt-4">
            <CopyButton text="¿Me contás qué fue lo que te llevó a elegir este proceso?" />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-white/80">
            Una vez que conozcamos el motivo de contacto, continuamos.
          </p>
          <div className="mt-4">
            <Button asChild>
              <Link href="/retencion/continuacion">Continuar</Link>
            </Button>
          </div>
        </div>
      </section>

      <details className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <summary className="cursor-pointer text-sm font-semibold text-white/80">
          Contenido anterior (no borrar)
        </summary>
        <div className="mt-4 space-y-6">
          <article className="prose prose-invert max-w-none">
            <h2>1.1 Factura mal cargada</h2>
            <h3>Procedimiento</h3>
            <ul className="list-disc pl-5">
              <li>Validar factura en el sistema.</li>
              <li>Confirmar el error con el cliente.</li>
              <li>Explicar la situación y ofrecer solución.</li>
            </ul>
            <div className="not-prose rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-white/60">Resolución sugerida</p>
              <p className="mt-2 text-white/90">
                “Lamentamos lo sucedido. Revisando tu cuenta veo el error en la facturación. Voy a corregirlo y puedo ofrecerte estas opciones.”
              </p>
            </div>
            <Bonificaciones />
            <hr />
            <h2>1.2 Cliente insatisfecho con el servicio</h2>
            <h3>Procedimiento</h3>
            <ul className="list-disc pl-5">
              <li>Escuchar activamente al cliente.</li>
              <li>Validar su experiencia.</li>
              <li>Ofrecer soluciones concretas.</li>
            </ul>
            <Bonificaciones />
          </article>
        </div>
      </details>
    </div>
  );
}
