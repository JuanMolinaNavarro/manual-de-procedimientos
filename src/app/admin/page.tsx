import Link from 'next/link';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getModulosForUser, type AdminModuloSlug } from '@/lib/modulos';
import {
  Gift,
  Users,
  Film,
  BookOpen,
  Trophy,
  TrendingUp,
  CreditCard,
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
};

export default async function AdminHomePage() {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get('site_session')?.value;
  const usuario = sessionValue ? sessionValue.split('|')[0] : null;

  const usuarioRecord = usuario
    ? await prisma.usuario.findUnique({
        where: { usuario },
        select: { nombre: true, apellido: true, modulos: true },
      })
    : null;

  const modulos = usuarioRecord?.modulos ?? [];
  const allowedModules = getModulosForUser(modulos);

  const nombreCompleto = usuarioRecord
    ? [usuarioRecord.nombre, usuarioRecord.apellido].filter(Boolean).join(' ').trim() || usuario
    : usuario;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Bienvenido{nombreCompleto ? `, ${nombreCompleto}` : ''}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Seleccioná un módulo para comenzar.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {allowedModules.map((mod) => {
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
