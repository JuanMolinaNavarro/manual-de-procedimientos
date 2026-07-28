/**
 * Datos de dominio del módulo Proyectos y finanzas.
 *
 * Constantes puras (sin Prisma ni React) que usan tanto el servidor como el
 * cliente: estados, plantillas de cronograma y los textos de ayuda de la UI.
 */

// ─── Estados ─────────────────────────────────────────────────────────────────

export type EstadoProyecto =
  | 'planificado'
  | 'en_curso'
  | 'pausado'
  | 'terminado'
  | 'cancelado';

export const ESTADOS_PROYECTO: { id: EstadoProyecto; label: string; clase: string }[] = [
  { id: 'planificado', label: 'Planificado', clase: 'bg-muted text-muted-foreground' },
  { id: 'en_curso', label: 'En curso', clase: 'bg-sky-500/15 text-sky-700 dark:text-sky-400' },
  { id: 'pausado', label: 'Pausado', clase: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  {
    id: 'terminado',
    label: 'Terminado',
    clase: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  },
  { id: 'cancelado', label: 'Cancelado', clase: 'bg-red-500/15 text-red-700 dark:text-red-400' },
];

export function estadoProyecto(id: string) {
  return ESTADOS_PROYECTO.find((e) => e.id === id) ?? ESTADOS_PROYECTO[0];
}

export type EstadoEtapa = 'pendiente' | 'curso' | 'hecho' | 'atrasado';

export const ESTADOS_ETAPA: {
  id: EstadoEtapa;
  label: string;
  punto: string;
  barra: string;
}[] = [
  { id: 'pendiente', label: 'Pendiente', punto: 'bg-muted-foreground', barra: 'bg-muted-foreground' },
  { id: 'curso', label: 'En curso', punto: 'bg-sky-500', barra: 'bg-sky-500' },
  { id: 'hecho', label: 'Hecho', punto: 'bg-emerald-500', barra: 'bg-emerald-500' },
  { id: 'atrasado', label: 'Atrasado', punto: 'bg-red-500', barra: 'bg-red-500' },
];

export function estadoEtapa(id: string) {
  return ESTADOS_ETAPA.find((e) => e.id === id) ?? ESTADOS_ETAPA[0];
}

export const MONEDAS = ['USD', 'ARS'] as const;
export type Moneda = (typeof MONEDAS)[number];

export const MESES_CORTOS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
] as const;

// ─── Plantillas de cronograma ────────────────────────────────────────────────
// Solo el andamiaje inicial: nombres y duraciones se editan después. Las etapas
// se crean encadenadas (cada una depende de la anterior).

export interface EtapaPlantilla {
  nombre: string;
  dias: number;
}

export interface PlantillaCronograma {
  id: string;
  nombre: string;
  descripcion: string;
  etapas: EtapaPlantilla[];
}

export const PLANTILLAS_CRONOGRAMA: PlantillaCronograma[] = [
  {
    id: 'estandar',
    nombre: 'Proyecto estándar',
    descripcion: 'Cinco etapas encadenadas: relevamiento, diseño, ejecución, control y cierre.',
    etapas: [
      { nombre: 'Relevamiento y planificación', dias: 15 },
      { nombre: 'Diseño / definición', dias: 20 },
      { nombre: 'Ejecución', dias: 60 },
      { nombre: 'Pruebas y control', dias: 15 },
      { nombre: 'Cierre y entrega', dias: 10 },
    ],
  },
  {
    id: 'implementacion',
    nombre: 'Implementación / rollout',
    descripcion: 'Para puestas en marcha: piloto, despliegue por tandas y estabilización.',
    etapas: [
      { nombre: 'Análisis y alcance', dias: 10 },
      { nombre: 'Preparación e insumos', dias: 20 },
      { nombre: 'Piloto', dias: 20 },
      { nombre: 'Despliegue', dias: 45 },
      { nombre: 'Estabilización y soporte', dias: 30 },
    ],
  },
  {
    id: 'vacio',
    nombre: 'En blanco',
    descripcion: 'Sin etapas: armás el cronograma desde cero.',
    etapas: [],
  },
];

export function getPlantilla(id: string): PlantillaCronograma {
  return PLANTILLAS_CRONOGRAMA.find((p) => p.id === id) ?? PLANTILLAS_CRONOGRAMA[0];
}

/** Categorías sugeridas para las líneas de costo (el campo es libre). */
export const CATEGORIAS_SUGERIDAS = [
  'Mano de obra',
  'Materiales',
  'Servicios y contratistas',
  'Equipamiento',
  'Licencias y software',
  'Logística',
  'Gastos generales',
  'General',
];

// ─── Textos de ayuda (iconos "i" de la UI) ───────────────────────────────────

export const AYUDA: Record<string, { titulo: string; cuerpo: string }> = {
  costo_total: {
    titulo: 'Costo total',
    cuerpo:
      'La suma de todas las líneas de costo. Lo que cargues en ARS se pasa a USD con el tipo de cambio configurado.',
  },
  costo_const: {
    titulo: 'USD constantes',
    cuerpo:
      'El mismo monto descontando la inflación del dólar, para medir un dólar de hoy y uno de dentro de tres años con la misma vara.',
  },
  ingreso: {
    titulo: 'Ingreso proyectado',
    cuerpo:
      'Lo que esperás que el proyecto genere: facturación, ahorro de costos o cualquier retorno cuantificable. Es un supuesto tuyo, no se calcula solo.',
  },
  anio_ingreso: {
    titulo: 'Año del ingreso',
    cuerpo:
      'Cuándo se cobra. Sirve para llevar el ingreso a USD constantes del año base y poder compararlo con el costo de hoy.',
  },
  margen: {
    titulo: 'Margen',
    cuerpo: 'Ingreso menos costo: la ganancia esperada del proyecto, en USD constantes.',
  },
  roi: {
    titulo: 'ROI',
    cuerpo: 'Retorno sobre la inversión. 30% = recuperás lo invertido y te queda un 30% extra.',
  },
  breakeven: {
    titulo: 'Ingreso de equilibrio',
    cuerpo:
      'El ingreso mínimo para no perder plata. Si el proyecto genera menos que esto, da pérdida.',
  },
  seguridad: {
    titulo: 'Margen de seguridad',
    cuerpo:
      'Cuánto puede caer el ingreso antes de entrar en pérdida. Más alto = más colchón si el proyecto rinde menos de lo previsto.',
  },
  avance: {
    titulo: 'Avance del proyecto',
    cuerpo:
      'Promedio del avance de cada etapa, ponderado por su duración: una etapa de 60 días pesa más que una de 10.',
  },
  ventana: {
    titulo: 'Ventana del proyecto',
    cuerpo: 'Desde el inicio hasta que termina la última etapa del cronograma.',
  },
  costos_tabla: {
    titulo: 'Costos editables',
    cuerpo:
      'Tocá cualquier celda para cambiarla. El total de cada línea es cantidad × costo unitario, convertido a USD.',
  },
  etapa_costo: {
    titulo: 'Costo por etapa',
    cuerpo:
      'Imputá cada línea a una etapa del cronograma para ver en qué parte del proyecto se va la plata. Es opcional.',
  },
  cascada: {
    titulo: 'Corrimiento en cascada',
    cuerpo:
      'Cada etapa depende de la anterior. Si movés una, las que dependen de ella se corren los mismos días para no pisarse.',
  },
  inicio: {
    titulo: 'Fecha de inicio',
    cuerpo: 'Cambiarla corre el cronograma completo por la misma cantidad de días.',
  },
};
