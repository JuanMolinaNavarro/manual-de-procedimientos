'use client';

/**
 * Kiosco de firma: pantalla completa para entregar el dispositivo al
 * trabajador. Muestra el ticket térmico; cuando terminó de "imprimirse"
 * aparece el panel de firma (recibí y leí + PIN + observaciones).
 */

import './nomina.css';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { periodLabel } from '@/lib/nomina-calc';
import type { ConstanciaView, ReciboVista } from '@/lib/nomina';
import { mensajeError, nominaFetch } from './api';
import { useNominaData } from './NominaContext';
import ReciboTermico from './ReciboTermico';

export default function KioscoOverlay({ organigramaId, periodo, empleadoId, onClose, onFirmado }: {
  organigramaId: number;
  periodo: string;
  empleadoId: number;
  onClose: () => void;
  onFirmado: (c: ConstanciaView) => void;
}) {
  const vista = useNominaData<ReciboVista>(`/api/admin/nomina/recibos/vista?organigramaId=${organigramaId}&periodo=${periodo}&empleadoId=${empleadoId}`);
  const [listo, setListo] = useState(false);
  const [leido, setLeido] = useState(false);
  const [pin, setPin] = useState('');
  const [obs, setObs] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const v = vista.data;

  async function firmar(conformidad: 'conforme' | 'disconforme') {
    if (!leido) { toast.error('Marcá que recibiste y leíste el recibo'); return; }
    if (!pin.trim()) { toast.error('Ingresá tu PIN'); return; }
    if (conformidad === 'disconforme' && !obs.trim()) { toast.error('Indicá qué observás para firmar en disconformidad'); return; }
    setEnviando(true);
    try {
      const c = await nominaFetch<ConstanciaView>('/api/admin/nomina/recibos/firmar', {
        method: 'POST',
        body: JSON.stringify({ organigramaId, periodo, empleadoId, pin: pin.trim(), conformidad, observaciones: obs.trim(), leido: true }),
      });
      toast.success(`Recibo de ${periodLabel(periodo)} firmado ${conformidad === 'conforme' ? 'en conformidad' : 'en disconformidad'}`);
      onFirmado(c);
    } catch (e) {
      toast.error(mensajeError(e));
      setPin('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="nomina-kiosk" role="dialog" aria-modal="true" aria-label="Modo firma">
      <div className="kiosk-inner">
        <div className="kiosk-top">
          <span>Modo firma · entregá el dispositivo al trabajador</span>
          <button type="button" className="kbtn" style={{ padding: '6px 12px', fontSize: 12 }} onClick={onClose}>Cancelar</button>
        </div>
        {!v && <p style={{ textAlign: 'center', fontSize: 13 }}>{vista.error ?? 'Cargando recibo…'}</p>}
        {v && !v.cerrado && <p style={{ textAlign: 'center', fontSize: 13 }}>El período no está cerrado: la firma se habilita al cerrar.</p>}
        {v && v.cerrado && v.hash && (
          <>
            <ReciboTermico liquidacion={v.liquidacion} meta={v.meta} hash={v.hash} onCerrar={onClose} onListo={() => setListo(true)} />
            <div className={'sign-box' + (listo ? '' : ' hidden')} style={listo ? undefined : { display: 'none' }}>
              <h4>Constancia de recepción</h4>
              <div className="who">{v.liquidacion.nombre} · CUIL {v.adhesion?.cuil || v.meta.trabajador.cuil || '—'}{v.adhesion ? ' · adhesión ' + v.adhesion.fecha : ''}</div>
              <label className="chk-line">
                <input type="checkbox" checked={leido} onChange={(e) => setLeido(e.target.checked)} />
                <span>Declaro que recibí este recibo de haberes y lo leí completo, incluidos los conceptos, las deducciones y las contribuciones a cargo del empleador.</span>
              </label>
              <div style={{ margin: '12px 0 6px', fontSize: 13, fontWeight: 600 }}>Tu PIN personal</div>
              <input type="password" inputMode="numeric" autoComplete="off" placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value)} aria-label="PIN" />
              <div style={{ margin: '14px 0 6px', fontSize: 13, fontWeight: 600 }}>Observaciones <span style={{ fontWeight: 400, color: '#6e6a61' }}>(obligatorias si firmás en disconformidad)</span></div>
              <textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ej.: no coincide la cantidad de horas extra del día 12" aria-label="Observaciones" />
              <div className="sign-actions">
                <button type="button" className="kbtn success" disabled={enviando} onClick={() => firmar('conforme')}>Firmar en conformidad</button>
                <button type="button" className="kbtn warn" disabled={enviando} onClick={() => firmar('disconforme')}>Firmar en disconformidad</button>
              </div>
              <div className="sign-hash">Hash del recibo que vas a firmar: {v.hash}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
