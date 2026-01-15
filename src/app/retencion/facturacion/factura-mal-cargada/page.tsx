import CopyButton from '@/components/CopyButton';
import Bonificaciones from '@/components/Bonificaciones';

export default function FacturaMalCargadaPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold text-white">Factura mal cargada</h1>
        <p className="text-white/70">
          En este caso, se revisa la factura, se corrige y se le ofrece una bonificación al cliente.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-white/60">Mensaje sugerido</p>
        <p className="mt-2 text-white/90">
          “Lamentamos lo sucedido, viendo tu situación, puedo ofrecerte...”
        </p>
        <div className="mt-4">
          <CopyButton text="Lamentamos lo sucedido, viendo tu situación, puedo ofrecerte..." />
        </div>
      </div>

      <Bonificaciones />
    </div>
  );
}
