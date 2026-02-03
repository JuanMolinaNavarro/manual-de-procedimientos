/**
 * Página de inicio para el flujo de Retención.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Bonificaciones from '@/components/Bonificaciones';
import CopyButton from '@/components/CopyButton';

const obligatorios = [
  'Plan actual del abonado',
  'Antigüedad',
  'Historial de tickets',
  'Pagos',
  'Beneficios activos',
  'Fecha de alta',
];

const objetivos = [
  'Evitar confrontación',
  'Justificar la pregunta siguiente',
  'Posicionarse como solucionador, no retenedor agresivo',
];

const reglasOperativas = [
  'No interrumpir',
  'No corregir',
  'No explicar políticas',
  'No ofrecer soluciones todavía',
  'Entender y tomar nota literal del motivo',
];

export default function RetencionInicioPage() {
  const [nombreAgente, setNombreAgente] = useState('[Agente]');

  useEffect(() => {
    const loadNombre = async () => {
      try {
        const response = await fetch('/api/me');
        if (!response.ok) return;
        const data = await response.json();
        const display = data.nombre || data.usuario || '[Agente]';
        setNombreAgente(display);
      } catch {
        // Silencioso: fallback a [Agente]
      }
    };

    loadNombre();
  }, []);

  const saludo = `Hola, mi nombre es ${nombreAgente}, gracias por comunicarte. 😊 Lamento que estés pasando por esta situación, voy a acompañarte para resolverlo de la mejor manera posible. 🤝`;
  const antesDeAvanzar =
    'Antes de avanzar con el trámite, necesito entender bien qué fue lo que pasó para ayudarte correctamente. 🧭';
  const motivoProceso = '¿Me contás qué fue lo que te llevó a elegir este proceso? 📝';

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.3em] text-foreground/40">
          Primeros pasos
        </p>
        <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
          Manual operativo para agentes de retención
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
            No ofrecer ningún beneficio <span className="italic">hasta entender el motivo real.</span>
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

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Respuesta sugerida</p>
              <CopyButton text={saludo} />
            </div>
            <p className="mt-3 text-foreground">“{saludo}”</p>
          </div>

          <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Nota: No mencionar la palabra baja aún.
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Respuesta sugerida</p>
              <CopyButton text={antesDeAvanzar} />
            </div>
            <p className="mt-3 text-foreground">“{antesDeAvanzar}”</p>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-amber-900 dark:text-amber-200">
          <p className="text-xs uppercase tracking-[0.25em] text-amber-800/70 dark:text-amber-200/70">
            Regla operativa del bloque
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900/90 dark:text-amber-200/90">
            {reglasOperativas.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Respuesta sugerida</p>
            <CopyButton text={motivoProceso} />
          </div>
          <p className="mt-3 text-foreground">“{motivoProceso}”</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-foreground">
            Una vez que conozcamos el motivo de contacto, continuamos.
          </p>
          <div className="mt-4">
            <Button asChild>
              <Link href="/retencion/continuacion">Continuar</Link>
            </Button>
          </div>
        </div>
      </section>

      <details className="rounded-2xl border border-border bg-card p-5">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">
          Contenido anterior (no borrar)
        </summary>
        <div className="mt-4 space-y-6">
          <article className="prose dark:prose-invert max-w-none">
            <h2>1.1 Factura mal cargada</h2>
            <h3>Procedimiento</h3>
            <ul className="list-disc pl-5">
              <li>Validar factura en el sistema.</li>
              <li>Confirmar el error con el cliente.</li>
              <li>Explicar la situación y ofrecer solución.</li>
            </ul>
            <div className="not-prose rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Resolución sugerida</p>
              <p className="mt-2 text-foreground">
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
