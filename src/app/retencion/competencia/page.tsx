import Bonificaciones from '@/components/Bonificaciones';
import CopyButton from '@/components/CopyButton';

export default function RetencionCompetenciaPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold text-foreground">Motivo: Competencia</h1>
        <p className="text-muted-foreground">
          Una vez que detectamos el motivo por competencia, vamos a indagar en el tema en detalle.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Mensaje sugerido</p>
        <p className="mt-2 text-foreground">
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
