'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FichadasTab from './FichadasTab';
import PersonasTab from './PersonasTab';
import RelojesTab from './RelojesTab';

export interface EmpleadoOpt {
  id: number;
  nombre: string;
  rol: string;
  area: string;
}

export default function AsistenciaPage({ empleados }: { empleados: EmpleadoOpt[] }) {
  const [tab, setTab] = useState('fichadas');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Asistencia</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fichadas de los relojes biométricos Anviz. Se sincronizan solas cada 10 minutos; también podés bajarlas a mano.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto border-b">
          <TabsTrigger value="fichadas">Fichadas</TabsTrigger>
          <TabsTrigger value="personas">Personas</TabsTrigger>
          <TabsTrigger value="relojes">Relojes</TabsTrigger>
        </TabsList>

        <TabsContent value="fichadas">
          <FichadasTab />
        </TabsContent>
        <TabsContent value="personas">
          <PersonasTab empleados={empleados} />
        </TabsContent>
        <TabsContent value="relojes">
          <RelojesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
