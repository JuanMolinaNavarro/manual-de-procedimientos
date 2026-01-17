import Bonificaciones from '@/components/Bonificaciones';
import CopyButton from '@/components/CopyButton';

export default function RetencionMudanzaPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold text-foreground">Mudanza</h1>
        <p className="text-muted-foreground">
          En caso de que el cliente solicite la baja por mudanza.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Mensaje sugerido</p>
        <p className="mt-2 text-foreground">
          “Compartiéndome tu ubicación puedo mostrarte qué planes disponibles tenemos en esa zona”
        </p>
        <div className="mt-4">
          <CopyButton text="Compartiéndome tu ubicación puedo mostrarte qué planes disponibles tenemos en esa zona" />
        </div>
      </div>

      <Bonificaciones />
    </div>
  );
}
