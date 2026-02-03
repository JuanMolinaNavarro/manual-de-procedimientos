import Link from 'next/link';
import CopyButton from '@/components/CopyButton';

const motivos = [
  'Sin señal',
  'Baja señal',
  'LOS Rojo',
  'Cable Cortado',
  'MicroCortes',
  'Lentitud',
  'Interferencia',
  'Demora en Visita Técnica',
];

export default function RetencionTecnicosPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold text-foreground">Motivo: Técnicos</h1>
        <p className="text-muted-foreground">
          Una vez que detectamos el problema técnico, vamos a indagar en el tema en detalle.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Mensaje sugerido</p>
        <p className="mt-2 text-foreground">
          “Vemos entonces que tuviste un inconveniente Técnico. Actualmente estamos trabajando para mejorar esta área.”
        </p>
        <div className="mt-4">
          <CopyButton text="Vemos entonces que tuviste un inconveniente Técnico. Actualmente estamos trabajando para mejorar esta área." />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Mensaje sugerido</p>
        <p className="mt-2 text-foreground">
          “Esta situación nos sirve para mejorar y la próxima vez evitarlo o resolverlo más rápido”
        </p>
        <div className="mt-4">
          <CopyButton text="Esta situación nos sirve para mejorar y la próxima vez evitarlo o resolverlo más rápido" />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-foreground">Motivos</h3>
        <div className="flex flex-wrap gap-3">
          {motivos.map((motivo) => (
            <Link
              key={motivo}
              href="/retencion/tecnicos"
              className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground hover:text-foreground"
            >
              {motivo}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
