/**
 * Helpers puros de la foto/avatar de una ficha. Viven aparte de EmpleadoNode
 * para que otros módulos (nómina) los usen sin arrastrar @xyflow/react.
 */

export function fotoUrl(emp: { id: number; foto_archivo: string | null }): string | null {
  return emp.foto_archivo
    ? `/api/admin/organigrama/empleados/${emp.id}/foto?n=${encodeURIComponent(emp.foto_archivo)}`
    : null;
}

export function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
