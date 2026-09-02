'use client';

/**
 * Recibo térmico: la impresora expulsa el papel con el recibo. Es la vista que
 * ve el TRABAJADOR en el kiosco. Al tocar «Ver mi recibo» el papel se desliza
 * hacia abajo saliendo de la ranura, con el borde perforado adelante, a
 * velocidad constante (~260 px/s); la vista acompaña al borde. Con movimiento
 * reducido sale entero de una. Solo se anima `transform` (GPU).
 */

import './nomina.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RUBROS_EMPLEADOR } from '@/lib/nomina-datos';
import { fechaHora, money, numeroALetras, periodLabel, type Liquidacion, type ReciboMeta } from '@/lib/nomina-calc';
import type { ConstanciaView } from '@/lib/nomina';

/** Código de barras derivado del hash real (primeros 48 nibbles del SHA-256). */
export function Barcode({ hash }: { hash: string }) {
  let x = 0;
  const bars: { x: number; w: number }[] = [];
  for (let i = 0; i < 48; i++) {
    const v = parseInt(hash[i] ?? '0', 16);
    const w = 1 + (v % 3);
    if (i % 2 === 0) bars.push({ x, w });
    x += w + 1;
  }
  return (
    <svg className="bc" viewBox={`0 0 ${x} 34`} preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Código del recibo">
      {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={34} />)}
    </svg>
  );
}

type Fase = 'espera' | 'imprimiendo' | 'listo';

const KV = ({ k, v }: { k: string; v?: string | number | null }) => (
  <div className="p-kv"><span>{k}</span><span>{v === '' || v == null ? '—' : v}</span></div>
);
const Line = ({ nombre, monto, base, signo }: { nombre: string; monto: number; base?: string; signo?: string }) => (
  <div className="p-line"><span>{nombre}{base ? <span className="base">{base}</span> : null}</span><span className="amt">{signo || ''}{money(monto)}</span></div>
);
const Bar = ({ nombre, monto, costo, own }: { nombre: string; monto: number; costo: number; own?: boolean }) => (
  <div className="p-bar"><span>{nombre}</span><div className="track"><div className={'fill' + (own ? ' own' : '')} style={{ width: (costo > 0 ? Math.min(100, (monto / costo) * 100).toFixed(1) : 0) + '%' }} /></div><span className="amt">{money(monto)}</span></div>
);

