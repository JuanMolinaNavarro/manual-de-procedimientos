'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Gift, Users, Film, Library, Trophy, Inbox, Wifi } from 'lucide-react';

const navLinks = [
  { href: '/admin/bonificaciones', label: 'Bonificaciones', icon: Gift },
  { href: '/admin/usuarios', label: 'Usuarios', icon: Users },
  { href: '/admin/peliculas', label: 'Películas', icon: Film },
  { href: '/admin/peliculas/catalogo', label: 'Catálogo', icon: Library },
  { href: '/admin/deportes', label: 'Deportes', icon: Trophy },
  { href: '/admin/leads', label: 'Leads', icon: Inbox },
  { href: '/admin/planes', label: 'Planes', icon: Wifi },
];

export default function AdminSidebar({ nombreCompleto }: { nombreCompleto?: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border shadow-xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 h-16 border-b border-border shrink-0">
          <span className="font-semibold text-foreground">Panel de administracion</span>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {nombreCompleto && (
          <div className="px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground truncate">{nombreCompleto}</p>
          </div>
        )}
      </div>
    </>
  );
}
