import { prisma } from './prisma';
import {
  createArea,
  createEmpleado,
  updateEmpleado,
  type CreateOrgAreaData,
  type CreateOrgEmpleadoData,
} from './organigrama';

/**
 * Datos de ejemplo portados del HTML original (`defaultEmployees` / `DEFAULT_AREA_CONFIG`).
 * Las fotos del HTML eran URLs externas (pravatar): se omiten — los empleados muestran sus
 * iniciales hasta que se suba una foto real.
 */

export const SEED_AREAS: CreateOrgAreaData[] = [
  { nombre: 'Dirección', color: '#007AFF', is_top: true },
  { nombre: 'RRHH', color: '#5856D6' },
  { nombre: 'Tecnología', color: '#34C759' },
  { nombre: 'Ventas', color: '#FF9500' },
];

type SeedEmpleado = CreateOrgEmpleadoData & { _id: number; _manager: number | null };

export const SEED_EMPLEADOS: SeedEmpleado[] = [
  {
    _id: 1, _manager: null,
    nombre: 'Carlos González', rol: 'Director General', area: 'Dirección',
    email: 'carlos@empresa.com', telefono: '1001', movil: '+54 381 123-4567', estado: 'active',
    sede: 'Sede Central', horario: 'Lun - Vie, 08:00 - 17:00', modalidad: 'Presencial', guardias: 'No', actualizado: '24/05/2024',
    summary: 'Director General con amplia trayectoria en liderazgo estratégico y gestión de organizaciones. Orientado a resultados y a la mejora continua.',
    antiguedad: '9 años', formacion: 'MBA', seniority: 'Senior', especialidad: 'Estrategia y Dirección',
    experiencia: [
      { role: 'Gerente General', company: 'Grupo Andino', period: '2010 - 2015 (5 años)' },
      { role: 'Jefe de Operaciones', company: 'LogiSur', period: '2006 - 2010 (4 años)' },
    ],
    resp_primarias: ['Definición de la estrategia corporativa', 'Liderazgo del comité ejecutivo', 'Relación con accionistas'],
    resp_secundarias: ['Representación institucional', 'Aprobación de presupuestos'],
    inputs: ['Reportes de áreas', 'Indicadores financieros', 'Análisis de mercado'],
    outputs: ['Decisiones estratégicas', 'Objetivos anuales', 'Lineamientos'],
    hard_skills: [
      { name: 'Finanzas', level: 85, label: 'Avanzado' },
      { name: 'Planificación', level: 90, label: 'Avanzado' },
      { name: 'Excel', level: 75, label: 'Intermedio' },
    ],
    soft_skills: [{ name: 'Liderazgo', rating: 5 }, { name: 'Comunicación', rating: 5 }, { name: 'Negociación', rating: 4 }],
    skills: ['Liderazgo', 'Estrategia', 'Gestión'], projects: ['Expansión 2024', 'Reestructuración'],
  },
  {
    _id: 2, _manager: 1,
    nombre: 'Marina Fernández', rol: 'Recursos Humanos', area: 'RRHH',
    email: 'marina@empresa.com', telefono: '1010', movil: '+54 381 234-5678', estado: 'active',
    sede: 'Sede Central', horario: 'Lun - Vie, 08:00 - 17:00', modalidad: 'Híbrido', guardias: 'No', actualizado: '24/05/2024',
    summary: 'Profesional de RRHH especializada en gestión del talento, selección y desarrollo organizacional.',
    antiguedad: '6 años', formacion: 'Lic. en RRHH', seniority: 'Senior', especialidad: 'Gestión del Talento',
    experiencia: [{ role: 'Analista de RRHH', company: 'TalentPro', period: '2015 - 2018 (3 años)' }],
    resp_primarias: ['Selección y reclutamiento', 'Gestión del clima laboral', 'Planes de capacitación'],
    resp_secundarias: ['Administración de beneficios', 'Onboarding de nuevos ingresos'],
    inputs: ['Solicitudes de las áreas', 'CVs de candidatos', 'Encuestas de clima'],
    outputs: ['Contrataciones', 'Reportes de clima', 'Planes de desarrollo'],
    hard_skills: [
      { name: 'Selección', level: 85, label: 'Avanzado' },
      { name: 'SAP HR', level: 60, label: 'Intermedio' },
      { name: 'Excel', level: 70, label: 'Intermedio' },
    ],
    soft_skills: [{ name: 'Empatía', rating: 5 }, { name: 'Comunicación', rating: 5 }, { name: 'Organización', rating: 4 }],
    skills: ['Selección', 'Capacitación', 'Clima laboral'], projects: ['Plan de talento 2024', 'Onboarding'],
  },
  {
    _id: 3, _manager: 1,
    nombre: 'Facundo Olarte', rol: 'Desarrollo e Ingeniería', area: 'Tecnología',
    email: 'facundo@empresa.com', telefono: '1048', movil: '+54 381 345-6789', estado: 'active',
    sede: 'Sede Central', horario: 'Lun - Vie, 08:00 - 17:00', modalidad: 'Híbrido', guardias: 'Disponible', actualizado: '24/05/2024',
    summary: 'Profesional en Ingeniería en Sistemas con más de 4 años de experiencia en desarrollo de soluciones internas, automatización de procesos y análisis de datos. Orientado a resultados, proactivo y apasionado por la mejora continua.',
    antiguedad: '4 años', formacion: 'Ing. en Sistemas', seniority: 'Semi Senior', especialidad: 'Automatización y Análisis',
    experiencia: [
      { role: 'Desarrollador de Software', company: 'TecnoSoluciones S.A.', period: '2021 - 2023 (2 años)' },
      { role: 'Analista de Sistemas', company: 'NetGlobal Servicios', period: '2019 - 2021 (2 años)' },
      { role: 'Soporte Técnico', company: 'Conecta SRL', period: '2018 - 2019 (1 año)', gray: true },
    ],
    resp_primarias: ['Desarrollo de métricas operativas y dashboards', 'Integración entre sistemas internos (APIs y CRMs)', 'Automatización de procesos con herramientas low-code', 'Gestión técnica de proveedores de software'],
    resp_secundarias: ['Capacitación a usuarios internos', 'Soporte en incidencias críticas', 'Documentación y mejora de procesos (SOPs)'],
    inputs: ['Datos de ISPBoss', 'Requerimientos de gerencia', 'Incidentes técnicos', 'APIs internas', 'Bases de datos operativas'],
    outputs: ['Dashboards operativos', 'Automatizaciones', 'Informes y reportes', 'KPIs', 'Documentación (SOPs)'],
    hard_skills: [
      { name: 'Excel', level: 80, label: 'Avanzado' },
      { name: 'SQL', level: 55, label: 'Intermedio' },
      { name: 'Redes', level: 80, label: 'Avanzado' },
      { name: 'Power BI', level: 55, label: 'Intermedio' },
      { name: 'Notion', level: 80, label: 'Avanzado' },
      { name: 'n8n / Automatización', level: 35, label: 'Básico' },
    ],
    soft_skills: [
      { name: 'Comunicación', rating: 4 }, { name: 'Liderazgo', rating: 4 }, { name: 'Resolución de Problemas', rating: 5 },
      { name: 'Adaptabilidad', rating: 5 }, { name: 'Pensamiento Analítico', rating: 4 }, { name: 'Trabajo en Equipo', rating: 4 },
    ],
    skills: ['Arquitectura', 'Cloud', 'DevOps'], projects: ['Transformación digital', 'API v2'],
  },
  {
    _id: 4, _manager: 1,
    nombre: 'Sofia López', rol: 'Comercial', area: 'Ventas',
    email: 'sofia@empresa.com', telefono: '1055', movil: '+54 381 456-7890', estado: 'active',
    sede: 'Sede Buenos Aires', horario: 'Lun - Vie, 09:00 - 18:00', modalidad: 'Presencial', guardias: 'No', actualizado: '24/05/2024',
    summary: 'Líder comercial con foco en el desarrollo de nuevos mercados y la gestión estratégica de cuentas clave.',
    antiguedad: '7 años', formacion: 'Lic. en Comercialización', seniority: 'Senior', especialidad: 'Estrategia Comercial',
    experiencia: [{ role: 'Ejecutiva de Cuentas', company: 'VentaPlus', period: '2014 - 2017 (3 años)' }],
    resp_primarias: ['Definición de estrategia comercial', 'Gestión del equipo de ventas', 'Apertura de nuevos mercados'],
    resp_secundarias: ['Negociación de contratos clave', 'Análisis de la competencia'],
    inputs: ['Objetivos de dirección', 'Leads de marketing', 'Reportes de ventas'],
    outputs: ['Forecast de ventas', 'Cierre de cuentas', 'Reportes comerciales'],
    hard_skills: [
      { name: 'CRM / Salesforce', level: 85, label: 'Avanzado' },
      { name: 'Excel', level: 75, label: 'Intermedio' },
      { name: 'Forecasting', level: 80, label: 'Avanzado' },
    ],
    soft_skills: [{ name: 'Negociación', rating: 5 }, { name: 'Liderazgo', rating: 4 }, { name: 'Comunicación', rating: 5 }],
    skills: ['Negociación', 'CRM', 'Estrategia comercial'], projects: ['Nuevos mercados', 'B2B Strategy'],
  },
  {
    _id: 5, _manager: 2,
    nombre: 'Ana Fernández', rol: 'Liquidación de sueldos', area: 'RRHH',
    email: 'ana@empresa.com', telefono: '1011', movil: '+54 381 567-8901', estado: 'active',
    sede: 'Sede Central', horario: 'Lun - Vie, 08:00 - 16:00', modalidad: 'Presencial', guardias: 'No', actualizado: '24/05/2024',
    summary: 'Especialista en liquidación de haberes y administración de personal.',
    antiguedad: '4 años', formacion: 'Téc. en Administración', seniority: 'Semi Senior', especialidad: 'Nómina y Liquidación',
    experiencia: [{ role: 'Asistente Contable', company: 'Contadores Asociados', period: '2018 - 2020 (2 años)' }],
    resp_primarias: ['Liquidación mensual de sueldos', 'Control de ausentismo y licencias', 'Gestión de cargas sociales'],
    resp_secundarias: ['Atención a consultas del personal', 'Emisión de recibos'],
    inputs: ['Partes de asistencia', 'Novedades del mes', 'Convenios colectivos'],
    outputs: ['Recibos de sueldo', 'Reportes a organismos', 'Liquidaciones finales'],
    hard_skills: [
      { name: 'SAP', level: 70, label: 'Intermedio' },
      { name: 'Excel', level: 85, label: 'Avanzado' },
      { name: 'Tango', level: 75, label: 'Intermedio' },
    ],
    soft_skills: [{ name: 'Precisión', rating: 5 }, { name: 'Organización', rating: 5 }, { name: 'Confidencialidad', rating: 5 }],
    skills: ['Contabilidad', 'Nómina', 'SAP'], projects: ['Sistema de nómina'],
  },
  {
    _id: 6, _manager: 2,
    nombre: 'Luis García', rol: 'Reclutamiento', area: 'RRHH',
    email: 'luis@empresa.com', telefono: '1012', movil: '+54 381 678-9012', estado: 'active',
    sede: 'Sede Central', horario: 'Lun - Vie, 09:00 - 18:00', modalidad: 'Remoto', guardias: 'No', actualizado: '24/05/2024',
    summary: 'Reclutador especializado en perfiles técnicos.',
    antiguedad: '2 años', formacion: 'Lic. en Psicología', seniority: 'Junior', especialidad: 'Adquisición de Talento',
    experiencia: [{ role: 'Sourcer', company: 'TechHunt', period: '2021 - 2022 (1 año)' }],
    resp_primarias: ['Búsqueda y filtrado de candidatos', 'Entrevistas iniciales', 'Gestión del ATS'],
    resp_secundarias: ['Employer branding', 'Ferias de empleo'],
    inputs: ['Perfiles solicitados', 'CVs', 'Bases de datos de talento'],
    outputs: ['Shortlist de candidatos', 'Reportes de búsqueda'],
    hard_skills: [
      { name: 'LinkedIn Recruiter', level: 85, label: 'Avanzado' },
      { name: 'ATS', level: 70, label: 'Intermedio' },
    ],
    soft_skills: [{ name: 'Comunicación', rating: 5 }, { name: 'Empatía', rating: 4 }, { name: 'Proactividad', rating: 4 }],
    skills: ['Entrevistas', 'LinkedIn', 'ATS'], projects: ['Expansión equipo IT'],
  },
  {
    _id: 7, _manager: 3,
    nombre: 'Pablo Sánchez', rol: 'Backend Senior', area: 'Tecnología',
    email: 'pablo@empresa.com', telefono: '1049', movil: '+54 381 789-0123', estado: 'active',
    sede: 'Sede Central', horario: 'Lun - Vie, 09:00 - 18:00', modalidad: 'Remoto', guardias: 'Disponible', actualizado: '24/05/2024',
    summary: 'Desarrollador backend senior con foco en arquitecturas escalables y microservicios.',
    antiguedad: '4 años', formacion: 'Ing. en Informática', seniority: 'Senior', especialidad: 'Backend / Cloud',
    experiencia: [{ role: 'Desarrollador Backend', company: 'CloudWorks', period: '2017 - 2020 (3 años)' }],
    resp_primarias: ['Diseño de APIs', 'Mantenimiento de microservicios', 'Optimización de bases de datos'],
    resp_secundarias: ['Code reviews', 'Mentoring de juniors'],
    inputs: ['Requerimientos funcionales', 'Tickets de bugs', 'Métricas de performance'],
    outputs: ['APIs documentadas', 'Servicios desplegados', 'Mejoras de performance'],
    hard_skills: [
      { name: 'Python', level: 90, label: 'Avanzado' },
      { name: 'AWS', level: 80, label: 'Avanzado' },
      { name: 'PostgreSQL', level: 85, label: 'Avanzado' },
      { name: 'Docker', level: 75, label: 'Intermedio' },
    ],
    soft_skills: [{ name: 'Resolución de Problemas', rating: 5 }, { name: 'Trabajo en Equipo', rating: 4 }, { name: 'Autonomía', rating: 5 }],
    skills: ['Python', 'AWS', 'PostgreSQL', 'Docker'], projects: ['Backend v2', 'Microservicios'],
  },
  {
    _id: 8, _manager: 3,
    nombre: 'Rosa Domínguez', rol: 'Frontend Developer', area: 'Tecnología',
    email: 'rosa@empresa.com', telefono: '1050', movil: '+54 381 890-1234', estado: 'active',
    sede: 'Sede Central', horario: 'Lun - Vie, 09:00 - 18:00', modalidad: 'Híbrido', guardias: 'No', actualizado: '24/05/2024',
    summary: 'Desarrolladora frontend especializada en interfaces modernas y experiencia de usuario.',
    antiguedad: '3 años', formacion: 'Téc. en Desarrollo Web', seniority: 'Semi Senior', especialidad: 'Frontend / UX',
    experiencia: [{ role: 'Frontend Jr', company: 'WebStudio', period: '2019 - 2021 (2 años)' }],
    resp_primarias: ['Desarrollo de interfaces', 'Implementación del design system', 'Optimización de UX'],
    resp_secundarias: ['Tests de usabilidad', 'Documentación de componentes'],
    inputs: ['Diseños de Figma', 'Requerimientos de UX', 'Feedback de usuarios'],
    outputs: ['Componentes UI', 'Páginas implementadas', 'Design system'],
    hard_skills: [
      { name: 'React', level: 90, label: 'Avanzado' },
      { name: 'TypeScript', level: 80, label: 'Avanzado' },
      { name: 'Tailwind', level: 85, label: 'Avanzado' },
    ],
    soft_skills: [{ name: 'Creatividad', rating: 5 }, { name: 'Atención al Detalle', rating: 5 }, { name: 'Comunicación', rating: 4 }],
    skills: ['React', 'TypeScript', 'Tailwind'], projects: ['UI moderna', 'Design System'],
  },
  {
    _id: 9, _manager: 3,
    nombre: 'Marcos Silva', rol: 'Soporte Técnico', area: 'Tecnología',
    email: 'soporte@empresa.com', telefono: '1051', movil: '+54 381 901-2345', estado: 'inactive',
    sede: 'Sede Central', horario: 'Lun - Vie, 08:00 - 16:00', modalidad: 'Presencial', guardias: 'Rotativas', actualizado: '24/05/2024',
    summary: 'Soporte técnico nivel 2. Actualmente en licencia.',
    antiguedad: '5 años', formacion: 'Téc. en Redes', seniority: 'Semi Senior', especialidad: 'Help Desk / Redes',
    experiencia: [{ role: 'Soporte N1', company: 'ITService', period: '2016 - 2019 (3 años)' }],
    resp_primarias: ['Atención de incidencias', 'Mantenimiento de equipos', 'Gestión de tickets'],
    resp_secundarias: ['Inventario de hardware', 'Configuración de redes'],
    inputs: ['Tickets de usuarios', 'Alertas de monitoreo'],
    outputs: ['Incidencias resueltas', 'Reportes de soporte'],
    hard_skills: [
      { name: 'Windows', level: 80, label: 'Avanzado' },
      { name: 'Redes', level: 75, label: 'Intermedio' },
      { name: 'Help Desk', level: 85, label: 'Avanzado' },
    ],
    soft_skills: [{ name: 'Paciencia', rating: 5 }, { name: 'Comunicación', rating: 4 }, { name: 'Resolución de Problemas', rating: 4 }],
    skills: ['Help Desk', 'Windows', 'Redes'], projects: ['Migración endpoints'],
  },
  {
    _id: 10, _manager: 4,
    nombre: 'Valeria Acosta', rol: 'Ejecutiva de Ventas', area: 'Ventas',
    email: 'valeria@empresa.com', telefono: '1056', movil: '+54 381 012-3456', estado: 'active',
    sede: 'Sede Buenos Aires', horario: 'Lun - Vie, 09:00 - 18:00', modalidad: 'Presencial', guardias: 'No', actualizado: '24/05/2024',
    summary: 'Ejecutiva de ventas enfocada en cuentas estratégicas.',
    antiguedad: '2 años', formacion: 'Lic. en Administración', seniority: 'Junior', especialidad: 'Ventas B2B',
    experiencia: [{ role: 'Vendedora', company: 'RetailMax', period: '2020 - 2022 (2 años)' }],
    resp_primarias: ['Prospección de clientes', 'Gestión del pipeline', 'Cierre de ventas'],
    resp_secundarias: ['Seguimiento post-venta', 'Carga en CRM'],
    inputs: ['Leads asignados', 'Material comercial', 'Listas de precios'],
    outputs: ['Ventas cerradas', 'Reportes de pipeline'],
    hard_skills: [
      { name: 'Salesforce', level: 75, label: 'Intermedio' },
      { name: 'Excel', level: 70, label: 'Intermedio' },
    ],
    soft_skills: [{ name: 'Persuasión', rating: 5 }, { name: 'Resiliencia', rating: 4 }, { name: 'Comunicación', rating: 5 }],
    skills: ['Prospección', 'Cierre', 'Salesforce'], projects: ['Cuentas estratégicas'],
  },
  {
    _id: 11, _manager: 4,
    nombre: 'Marco Ruiz', rol: 'Account Manager', area: 'Ventas',
    email: 'marco@empresa.com', telefono: '1057', movil: '+54 381 123-4568', estado: 'active',
    sede: 'Sede Buenos Aires', horario: 'Lun - Vie, 09:00 - 18:00', modalidad: 'Híbrido', guardias: 'No', actualizado: '24/05/2024',
    summary: 'Account manager orientado a la retención de clientes.',
    antiguedad: '3 años', formacion: 'Lic. en Marketing', seniority: 'Semi Senior', especialidad: 'Customer Success',
    experiencia: [{ role: 'Ejecutivo Comercial', company: 'GrowthCo', period: '2019 - 2021 (2 años)' }],
    resp_primarias: ['Gestión de cartera', 'Renovaciones y upsell', 'Resolución de conflictos'],
    resp_secundarias: ['Reportes de satisfacción', 'Coordinación con soporte'],
    inputs: ['Cartera asignada', 'Métricas de uso', 'Tickets de clientes'],
    outputs: ['Renovaciones', 'Upsells', 'Reportes de cuenta'],
    hard_skills: [
      { name: 'CRM', level: 80, label: 'Avanzado' },
      { name: 'Excel', level: 70, label: 'Intermedio' },
    ],
    soft_skills: [{ name: 'Empatía', rating: 5 }, { name: 'Negociación', rating: 4 }, { name: 'Organización', rating: 4 }],
    skills: ['Retención', 'Upsell', 'Customer Success'], projects: ['Fidelización'],
  },
];

