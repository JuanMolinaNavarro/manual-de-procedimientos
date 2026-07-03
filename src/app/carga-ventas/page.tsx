'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Abonado {
  DocumentoNumero: string;
  NombreCompleto: string;
  Email: string | null;
  DomicilioInstalacionDomicilio: string;
  DomicilioInstalacionPiso: string;
  DomicilioInstalacionManzana: string;
  DomicilioInstalacionCasa: string;
  DomicilioInstalacionZonaNombre: string;
  DomicilioFacturacionDomicilio: string;
  DomicilioFacturacionPiso: string;
  DomicilioFacturacionManzana: string;
  DomicilioFacturacionCasa: string;
}

interface ConsultaResult {
  found: boolean;
  registros: number;
  clienteId: number | null;
  abonado: Abonado | null;
}

/** Etiqueta + valor, para leer rápido qué es cada dato. */
function Dato({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm text-foreground">{value || '—'}</dd>
    </div>
  );
}

/** Devuelve el valor sólo si tiene contenido (para el render condicional). */
const opt = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

export default function CargaVentasPage() {
  const [dni, setDni] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [buscado, setBuscado] = useState('');
  const [result, setResult] = useState<ConsultaResult | null>(null);

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault();
    const doc = dni.trim();
    if (!doc) {
      setError('Ingresá un DNI.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`/api/carga-ventas/abonado?dni=${encodeURIComponent(doc)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo consultar el abonado.');
      setBuscado(doc);
      setResult(data as ConsultaResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  const ab = result?.abonado ?? null;

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Carga de Ventas</h1>
          <p className="text-sm text-muted-foreground">
            Buscá el abonado por su número de documento (DNI).
          </p>
        </div>

        <form onSubmit={buscar} className="flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="dni">DNI</Label>
            <Input
              id="dni"
              inputMode="numeric"
              autoFocus
              placeholder="Ej: 27365685"
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <Button type="submit" disabled={loading || !dni.trim()}>
            {loading ? 'Buscando…' : 'Buscar'}
          </Button>
        </form>

        {error && (
          <div className="rounded-md border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {result && !result.found && (
          <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
            No se encontró ningún abonado con el documento{' '}
            <span className="font-medium text-foreground">{buscado}</span>.
          </div>
        )}

        {result?.found && ab && (
          <div className="space-y-4">
            {result.registros > 1 && (
              <div className="rounded-md border border-amber-900/50 bg-amber-950/30 p-3 text-sm text-amber-300">
                ⚠️ Este documento tiene <span className="font-semibold">{result.registros}</span>{' '}
                registros asociados. Se muestra el principal
                {result.clienteId ? ` (ClienteID ${result.clienteId})` : ''}.
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Abonado</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Dato label="DNI" value={ab.DocumentoNumero} />
                  <Dato label="Nombre" value={ab.NombreCompleto} />
                  <Dato label="Email" value={ab.Email} />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Domicilio de instalación</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Dato label="Domicilio" value={ab.DomicilioInstalacionDomicilio} />
                  {opt(ab.DomicilioInstalacionPiso) && (
                    <Dato label="Piso" value={ab.DomicilioInstalacionPiso} />
                  )}
                  {opt(ab.DomicilioInstalacionManzana) && (
                    <Dato label="Manzana" value={ab.DomicilioInstalacionManzana} />
                  )}
                  {opt(ab.DomicilioInstalacionCasa) && (
                    <Dato label="Casa" value={ab.DomicilioInstalacionCasa} />
                  )}
                  <Dato label="Zona" value={ab.DomicilioInstalacionZonaNombre} />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Domicilio de facturación</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Dato label="Domicilio" value={ab.DomicilioFacturacionDomicilio} />
                  {opt(ab.DomicilioFacturacionPiso) && (
                    <Dato label="Piso" value={ab.DomicilioFacturacionPiso} />
                  )}
                  {opt(ab.DomicilioFacturacionManzana) && (
                    <Dato label="Manzana" value={ab.DomicilioFacturacionManzana} />
                  )}
                  {opt(ab.DomicilioFacturacionCasa) && (
                    <Dato label="Casa" value={ab.DomicilioFacturacionCasa} />
                  )}
                </dl>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
