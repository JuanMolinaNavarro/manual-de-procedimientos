'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import DetalleContrato, { InfoRow, TextoCard } from '@/components/senales-ip/DetalleContrato';
import type { ContratoVendedor } from '@/lib/senales-ip';

export default function DetalleContratoVendedorPage() {
  return (
    <DetalleContrato<ContratoVendedor>
      tipo="vendedores"
      contacto={(c) => (
        <>
          <InfoRow label="Documentación" value={c.documentacion_empresa} />
          <InfoRow label="Ejecutivo (Señales IP)" value={c.ejecutivo_cargo} />
          <InfoRow label="Mail comercial cliente" value={c.mail_comercial_cliente} />
          <InfoRow label="Teléfono comercial" value={c.telefono_comercial_cliente} />
          <InfoRow label="Mail técnico cliente" value={c.mail_tecnico_cliente} />
          <InfoRow label="Teléfono técnico" value={c.telefono_tecnico_cliente} />
        </>
      )}
      condiciones={(c) => (
        <>
          <InfoRow label="Subs. mín. garantizado" value={c.subs_minimo_garantizado} />
          <InfoRow label="Subs. reportados señales" value={c.subs_reportados_senales} />
          <InfoRow label="Plazas contrato" value={c.plazas_incluidas_contrato} />
          <InfoRow label="Plazas reportadas" value={c.plazas_reportadas_senales} />
          <InfoRow label="TNB aplicada" value={c.tnb_aplicada} />
          <InfoRow label="Recepción/entrega" value={c.forma_recepcion_entrega} />
        </>
      )}
      extra={(c) => (
        <>
          <TextoCard titulo="Grilla" texto={c.grilla} />
          <TextoCard titulo="Condiciones de pago" texto={c.condiciones_pago} />
          <TextoCard titulo="Condiciones de entrega de equipamiento" texto={c.condiciones_entrega_equipamiento} />
          {c.equipos_por_senal && c.equipos_por_senal.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Equipos por señal habilitados</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Señal</TableHead>
                      <TableHead>Equipo habilitado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {c.equipos_por_senal.map((eq, i) => (
                      <TableRow key={i}>
                        <TableCell>{eq.signal}</TableCell>
                        <TableCell>{eq.equipment}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    />
  );
}
