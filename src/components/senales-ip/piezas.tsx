'use client';

/** Piezas compartidas por los contratos de comprador y de vendedor de Señales IP. */

import { useEffect, useRef, useState } from 'react';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type TipoContrato = 'compradores' | 'vendedores';

/** El formulario usa '' para "sin dato"; la API espera null. */
export function vaciosANull<T extends object>(datos: T): T {
  return Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, v === '' ? null : v])) as T;
}

export function ErrorForm({ error }: { error: string }) {
  if (!error) return null;
  return <div className="rounded-md border border-red-900/50 bg-red-950/30 p-4 text-red-300">{error}</div>;
}

/** Logo de la empresa del contrato: vista previa, subir/cambiar y eliminar. */
export function LogoContrato({ tipo, id }: { tipo: TipoContrato; id: number }) {
  const url = `/api/admin/senales-ip/${tipo}/${id}/logo`;
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLogoUrl(`${url}?t=${Date.now()}`);
  }, [url]);

  const subir = async (file: File) => {
    setCargando(true);
    const fd = new FormData();
    fd.append('logo', file);
    const res = await fetch(url, { method: 'POST', body: fd });
    if (res.ok) setLogoUrl(`${url}?t=${Date.now()}`);
    setCargando(false);
  };

  const eliminar = async () => {
    setCargando(true);
    await fetch(url, { method: 'DELETE' });
    setLogoUrl(null);
    setCargando(false);
  };

  return (
    <Card>
      <CardHeader><CardTitle>Logo de la empresa</CardTitle></CardHeader>
      <CardContent className="flex flex-col items-start gap-4">
        <div className="flex h-28 w-44 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain p-2" onError={() => setLogoUrl(null)} />
          ) : (
            <Building2 className="h-12 w-12 text-muted-foreground/40" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ''; }}
          />
          <Button type="button" variant="outline" size="sm" disabled={cargando} onClick={() => inputRef.current?.click()}>
            {cargando ? 'Subiendo...' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
          </Button>
          {logoUrl && (
            <Button type="button" variant="ghost" size="sm" disabled={cargando} onClick={eliminar}>
              Eliminar logo
            </Button>
          )}
          <p className="text-xs text-muted-foreground">PNG, JPG, WebP, SVG o GIF.</p>
        </div>
      </CardContent>
    </Card>
  );
}
