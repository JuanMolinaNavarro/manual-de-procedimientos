'use client';

/**
 * Barra superior común a los sub-módulos de nómina: empresa (organigrama),
 * período, estado del período y accesos a las otras pestañas permitidas.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { periodLabel } from '@/lib/nomina-calc';
import { useNomina } from './NominaContext';

export default function NominaBar() {
  const { organigramas, organigramaId, setOrganigramaId, periodo, setPeriodo, estado, links } = useNomina();
  const pathname = usePathname();

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empresa</span>
          <Select value={organigramaId != null ? String(organigramaId) : undefined} onValueChange={(v) => setOrganigramaId(Number(v))}>
            <SelectTrigger className="h-9 w-52">
              <SelectValue placeholder={organigramas.length ? 'Empresa' : 'Sin organigramas'} />
            </SelectTrigger>
            <SelectContent>
              {organigramas.map((o) => (
                <SelectItem key={o.id} value={String(o.id)}>{o.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Período</span>
          <Input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="h-9 w-40" aria-label="Período" />
          <span className="hidden text-sm text-muted-foreground sm:inline">{periodLabel(periodo)}</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          {estado && (
            <>
              <Badge variant="outline">empleados {estado.incluidos}/{estado.total}</Badge>
              {estado.cerrado ? (
                <Badge className="bg-violet-600 text-white hover:bg-violet-600">cerrado · {estado.firmados}/{estado.enCierre} firmados</Badge>
              ) : (
                <Badge variant="secondary">en curso</Badge>
              )}
            </>
          )}
        </div>
      </div>
      {links.length > 1 && (
        <nav className="flex flex-wrap gap-1 border-b border-border" aria-label="Módulos de nómina">
          {links.map((l) => {
            const activo = pathname === l.href || pathname?.startsWith(l.href + '/');
            return (
              <Link
                key={l.slug}
                href={l.href}
                className={cn(
                  '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                  activo ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {l.label.replace(/^Nómina · /, '')}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
