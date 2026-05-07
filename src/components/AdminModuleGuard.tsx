'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAdminModulePath, canAccessPath } from '@/lib/modulos';

interface AdminModuleGuardProps {
  modulos: string[];
  fallbackHref: string;
}

/**
 * Client-side guard that redirects the user away from restricted admin modules.
 * Runs after render to avoid RSC redirect loops that occur when redirect() is
 * called from a server layout.
 */
export default function AdminModuleGuard({ modulos, fallbackHref }: AdminModuleGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // No restrictions if modulos is empty (all allowed)
    if (modulos.length === 0) return;
    if (isAdminModulePath(pathname) && !canAccessPath(pathname, modulos)) {
      router.replace(fallbackHref);
    }
  }, [pathname, modulos, fallbackHref, router]);

  return null;
}
