'use client';

import { ChevronDown, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PageTitle } from '@/components/comunes/ui';
import { cn } from '@/lib/utils';
import { fmtRelativo } from '@/lib/asistencia-datos';
import { AsistenciaProvider, useAsistencia, type EmpleadoOpt, type TabAsistencia } from './AsistenciaContext';
import DiaTab from './DiaTab';
import MesTab from './MesTab';
import CalendarioTab from './CalendarioTab';
import FichadasTab from './FichadasTab';
import PersonasTab from './PersonasTab';
import RelojesTab from './RelojesTab';

export type { EmpleadoOpt };

/** Lo que revisa RR.HH. todos los días, al frente. */
const VISTAS: { tab: TabAsistencia; label: string }[] = [
  { tab: 'dia', label: 'Día' },
  { tab: 'mes', label: 'Mes' },
];

/** Herramientas de mantenimiento: quedan a mano pero fuera del camino. */
const HERRAMIENTAS: { tab: TabAsistencia; label: string; desc: string }[] = [
  { tab: 'calendario', label: 'Calendario', desc: 'Todo el mes en una grilla' },
  { tab: 'fichadas', label: 'Fichadas', desc: 'Las marcas tal como llegan del reloj' },
  { tab: 'personas', label: 'Personas', desc: 'Legajos, fichas y horarios' },
  { tab: 'relojes', label: 'Relojes', desc: 'Conexión y sincronización' },
];

const CONTENIDO: Record<TabAsistencia, React.ReactNode> = {
  dia: <DiaTab />,
  mes: <MesTab />,
  calendario: <CalendarioTab />,
  fichadas: <FichadasTab />,
  personas: <PersonasTab />,
  relojes: <RelojesTab />,
};

export default function AsistenciaPage({ empleados }: { empleados: EmpleadoOpt[] }) {
  return (
    <AsistenciaProvider empleados={empleados}>
      <Contenido />
    </AsistenciaProvider>
  );
}

function Contenido() {
  const { f, set } = useAsistencia();
  const herramienta = HERRAMIENTAS.find((h) => h.tab === f.tab);

  return (
    // Mismo ancho contenido que proyectos y señales IP: en un monitor grande, a
    // pantalla completa las tablas quedaban desparramadas.
    <div className="mx-auto w-full max-w-6xl">
      <PageTitle title="Asistencia" sub={<UltimoSync />} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <nav aria-label="Vista" className="grid flex-1 grid-cols-2 gap-1 rounded-[10px] bg-muted p-1 sm:max-w-xs">
          {VISTAS.map((v) => (
            <button
              key={v.tab}
              type="button"
              aria-current={f.tab === v.tab ? 'page' : undefined}
              // De Día a Mes se abre el mes del día que se estaba mirando.
              onClick={() => set(v.tab === 'mes' && f.tab === 'dia' ? { tab: 'mes', mes: f.fecha.slice(0, 7) } : { tab: v.tab })}
              className={cn(
                'h-11 rounded-lg text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                f.tab === v.tab ? 'bg-card font-semibold text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {v.label}
            </button>
          ))}
        </nav>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={herramienta ? 'secondary' : 'outline'} className="h-11 text-base">
              <Wrench className="size-4" />
              {herramienta ? herramienta.label : 'Más'}
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Herramientas</DropdownMenuLabel>
            {HERRAMIENTAS.map((h) => (
              <DropdownMenuItem key={h.tab} onSelect={() => set({ tab: h.tab })} className="flex-col items-start gap-0 py-2">
                <span className="text-base font-medium">{h.label}</span>
                <span className="text-sm text-muted-foreground">{h.desc}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {CONTENIDO[f.tab]}
    </div>
  );
}

/** El cron corre en el server y la pantalla nunca lo mostraba: acá se ve. */
function UltimoSync() {
  const { relojes, set } = useAsistencia();
  if (!relojes?.length) return null;

  const conError = relojes.filter((r) => r.activo && r.ultimo_error).length;
  const syncs = relojes.map((r) => r.ultimo_sync).filter((s): s is string => !!s);
  const ultimo = syncs.length ? syncs.reduce((a, b) => (a > b ? a : b)) : null;

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>Las marcas llegan solas de los relojes. Actualizado {ultimo ? fmtRelativo(ultimo) : 'nunca'}.</span>
      {conError > 0 && (
        <button type="button" onClick={() => set({ tab: 'relojes' })}>
          <Badge variant="outline" className="border-red-500 text-red-600 dark:text-red-400">
            {conError} reloj{conError > 1 ? 'es' : ''} con error
          </Badge>
        </button>
      )}
    </span>
  );
}