export default function ReciboTermico({ liquidacion: l, meta, hash, constancia, onCerrar, onListo }: {
  liquidacion: Liquidacion;
  meta: ReciboMeta;
  hash: string;
  constancia?: ConstanciaView | null;
  onCerrar?: () => void;
  onListo?: () => void;
}) {
  const t = meta.trabajador, em = meta.empresa, cs = meta.cargasSociales;
  const [fase, setFase] = useState<Fase>('espera');
  const rootRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const costo = l.costoEmpresa || 0;

  const terminar = useCallback(() => {
    const paper = paperRef.current;
    if (paper) { paper.style.transition = ''; paper.style.transform = ''; }
    setFase('listo');
    onListo?.();
  }, [onListo]);

  useEffect(() => {
    if (fase !== 'imprimiendo') return;
    const root = rootRef.current, paper = paperRef.current;
    if (!root || !paper) return;
    const rm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const H = paper.offsetHeight || paper.scrollHeight || 0;
    if (rm || !H) { const id = setTimeout(terminar, 50); return () => clearTimeout(id); }
    const VEL = 260; // px/s: ritmo de térmica
    const segs = Math.min(16, Math.max(2.4, H / VEL));
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        paper.style.transition = `transform ${segs}s cubic-bezier(.42,.06,.58,.94)`;
        paper.style.transform = 'translate3d(0,0,0)';
      });
    });
    // La vista acompaña al borde que va saliendo; si el usuario scrollea, se suelta.
    const scroller = (root.closest('.nomina-kiosk') as HTMLElement | null) || (document.scrollingElement as HTMLElement | null) || document.documentElement;
    let seguir = true;
    const soltar = () => { seguir = false; };
    addEventListener('wheel', soltar, { passive: true, once: true });
    addEventListener('touchstart', soltar, { passive: true, once: true });
    const alto = scroller.clientHeight || innerHeight;
    const t0 = performance.now();
    let rafSeguir = 0;
    const acompanar = (now: number) => {
      if (!seguir) return;
      const borde = paper.getBoundingClientRect().bottom + scroller.scrollTop;
      const objetivo = borde - alto * 0.62;
      if (objetivo > scroller.scrollTop) scroller.scrollTop += (objetivo - scroller.scrollTop) * 0.35;
      if (now - t0 < segs * 1000 + 100) rafSeguir = requestAnimationFrame(acompanar);
    };
    rafSeguir = requestAnimationFrame(acompanar);
    const fin = setTimeout(terminar, segs * 1000 + 250);
    return () => {
      cancelAnimationFrame(raf); cancelAnimationFrame(rafSeguir); clearTimeout(fin);
      removeEventListener('wheel', soltar); removeEventListener('touchstart', soltar);
    };
  }, [fase, terminar]);

  function verRecibo() {
    if (fase !== 'espera') return;
    // El papel arranca escondido arriba (−100 % de su propio alto): no hace falta medirlo antes.
    if (paperRef.current) paperRef.current.style.transform = 'translate3d(0,-100%,0)';
    setFase('imprimiendo');
  }

  return (
    <div ref={rootRef} className={'nomina-printer printer' + (fase !== 'espera' ? ' printing' : '') + (fase === 'listo' ? ' printed' : '')}>
      <div className="printer-body">
        <div className="pb-top"><div className="pb-mark">✳</div>{onCerrar && <button type="button" className="pb-home" onClick={onCerrar}>Cerrar</button>}</div>
        <div className="pb-screen">
          <div className="pb-row">
            <div><div className="pb-plan">Recibo de haberes</div><div className="pb-per">{periodLabel(meta.periodo)}</div></div>
            <div><div className="pb-tot-l">Neto</div><div className="pb-tot">{money(l.neto)}</div></div>
          </div>
          <div className="pb-status">
            {fase === 'espera' && <button type="button" className="pb-ver" onClick={verRecibo}>Ver mi recibo</button>}
            {fase === 'imprimiendo' && <div className="pb-printing"><div className="pb-spin" /><span>Imprimiendo tu recibo</span></div>}
            {fase === 'listo' && <span className="pb-ready">Recibo listo · leelo completo antes de firmar</span>}
          </div>
        </div>
      </div>
      <div className="pb-slotlip" />
      <div className="paper-slot"><div ref={paperRef} className="paper">
        <div className="p-brand">{(em.razonSocial || 'EMPLEADOR').toUpperCase()}</div>
        <div className="p-sub">CUIT {em.cuit || '—'}{em.domicilio ? ' · ' + em.domicilio : ''}</div>
        <div className="p-rule" />
        <KV k="Trabajador" v={t.nombre} />
        <KV k="CUIL" v={t.cuil} />
        <KV k="Categoría" v={t.categoria} />
        <KV k="Convenio" v={(t.convenio || '') + (t.cct ? ' ' + t.cct : '')} />
        <KV k="Ingreso" v={t.fechaIngreso} />
        <KV k="Antigüedad" v={`${t.antiguedad} año(s)`} />
        <KV k="Período" v={periodLabel(meta.periodo)} />

        <div className="p-rule" />
        <div className="p-sec">HABERES</div>
        {l.rem.map((i, k) => <Line key={k} nombre={i.nombre} monto={i.monto} base={i.detalle || ''} />)}
        <div className="p-line sum"><span>Total remunerativo</span><span className="amt">{money(l.totalRem)}</span></div>
        {l.norem.length > 0 && (
          <>
            <div className="p-sec" style={{ marginTop: 11 }}>NO REMUNERATIVO</div>
            {l.norem.map((i, k) => <Line key={k} nombre={i.nombre} monto={i.monto} base={i.detalle || ''} />)}
            <div className="p-line sum"><span>Total no remunerativo</span><span className="amt">{money(l.totalNoRem)}</span></div>
          </>
        )}

        <div className="p-rule" />
        <div className="p-sec">DEDUCCIONES</div>
        {l.ded.map((i, k) => <Line key={k} nombre={i.nombre} monto={i.monto} base={i.detalle || ''} signo="− " />)}
        <div className="p-line sum"><span>Total deducciones</span><span className="amt">− {money(l.totalDed)}</span></div>

        <div className="p-rule" />
        <div className="p-neto"><span className="lbl">NETO A COBRAR</span><span className="val">{money(l.neto)}</span></div>
        <div className="p-letras">Son {numeroALetras(l.neto)}</div>
        {t.cbu && <div className="p-note">Acreditación en CBU {t.cbu}</div>}

        <div className="p-rule" />
        <div className="p-sec">A CARGO DEL EMPLEADOR · NO SE DESCUENTA DE TU SUELDO</div>
        {(l.contribs || []).length
          ? l.contribs.map((c) => <Line key={c.rubro} nombre={c.nombre} monto={c.monto} base={`${c.pct}% s/ ${money(c.base)}`} />)
          : <div className="p-line"><span>Sin contribuciones cargadas</span><span className="amt">—</span></div>}
        <div className="p-line sum"><span>Total empleador</span><span className="amt">{money(l.totalContrib || 0)}</span></div>

        <div className="p-rule" />
        <div className="p-sec">COMPOSICIÓN DEL COSTO LABORAL</div>
        <Bar nombre="Neto que cobrás" monto={l.neto} costo={costo} own />
        <Bar nombre="Tus aportes" monto={l.totalDed} costo={costo} />
        {RUBROS_EMPLEADOR.map(([rubro, nombre]) => {
          const c = (l.contribs || []).find((x) => x.rubro === rubro);
          return <Bar key={rubro} nombre={nombre.split(' (')[0]} monto={c ? c.monto : 0} costo={costo} />;
        })}
        <div className="p-line sum"><span>Costo laboral total</span><span className="amt">{money(costo)}</span></div>

        <div className="p-rule" />
        <div className="p-sec">CARGAS SOCIALES</div>
        <KV k="Lugar de pago" v={cs.lugarPago} />
        <KV k="Banco" v={cs.banco} />
        <KV k="Último depósito" v={cs.ultimoDepositoFecha ? cs.ultimoDepositoFecha + (cs.ultimoDepositoPeriodo ? ' · per. ' + cs.ultimoDepositoPeriodo : '') : ''} />

        {constancia && (
          <div className={'p-stamp ' + (constancia.conformidad === 'conforme' ? 'ok' : 'dis')}>
            FIRMADO {constancia.conformidad === 'conforme' ? 'EN CONFORMIDAD' : 'EN DISCONFORMIDAD'}<br />{fechaHora(constancia.fecha)}
          </div>
        )}

        <div className="p-code">
          <Barcode hash={hash} />
          <div className="hx">{hash}</div>
        </div>
        <div className="paper-edge" />
      </div></div>
    </div>
  );
}
