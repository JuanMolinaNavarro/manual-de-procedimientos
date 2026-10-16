'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SlugMenu } from '@/lib/modulos';
import { ArrowLeft, Briefcase, Building2, Plug, UsersRound, Warehouse } from 'lucide-react';
import { ICONOS_MODULO } from '@/components/AdminSidebar';

/** Descripción de cada módulo en la grilla de inicio (el ícono es el del menú lateral). */
const DESCRIPCIONES: Record<SlugMenu, string> = {
  bonificaciones: 'Gestionar bonificaciones y promociones activas por empresa.',
  usuarios: 'Administrar cuentas, roles y permisos de los usuarios.',
  peliculas: 'Gestionar el catálogo de películas disponibles on-demand.',
  catalogo: 'Ver y sincronizar el catálogo de contenido del proveedor.',
  deportes: 'Configurar y destacar eventos deportivos en la plataforma.',
  leads: 'Ver y gestionar solicitudes de contratación recibidas.',
  planes: 'Configurar precios y planes disponibles por empresa.',
  'senales-ip': 'Gestionar contratos de compradores y vendedores de señales IP.',
  organigrama: 'Visualizar y gestionar la estructura organizacional de la empresa.',
  asistencia: 'Fichadas de los relojes biométricos por empleado, sede y fecha.',
  'mi-asistencia': 'Tu asistencia mes a mes: los días que viniste, llegadas tarde y horas extra, en un calendario de colores.',
  'gestion-recibos': 'Importar los recibos de Finnegans, avisar por mail, adhesiones y seguimiento de firmas.',
  'mis-recibos': 'Tus recibos de sueldo: verlos, descargarlos y firmarlos con tu PIN.',
  vacaciones: 'Temporada de vacaciones: saldos, elección de fechas, aprobación, aviso escrito y cobertura por área.',
  'mis-vacaciones': 'Tus vacaciones: cuántos días te corresponden, elegir fechas y seguir la aprobación.',
  padron: 'Padrón de abonados por empresa: cargar Excel y buscar duplicados.',
  proyectos: 'Cronograma, costos y análisis financiero de cada proyecto.',
  deposito: 'Gestión de stock y movimientos del depósito.',
};

export const CATEGORIAS: {
  titulo: string;
  icon: React.ReactNode;
  description: string;
  slugs: SlugMenu[];
  /** Categoría de un solo módulo: la tarjeta entra directo, sin nivel intermedio. */
  directo?: boolean;
}[] = [
  {
    titulo: 'APIs',
    icon: <Plug className="h-8 w-8" />,
    description: 'Integraciones de contenido: deportes, catálogo y películas.',
    slugs: ['deportes', 'catalogo', 'peliculas'],
  },
  {
    titulo: 'Comercial',
    icon: <Briefcase className="h-8 w-8" />,
    description: 'Ventas, planes, padrón de abonados y bonificaciones.',
    slugs: ['leads', 'planes', 'padron', 'bonificaciones'],
  },
  {
    titulo: 'RRHH',
    icon: <UsersRound className="h-8 w-8" />,
    description: 'Usuarios, organigrama, asistencia, recibos y vacaciones de la empresa.',
    // Los de Nómina pertenecen acá pero no van en los menús (`getModulosParaMenu`).
    slugs: [
      'usuarios',
      'organigrama',
      'asistencia',
      'mi-asistencia',
      'gestion-recibos',
      'mis-recibos',
      'vacaciones',
      'mis-vacaciones',
    ],
  },
  {
    titulo: 'Administración',
    icon: <Building2 className="h-8 w-8" />,
    description: 'Señales IP y proyectos y finanzas.',
    slugs: ['senales-ip', 'proyectos'],
  },
  {
    titulo: 'Depósito',
    icon: <Warehouse className="h-8 w-8" />,
    description: 'Gestión de stock y movimientos del depósito.',
    slugs: ['deposito'],
    directo: true,
  },
];

export type AdminHomeModulo = {
  slug: SlugMenu;
  label: string;
  href: string;
};

function GrillaModulos({ modulos }: { modulos: AdminHomeModulo[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {modulos.map((mod) => {
        const Icono = ICONOS_MODULO[mod.slug];
        return (
          <Link
            key={mod.slug}
            href={mod.href}
            className="group flex flex-col gap-4 rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-accent"
          >
            <div className="text-muted-foreground transition-colors group-hover:text-primary">
              <Icono className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground">{mod.label}</h3>
              <p className="text-sm text-muted-foreground">{DESCRIPCIONES[mod.slug]}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * `sinCategorias`: muestra los módulos directamente, sin la grilla de categorías
 * (el portal del rol `empleado`, que tiene solo dos).
 */
export default function AdminHomeModulos({
  modulos,
  sinCategorias = false,
}: {
  modulos: AdminHomeModulo[];
  sinCategorias?: boolean;
}) {
  const [categoriaActiva, setCategoriaActiva] = useState<string | null>(null);

  if (sinCategorias) return <GrillaModulos modulos={modulos} />;

  const categorias = CATEGORIAS.map((cat) => ({
    ...cat,
    modulos: modulos.filter((mod) => cat.slugs.includes(mod.slug)),
  })).filter((cat) => cat.modulos.length > 0);

  const activa = categorias.find((cat) => cat.titulo === categoriaActiva);

  if (activa) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setCategoriaActiva(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a categorías
        </button>
        <h3 className="text-lg font-semibold text-foreground">{activa.titulo}</h3>
        <GrillaModulos modulos={activa.modulos} />
      </div>
    );
  }

  const cardClassName =
    'group flex flex-col gap-4 rounded-lg border border-border bg-card p-6 text-left transition-colors hover:border-primary/50 hover:bg-accent';

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {categorias.map((cat) => {
        const contenido = (
          <>
            <div className="text-muted-foreground transition-colors group-hover:text-primary">
              {cat.icon}
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground">{cat.titulo}</h3>
              <p className="text-sm text-muted-foreground">{cat.description}</p>
            </div>
          </>
        );

        if (cat.directo) {
          return (
            <Link key={cat.titulo} href={cat.modulos[0].href} className={cardClassName}>
              {contenido}
            </Link>
          );
        }

        return (
          <button
            key={cat.titulo}
            type="button"
            onClick={() => setCategoriaActiva(cat.titulo)}
            className={cardClassName}
          >
            {contenido}
          </button>
        );
      })}
    </div>
  );
}
