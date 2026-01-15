import Bonificaciones from '@/components/Bonificaciones';
import CopyButton from '@/components/CopyButton';

export default function RetencionCompetenciaPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold text-white">Motivo: Competencia</h1>
        <p className="text-white/70">
          Una vez que detectamos el motivo por competencia, vamos a indagar en el tema en detalle.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-white/60">Mensaje sugerido</p>
        <p className="mt-2 text-white/90">
          “Entiendo, te ofrecieron una alternativa desde la competencia. Si podés comentarme
          para ver bien qué te están ofreciendo y qué es lo que más valorás para armar un plan
          personalizado para vos”
        </p>
        <div className="mt-4">
          <CopyButton text="Entiendo, te ofrecieron una alternativa desde la competencia. Si podés comentarme para ver bien qué te están ofreciendo y qué es lo que más valorás para armar un plan personalizado para vos" />
        </div>
      </div>

      <Bonificaciones />
    </div>
  );
}
