import Link from 'next/link';
import CopyButton from '@/components/CopyButton';

export default function RetencionContinuacionPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.3em] text-foreground/40">
          Continuación
        </p>
        <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
          Profundizar el motivo y ordenar la conversación
        </h1>
        <p className="text-muted-foreground">
          Este bloque se usa luego de escuchar el motivo de contacto.
        </p>
      </div>

      <section className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Respuesta posterior</p>
          <p className="mt-2 text-foreground">
            “Entiendo lo que me estás comentando, mi objetivo es intentar resolverlo de la forma más simple posible.”
          </p>
          <div className="mt-4">
            <CopyButton text="Entiendo lo que me estás comentando, mi objetivo es intentar resolverlo de la forma más simple posible." />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Respuesta posterior</p>
          <p className="mt-2 text-foreground">
            “Perfecto, veamos entonces qué es lo que pasó en detalle y qué opciones tenemos para resolverlo”
          </p>
          <div className="mt-4">
            <CopyButton text="Perfecto, veamos entonces qué es lo que pasó en detalle y qué opciones tenemos para resolverlo" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Motivos</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground hover:text-foreground"
            href="/retencion/facturacion"
          >
            Facturación
          </Link>
          <Link
            className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground hover:text-foreground"
            href="/retencion/competencia"
          >
            Competencia
          </Link>
          <Link
            className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground hover:text-foreground"
            href="/retencion/personales"
          >
            Personales
          </Link>
          <Link
            className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground hover:text-foreground"
            href="/retencion/tecnicos"
          >
            Técnicos
          </Link>
        </div>
      </section>
    </div>
  );
}
