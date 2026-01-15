import Link from 'next/link';
import CopyButton from '@/components/CopyButton';

const motivos = [
  'Sin señal',
  'Baja señal',
  'Los Rojo',
  'Cable Cortado',
  'MicroCortes',
  'Lentitud',
  'Interferencia',
  'Demora en Visita Tecnica',
];

export default function RetencionTecnicosPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold text-white">Motivo: Técnicos</h1>
        <p className="text-white/70">
          Una vez que detectamos el problema técnico, vamos a indagar en el tema en detalle.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-white/60">Mensaje sugerido</p>
        <p className="mt-2 text-white/90">
          “Vemos entonces que tuviste un inconveniente Técnico. Actualmente estamos trabajando
          para mejorar esta área.”
        </p>
        <div className="mt-4">
          <CopyButton text="Vemos entonces que tuviste un inconveniente Técnico. Actualmente estamos trabajando para mejorar esta área." />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-white/60">Mensaje sugerido</p>
        <p className="mt-2 text-white/90">
          “Esta situación nos sirve para mejorar y la próxima vez evitarlo o resolverlo más rápido”
        </p>
        <div className="mt-4">
          <CopyButton text="Esta situación nos sirve para mejorar y la próxima vez evitarlo o resolverlo más rápido" />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white">Motivos</h3>
        <div className="flex flex-wrap gap-3">
          {motivos.map((motivo, index) => (
            <Link
              key={`${motivo}-${index}`}
              href="/retencion/tecnicos"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:border-white/30 hover:text-white"
            >
              {motivo}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
