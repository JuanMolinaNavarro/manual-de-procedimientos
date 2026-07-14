/**
 * "Mapa de abonados": KML exportado desde Google My Maps (privado) y guardado
 * en la base para renderizarlo con Leaflet dentro del panel admin.
 *
 * Se ejecuta SOLO en el servidor. Es un único mapa global (fila con id
 * "global"); cargar reemplaza el contenido anterior. Evita tener que compartir
 * el mapa de My Maps como "cualquiera con el enlace": el KML vive detrás de la
 * autenticación de /api/admin/*.
 */
import { prisma } from '@/lib/prisma';

const ID = 'global';

export async function guardarMapaKml(
  nombreArchivo: string,
  contenido: string,
  actualizadoPor?: string | null,
) {
  return prisma.mapaAbonadosKml.upsert({
    where: { id: ID },
    create: { id: ID, nombre_archivo: nombreArchivo, contenido, actualizado_por: actualizadoPor ?? null },
    update: { nombre_archivo: nombreArchivo, contenido, actualizado_por: actualizadoPor ?? null },
  });
}

export async function obtenerMapaKml() {
  return prisma.mapaAbonadosKml.findUnique({ where: { id: ID } });
}
