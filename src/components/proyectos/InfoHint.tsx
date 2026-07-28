'use client';

import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AYUDA } from '@/lib/proyectos-datos';

/**
 * Icono "i" con la explicación en criollo de cada indicador. Reemplaza las
 * sticky notes del prototipo por un popover del sistema de diseño.
 */
export default function InfoHint({ k }: { k: keyof typeof AYUDA | string }) {
  const ayuda = AYUDA[k];
  if (!ayuda) return null;

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Qué es ${ayuda.titulo}`}
        className="ml-1 inline-flex align-middle text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none rounded-full"
      >
        <Info className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-1.5">
        <p className="text-sm font-semibold">{ayuda.titulo}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{ayuda.cuerpo}</p>
      </PopoverContent>
    </Popover>
  );
}
