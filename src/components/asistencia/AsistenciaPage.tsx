'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { PageTitle } from '@/components/comunes/ui';
import { fmtRelativo } from '@/lib/asistencia-datos';
import { AsistenciaProvider, useAsistencia, type EmpleadoOpt, type TabAsistencia } from './AsistenciaContext';
import ResumenTab from './ResumenTab';
import CalendarioTab from './CalendarioTab';
import FichadasTab from './FichadasTab';
import PersonasTab from './PersonasTab';
import RelojesTab from './RelojesTab';

export type { EmpleadoOpt };

export default function AsistenciaPage({ empleados }: { empleados: EmpleadoOpt[] }) {
  return (
    <AsistenciaProvider empleados={empleados}>
      <Contenido />
    </AsistenciaProvider>
  );
}

function Contenido() {
  const { f, set } = useAsistencia();

  return (
    // Mismo ancho contenido que proyectos y señales IP: en un monitor grande, a
    // pantalla completa las tablas quedaban desparramadas.
    <div className="mx-auto w-full max-w-6xl">
      <PageTitle
        title="Asistencia"
        sub="Fichadas de los relojes biométricos Anviz. Se sincronizan solas cada 10 minutos."
        right={<UltimoSync />}
      />

      <Tabs value={f.tab} onValueChange={(v) => set({ tab: v as TabAsistencia })} className="gap-6">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto border-b">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="calendario">Calendario</TabsTrigger>
          <TabsTrigger value="fichadas">Fichadas</TabsTrigger>
          <TabsTrigger value="personas">Personas</TabsTrigger>
          <TabsTrigger value="relojes">Relojes</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <ResumenTab />
        </TabsContent>
        <TabsContent value="calendario">
          <CalendarioTab />
        </TabsContent>
        <TabsContent value="fichadas">
          <FichadasTab />
        </TabsContent>
        <TabsContent value="personas">
          <PersonasTab />
        </TabsContent>
        <TabsContent value="relojes">
          <RelojesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** El cron corre en el server y la pantalla nunca lo mostraba: acá se ve. */
function UltimoSync() {
  const { relojes } = useAsistencia();
  if (!relojes?.length) return null;

  const conError = relojes.filter((r) => r.activo && r.ultimo_error).length;
  const syncs = relojes.map((r) => r.ultimo_sync).filter((s): s is string => !!s);
  const ultimo = syncs.length ? syncs.reduce((a, b) => (a > b ? a : b)) : null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {conError > 0 && (
        <Badge variant="outline" className="border-red-500 text-red-600 dark:text-red-400">
          {conError} reloj{conError > 1 ? 'es' : ''} con error
        </Badge>
      )}
      <span>Último sync: {ultimo ? fmtRelativo(ultimo) : 'nunca'}</span>
    </div>
  );
}
