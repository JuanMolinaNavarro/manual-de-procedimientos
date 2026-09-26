/**
 * Toggle de tema (claro/oscuro) usando una clase en <html>.
 *
 * El tema vive fuera de React (localStorage + preferencia del sistema) y se lee
 * con `useSyncExternalStore`: así no hace falta copiarlo a un estado dentro de un
 * efecto. En el server (y en la primera pasada de hidratación) vale 'dark'.
 */

'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Theme = 'light' | 'dark';

const oyentes = new Set<() => void>();

function leerTema(): Theme {
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function suscribir(cb: () => void) {
  oyentes.add(cb);
  window.addEventListener('storage', cb); // otra pestaña cambió el tema
  return () => {
    oyentes.delete(cb);
    window.removeEventListener('storage', cb);
  };
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(suscribir, leerTema, (): Theme => 'dark');

  // Sincroniza el DOM con el tema vigente (sistema externo: no toca estado de React).
  // No escribe localStorage: en la hidratación corre primero con el valor del server
  // ('dark') y pisaría la preferencia guardada. Solo el botón la guarda.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleToggle = () => {
    localStorage.setItem('theme', theme === 'dark' ? 'light' : 'dark');
    oyentes.forEach((cb) => cb()); // re-render → el efecto aplica la clase
  };

  return (
    <Button variant="outline" size="icon" onClick={handleToggle} aria-label="Cambiar tema">
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
