'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AdminModuloSlug } from '@/lib/modulos';
import {
  Gift,
  Users,
  Film,
  BookOpen,
  Trophy,
  TrendingUp,
  CreditCard,
  Antenna,
  Network,
  Database,
  FolderKanban,
  Warehouse,
  Plug,
  Briefcase,
  Building2,
  UsersRound,
  ArrowLeft,
} from 'lucide-react';

const MODULE_META: Record<
  AdminModuloSlug,
  { icon: React.ReactNode; description: string }
> = {
  bonificaciones: {
    icon: <Gift className="h-8 w-8" />,
    description: 'Gestionar bonificaciones y promociones activas por empresa.',
  },
  usuarios: {
    icon: <Users className="h-8 w-8" />,
    description: 'Administrar cuentas, roles y permisos de los agentes.',
  },
  peliculas: {
    icon: <Film className="h-8 w-8" />,
    description: 'Gestionar el catálogo de películas disponibles on-demand.',
  },
  catalogo: {
    icon: <BookOpen className="h-8 w-8" />,
    description: 'Ver y sincronizar el catálogo de contenido del proveedor.',
  },
  deportes: {
    icon: <Trophy className="h-8 w-8" />,
    description: 'Configurar y destacar eventos deportivos en la plataforma.',
  },
  leads: {
    icon: <TrendingUp className="h-8 w-8" />,
    description: 'Ver y gestionar solicitudes de contratación recibidas.',
  },
  planes: {
    icon: <CreditCard className="h-8 w-8" />,
    description: 'Configurar precios y planes disponibles por empresa.',
  },
  'senales-ip': {
    icon: <Antenna className="h-8 w-8" />,
    description: 'Gestionar contratos de compradores y vendedores de señales IP.',
  },
  organigrama: {
    icon: <Network className="h-8 w-8" />,
    description: 'Visualizar y gestionar la estructura organizacional de la empresa.',
  },
  padron: {
    icon: <Database className="h-8 w-8" />,
    description: 'Padrón de abonados por empresa: cargar Excel y buscar duplicados.',
  },
  proyectos: {
    icon: <FolderKanban className="h-8 w-8" />,
    description: 'Cronograma, costos y análisis financiero de cada proyecto.',
  },
  deposito: {
    icon: <Warehouse className="h-8 w-8" />,
    description: 'Gestión de stock y movimientos del depósito.',
  },
};

const CATEGORIAS: {
  titulo: string;
  icon: React.ReactNode;
  description: string;
  slugs: AdminModuloSlug[];
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
    description: 'Usuarios y organigrama de la empresa.',
    slugs: ['usuarios', 'organigrama'],
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
  slug: AdminModuloSlug;
  label: string;
  href: string;
};

export default function AdminHomeModulos({ modulos }: { modulos: AdminHomeModulo[] }) {
  const [categoriaActiva, setCategoriaActiva] = useState<string | null>(null);

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {activa.modulos.map((mod) => {
            const meta = MODULE_META[mod.slug];
            return (
              <Link
                key={mod.slug}
                href={mod.href}
                className="group flex flex-col gap-4 rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-accent"
              >
                <div className="text-muted-foreground transition-colors group-hover:text-primary">
                  {meta.icon}
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">{mod.label}</h3>
                  <p className="text-sm text-muted-foreground">{meta.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
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
