'use client';

import './nomina.css';
import { fechaHora } from '@/lib/nomina-calc';
import type { ConstanciaView } from '@/lib/nomina';

/** Constancia de recepción y firma electrónica (texto legal + hashes). */
export default function ConstanciaCard({ constancia: c, hashOk }: { constancia: ConstanciaView; hashOk?: boolean | null }) {
  return (
    <div className="nomina-rc">
      <div className={'const-card ' + (c.conformidad === 'conforme' ? 'ok' : 'dis')}>
        <b>Constancia de recepción y firma electrónica</b> · {c.conformidad === 'conforme' ? 'EN CONFORMIDAD' : 'EN DISCONFORMIDAD'}<br />
        Firmante: {c.firmante.nombre} · CUIL {c.firmante.cuil || '—'} · identidad verificada por PIN personal<br />
        Fecha y hora: {fechaHora(c.fecha)} ({c.fecha}) · canal: {c.canal}{c.dispositivo ? ' · ' + c.dispositivo : ''}<br />
        {c.observaciones ? <>Observaciones del trabajador: «{c.observaciones}»<br /></> : null}
        Recibo firmado (SHA-256): {c.hash}<br />
        Encadenado: {c.chainHash}
      </div>
      {hashOk != null && (
        <div className={'alert-row ' + (hashOk ? 'ok' : 'error')} style={{ marginTop: 10 }}>
          {hashOk
            ? 'El hash de la constancia coincide con el recibo cerrado: el documento no fue alterado.'
            : 'El hash NO coincide con el recibo cerrado. El período fue reabierto y recalculado después de la firma.'}
        </div>
      )}
    </div>
  );
}
