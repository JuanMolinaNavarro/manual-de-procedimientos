'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DetalleContrato, { InfoRow, TextoCard } from '@/components/senales-ip/DetalleContrato';
import type { ContratoComprador } from '@/lib/senales-ip';

export default function DetalleContratoCompradorPage() {
  return (
    <DetalleContrato<ContratoComprador>
      tipo="compradores"
      contacto={(c) => (
        <>
          <InfoRow label="Ejecutivo a cargo" value={c.ejecutivo_a_cargo} />
          <InfoRow label="Mail comercial" value={c.mail_comercial} />
          <InfoRow label="Teléfono comercial" value={c.telefono_comercial} />
          <InfoRow label="Mail técnico" value={c.mail_tecnico} />
          <InfoRow label="Teléfono técnico" value={c.telefono_tecnico} />
        </>
      )}
      condiciones={(c) => (
        <>
          <InfoRow label="Subs. mín. garantizado" value={c.subs_minimo_garantizado} />
          <InfoRow label="Reportar subs" value={c.reportar_subs ? 'Sí' : 'No'} />
          <InfoRow label="Plazas reportadas" value={c.plazas_reportadas} />
          <InfoRow label="TNB aplicada" value={c.tnb_aplicada} />
        </>
      )}
      extra={(c) => (
        <>
          <TextoCard titulo="Condiciones de pago (contrato)" texto={c.condiciones_pago_contrato} />
          <TextoCard titulo="Condiciones de pago (acordadas)" texto={c.condiciones_pago_acordadas} />
          {c.tecnologias_autorizadas.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Tecnologías autorizadas</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {c.tecnologias_autorizadas.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    />
  );
}
