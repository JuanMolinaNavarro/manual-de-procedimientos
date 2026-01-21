import Bonificaciones from '@/components/Bonificaciones';

const medios = [
  {
    empresa: 'Providers (SMT, Talitas, Catamarca, Aguilares)',
    items: [
      { titulo: 'Efectivo (Presenciales)', sub: ['Rapipago'] },
      { titulo: 'Homebanking', sub: ['Pago mis cuentas', 'Banelco'] },
      { titulo: 'Tarjeta de crédito / Débito', sub: ['Mercado Pago'] },
    ],
  },
  {
    empresa: 'TCC',
    items: [
      { titulo: 'Efectivo (Presenciales)', sub: ['Rapipago', 'Pago Fácil', 'Cobro Express'] },
      { titulo: 'Homebanking', sub: ['Pago mis cuentas'] },
      { titulo: 'Tarjeta de crédito / Débito', sub: ['Macro Click'] },
    ],
  },
  {
    empresa: 'Salta',
    items: [
      { titulo: 'Efectivo (Presenciales)', sub: ['Rapipago', 'Pago Fácil', 'Cobro Express'] },
      { titulo: 'Homebanking', sub: ['Pago mis cuentas'] },
      { titulo: 'Tarjeta de crédito / Débito', sub: ['Macro Click'] },
    ],
  },
  {
    empresa: 'CCC',
    items: [
      {
        titulo: 'Efectivo (Presenciales)',
        sub: ['Oficina', 'Pago Fácil', 'Rapipago', 'Caja pop ahorros'],
      },
      { titulo: 'Tarjeta de crédito / Débito', sub: ['Macro Click', 'Mercado Pago'] },
      { titulo: 'Homebanking', sub: ['Pago Mis Cuentas', 'Banco Macro'] },
    ],
  },
];

export default function ProcedimientoBFacturacionPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold text-foreground">Dificultad con medios de pago</h1>
        <p className="text-muted-foreground">
          Consultar con cual medio de pago desea pagar y ofrecerle las alternativas de pago que se asemejen a ese medio.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Medios disponibles por empresa</h2>
        <ul className="list-disc space-y-4 pl-5 text-muted-foreground">
          {medios.map((grupo) => (
            <li key={grupo.empresa}>
              <span className="font-medium text-foreground">{grupo.empresa}</span>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                {grupo.items.map((item) => (
                  <li key={`${grupo.empresa}-${item.titulo}`}>
                    {item.titulo}
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {item.sub.map((subitem) => (
                        <li key={`${grupo.empresa}-${item.titulo}-${subitem}`}>{subitem}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-destructive dark:text-red-200">
        <p className="text-xs uppercase tracking-[0.25em] text-destructive/80 dark:text-red-200/70">
          Regla
        </p>
        <p className="mt-2 text-sm text-destructive/90 dark:text-red-100/90">
          Si el cliente insiste con la gestion de baja, ofrecer las bonificaciones de retencion segun sucursal.
        </p>
      </div>

      <Bonificaciones />
    </div>
  );
}
