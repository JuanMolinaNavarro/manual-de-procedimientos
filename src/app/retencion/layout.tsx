import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

export default function RetencionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative isolate">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_80%_at_50%_0%,rgba(255,255,255,0.08),rgba(15,16,17,0))]" />

        <header className="border-b border-border bg-card/70">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold tracking-wide">
                Manual de Procedimientos - Callcenter
              </span>
              <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
                Atención y Retención
              </span>
            </div>
            <div className="hidden items-center gap-4 text-sm text-muted-foreground md:flex">
              <Link className="hover:text-foreground" href="/retencion/inicio">
                Retención
              </Link>
              <Link className="hover:text-foreground" href="/admin/login">
                Panel admin
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </header>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 md:grid-cols-[240px_1fr] lg:grid-cols-[240px_1fr_220px]">
        <aside className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-3">
            <input
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              placeholder="Buscar procedimientos..."
              type="search"
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <details open>
              <summary className="cursor-pointer text-sm font-semibold text-foreground">
                Retención
              </summary>
              <nav className="mt-3 space-y-1 text-sm">
                <Link
                  className="block rounded-md px-3 py-2 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  href="/retencion/inicio"
                >
                  Inicio
                </Link>
                <Link
                  className="block rounded-md px-3 py-2 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  href="/retencion/continuacion"
                >
                  Continuación
                </Link>
                <details className="rounded-md px-2">
                  <summary className="cursor-pointer rounded-md px-1 py-2 text-sm font-semibold text-foreground/80">
                    Motivos
                  </summary>
                  <div className="mt-2 space-y-1 pl-2">
                    <Link
                      className="block rounded-md px-3 py-2 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      href="/retencion/facturacion"
                    >
                      Facturación
                    </Link>
                    <Link
                      className="block rounded-md px-3 py-2 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      href="/retencion/competencia"
                    >
                      Competencia
                    </Link>
                    <Link
                      className="block rounded-md px-3 py-2 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      href="/retencion/personales"
                    >
                      Personales
                    </Link>
                    <Link
                      className="block rounded-md px-3 py-2 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      href="/retencion/tecnicos"
                    >
                      Técnicos
                    </Link>
                  </div>
                </details>
              </nav>
            </details>
          </div>
        </aside>

        <main className="animate-in fade-in duration-700">
          {children}
        </main>

        <aside className="hidden lg:block">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">Checklist rápido</p>
            <ul className="mt-4 list-disc space-y-3 pl-5 text-sm text-muted-foreground">
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
