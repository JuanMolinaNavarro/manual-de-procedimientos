'use client';

/**
 * Horario de asistencia de la ficha, solo lectura. Se edita únicamente en
 * Asistencia › Personas (versionado, "aplicar desde"); acá se muestra la
 * versión vigente hoy con un link para ir a editarla. La tolerancia no se muestra (solo en el
 * editor de Asistencia, como en el perfil).
 */

import { useState } from 'react';
import Link from 'next/link';
import { CalendarClock, ExternalLink } from 'lucide-react';
import { hoyLocal } from '@/lib/asistencia-datos';
import { fechaCorta } from '@/lib/fechas';
import { CICLO_LABELS, ultimaVersion, versionVigente, type HorarioVersion } from '@/lib/asistencia-calendario';
import { GrillaDiasHorario } from '@/components/asistencia/PerfilPiezas';
import type { DatosDeEmpleado } from './useDeEmpleado';

export function HorarioDelEmpleado({ estado, creating }: { estado: DatosDeEmpleado<HorarioVersion>; creating: boolean }) {
  const [hoy] = useState(() => hoyLocal());
  if (creating) return null;
  const { datos: versiones, error } = estado;
  const linkEditar = (
    <Link href="/admin/asistencia?tab=personas" className="inline-flex items-center gap-1 text-xs text-[var(--neu-fg-soft)] hover:text-foreground">
      <ExternalLink className="h-3 w-3" /> Se edita en Asistencia › Personas
    </Link>
  );

  if (error) return <p className="text-xs text-red-600 dark:text-red-400">{error}</p>;
  if (versiones == null) return <p className="text-xs text-[var(--neu-fg-soft)]">Cargando horario…</p>;

  const vigente = versionVigente(versiones, hoy);
  const ultima = ultimaVersion(versiones);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <CalendarClock className="h-4 w-4" /> Horario
        </h4>
        {linkEditar}
      </div>

      {!vigente ? (
        <p className="text-sm text-[var(--neu-fg-soft)]">
          {versiones.length === 0
            ? 'Sin horario cargado.'
            : ultima && ultima.vigenteDesde > hoy
              ? `Sin horario vigente hoy; hay uno que empieza el ${fechaCorta(ultima.vigenteDesde)}.`
              : 'Sin horario vigente hoy.'}
        </p>
      ) : !vigente.incluir ? (
        <p className="text-sm text-[var(--neu-fg-soft)]">No incluido en el control de asistencia desde el {fechaCorta(vigente.vigenteDesde)}.</p>
      ) : (
        <>
          {/* Misma grilla que Asistencia: muestra bien los turnos rotativos por semana. */}
          <GrillaDiasHorario vigente={vigente} suave="text-[var(--neu-fg-soft)]" />
          <p className="text-xs text-[var(--neu-fg-soft)]">
            {vigente.cicloSemanas > 1 && `${CICLO_LABELS[vigente.cicloSemanas]} (semana 1 desde el ${fechaCorta(vigente.cicloAncla)}) · `}
            Vigente desde el {fechaCorta(vigente.vigenteDesde)}
            {vigente.vigenteHasta ? ` hasta el ${fechaCorta(vigente.vigenteHasta)}` : ''}
            {versiones.length > 1 ? ` · ${versiones.length} versiones` : ''}
          </p>
        </>
      )}
    </div>
  );
}