export interface SeedResult {
  seeded: boolean;
  empleados: number;
  areas: number;
}

/**
 * Carga los datos de ejemplo. Si `reset` es true, borra todo primero (líneas, empleados,
 * áreas). Si `reset` es false, solo siembra cuando la tabla de empleados está vacía.
 * Reutiliza los helpers del lib (createArea/createEmpleado/updateEmpleado) para que el
 * casteo de las columnas Json sea consistente con el resto del CRUD.
 */
export async function seedOrganigrama(reset: boolean): Promise<SeedResult> {
  const count = await prisma.orgEmpleado.count();
  if (!reset && count > 0) {
    return { seeded: false, empleados: count, areas: await prisma.orgArea.count() };
  }
  if (reset) {
    await prisma.$transaction([
      prisma.orgLinea.deleteMany({}),
      prisma.orgEmpleado.deleteMany({}),
      prisma.orgArea.deleteMany({}),
    ]);
  }

  for (const a of SEED_AREAS) {
    await createArea(a);
  }

  // Insertar empleados sin jefe, mapear _id → id real, luego setear manager_id.
  const idMap = new Map<number, number>();
  for (const e of SEED_EMPLEADOS) {
    const { _id, _manager, ...rest } = e;
    void _manager;
    const row = await createEmpleado(rest);
    idMap.set(_id, row.id);
  }
  for (const e of SEED_EMPLEADOS) {
    if (e._manager != null) {
      await updateEmpleado(idMap.get(e._id)!, { manager_id: idMap.get(e._manager) ?? null });
    }
  }

  return { seeded: true, empleados: SEED_EMPLEADOS.length, areas: SEED_AREAS.length };
}
