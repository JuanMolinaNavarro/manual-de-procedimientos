import Link from 'next/link';

export default function RetencionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0f1011] text-zinc-100">
      <div className="relative isolate">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_80%_at_50%_0%,rgba(255,255,255,0.08),rgba(15,16,17,0))]" />

        <header className="border-b border-white/10">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold tracking-wide">
                Manual de Procedimientos - Callcenter
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                Atención y Retención
              </span>
            </div>
            <div className="hidden items-center gap-6 text-sm text-white/70 md:flex">
              <Link className="hover:text-white" href="/retencion/inicio">
                Retención
              </Link>
              <Link className="hover:text-white" href="/admin/login">
                Panel admin
              </Link>
            </div>
          </div>
        </header>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 md:grid-cols-[240px_1fr] lg:grid-cols-[240px_1fr_220px]">
        <aside className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <input
              className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/40 focus:outline-none"
              placeholder="Buscar procedimientos..."
              type="search"
            />
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <details open>
              <summary className="cursor-pointer text-sm font-semibold text-white">
                Retención
              </summary>
              <nav className="mt-3 space-y-1 text-sm">
                <Link
                  className="block rounded-md px-3 py-2 text-white/70 hover:bg-white/5 hover:text-white"
                  href="/retencion/inicio"
                >
                  Inicio
                </Link>
                <Link
                  className="block rounded-md px-3 py-2 text-white/70 hover:bg-white/5 hover:text-white"
                  href="/retencion/continuacion"
                >
                  Continuación
                </Link>
                <Link
                  className="block rounded-md px-3 py-2 text-white/70 hover:bg-white/5 hover:text-white"
                  href="/retencion/facturacion"
                >
                  Facturación
                </Link>
                <Link
                  className="block rounded-md px-3 py-2 text-white/70 hover:bg-white/5 hover:text-white"
                  href="/retencion/competencia"
                >
                  Competencia
                </Link>
                <Link
                  className="block rounded-md px-3 py-2 text-white/70 hover:bg-white/5 hover:text-white"
                  href="/retencion/personales"
                >
                  Personales
                </Link>
                <Link
                  className="block rounded-md px-3 py-2 text-white/70 hover:bg-white/5 hover:text-white"
                  href="/retencion/tecnicos"
                >
                  Técnicos
                </Link>
              </nav>
            </details>
          </div>
        </aside>

        <main className="animate-in fade-in duration-700">
          {children}
        </main>

        <aside className="hidden lg:block">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-semibold text-white">Checklist rápido</p>
            <ul className="mt-4 list-disc space-y-3 pl-5 text-sm text-white/70">
              <li>Confirmar datos del cliente.</li>
              <li>Documentar el motivo de retención.</li>
              <li>Ofrecer bonificación compatible.</li>
              <li>Registrar resultado en CRM.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
