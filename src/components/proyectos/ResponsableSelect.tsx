'use client';

import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

/** Lo mínimo que necesita el selector; evita arrastrar todo el OrgEmpleado. */
export interface EmpleadoOpcion {
  id: number;
  nombre: string;
  rol: string;
}

/** Radix no acepta "" como value de un item, así que van centinelas. */
const SIN_ASIGNAR = 'sin-asignar';
const TEXTO_LIBRE = 'texto-libre';

export interface ValorResponsable {
  responsable_id: number | null;
  responsable: string | null;
}

interface Props {
  responsableId: number | null;
  responsableTexto: string | null;
  empleados: EmpleadoOpcion[];
  disabled?: boolean;
  /** Se dispara al elegir del organigrama o al salir del campo de texto libre. */
  onChange: (v: ValorResponsable) => void;
  id?: string;
  className?: string;
}

/**
 * Elige el responsable de un proyecto o etapa. Preferentemente una persona del
 * organigrama (queda vinculada y su nombre se muestra siempre actualizado); si
 * no está ahí, se puede escribir el nombre a mano.
 */
export default function ResponsableSelect({
  responsableId,
  responsableTexto,
  empleados,
  disabled,
  onChange,
  id,
  className,
}: Props) {
  const modo =
    responsableId != null ? String(responsableId) : responsableTexto ? TEXTO_LIBRE : SIN_ASIGNAR;

  const elegir = (v: string) => {
    if (v === SIN_ASIGNAR) onChange({ responsable_id: null, responsable: null });
    else if (v === TEXTO_LIBRE) onChange({ responsable_id: null, responsable: responsableTexto ?? '' });
    else onChange({ responsable_id: Number(v), responsable: null });
  };

  return (
    <div className={className}>
      <Select value={modo} onValueChange={elegir} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SIN_ASIGNAR}>Sin asignar</SelectItem>
          {empleados.map((e) => (
            <SelectItem key={e.id} value={String(e.id)}>
              {e.nombre}
              {e.rol ? ` — ${e.rol}` : ''}
            </SelectItem>
          ))}
          <SelectItem value={TEXTO_LIBRE}>Otro (fuera del organigrama)</SelectItem>
        </SelectContent>
      </Select>

      {modo === TEXTO_LIBRE && (
        <Input
          className="mt-2"
          defaultValue={responsableTexto ?? ''}
          disabled={disabled}
          placeholder="Nombre del responsable"
          aria-label="Nombre del responsable (texto libre)"
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (responsableTexto ?? '')) {
              onChange({ responsable_id: null, responsable: v || null });
            }
          }}
        />
      )}

      {empleados.length === 0 && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          El organigrama no tiene personas cargadas todavía; por ahora solo podés escribir el
          nombre a mano.
        </p>
      )}
    </div>
  );
}
