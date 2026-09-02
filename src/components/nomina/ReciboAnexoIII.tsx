'use client';

/**
 * Recibo de haberes según el modelo del Anexo III (Decreto 407/2026): cuatro
 * secciones (empleador/trabajador, contribuciones del empleador, bruto y
 * deducciones, neto) más el resumen de la composición del costo laboral.
 * Sirve para el diálogo de detalle y para la impresión A4.
 */

import './nomina.css';
import { RUBROS_EMPLEADOR } from '@/lib/nomina-datos';
import { money, numeroALetras, periodLabel, type Item, type Liquidacion, type ReciboMeta } from '@/lib/nomina-calc';

function KV({ k, v }: { k: string; v?: string | number | null }) {
  return <div><div className="k">{k}</div><div className="v">{v === '' || v == null ? '—' : v}</div></div>;
}

function Row({ i, signo, base }: { i: Item; signo?: string; base?: string }) {
  return (
    <div className="rc-row">
      <span>{i.nombre}<span className="c-detail"> {i.detalle || ''}</span></span>
      <span className="base">{base || ''}</span>
      <b>{signo || ''}{money(i.monto)}</b>
    </div>
  );
}

export default function ReciboAnexoIII({ liquidacion: l, meta, noFlags }: { liquidacion: Liquidacion; meta: ReciboMeta; noFlags?: boolean }) {
  const t = meta.trabajador, cs = meta.cargasSociales, em = meta.empresa;
  const contribs = l.contribs || [];
  const totalContrib = l.totalContrib || 0;
  const costo = l.costoEmpresa || 0;
  const pct = (m: number) => (costo > 0 ? Math.min(100, (m / costo) * 100).toFixed(1) : '0');

  return (
    <div className="nomina-rc">
      <div className="rc-sec">
        <div className="rc-head"><span>1 · Empleador y trabajador</span><span>{periodLabel(meta.periodo)}</span></div>
        <div className="rc-grid">
          <KV k="Empleador" v={em.razonSocial} /><KV k="CUIT" v={em.cuit} /><KV k="Domicilio" v={em.domicilio} />
          <KV k="Trabajador" v={t.nombre} /><KV k="CUIL" v={t.cuil} /><KV k="Categoría" v={t.categoria} />
          <KV k="Convenio" v={t.convenio + (t.cct ? ' · ' + t.cct : '')} /><KV k="Fecha de ingreso" v={t.fechaIngreso} /><KV k="Antigüedad" v={`${t.antiguedad} año(s)`} />
          <KV k="Cargas sociales · lugar de pago" v={cs.lugarPago} /><KV k="Banco" v={cs.banco} />
          <KV k="Último depósito" v={cs.ultimoDepositoFecha ? `${cs.ultimoDepositoFecha} (período ${cs.ultimoDepositoPeriodo || '—'})` : ''} />
        </div>
      </div>
      <div className="rc-sec">
        <div className="rc-head emp"><span>2 · Contribuciones a cargo del empleador</span><span>no se descuentan del sueldo</span></div>
        {contribs.length
          ? contribs.map((c) => <Row key={c.rubro} i={{ nombre: c.nombre, monto: c.monto, detalle: '' }} base={`${c.pct}% s/ ${money(c.base)}`} />)
          : <div className="rc-row"><span>Sin contribuciones parametrizadas</span><span></span><b>—</b></div>}
        <div className="rc-row sub"><span>Total a cargo del empleador</span><span></span><b>{money(totalContrib)}</b></div>
      </div>
      <div className="rc-sec">
        <div className="rc-head"><span>3 · Remuneración bruta y deducciones</span></div>
        {l.rem.map((i, k) => <Row key={'r' + k} i={i} base="remunerativo" />)}
        <div className="rc-row sub"><span>Total remunerativo bruto</span><span></span><b>{money(l.totalRem)}</b></div>
        {l.norem.map((i, k) => <Row key={'n' + k} i={i} base="no remunerativo" />)}
        {l.norem.length > 0 && <div className="rc-row sub"><span>Total no remunerativo</span><span></span><b>{money(l.totalNoRem)}</b></div>}
        {l.ded.map((i, k) => <Row key={'d' + k} i={i} signo="− " base="deducción" />)}
        <div className="rc-row sub"><span>Total deducciones</span><span></span><b>− {money(l.totalDed)}</b></div>
      </div>
      <div className="rc-neto">
        <div className="liq-line total"><span>4 · NETO A COBRAR</span><span className="big">{money(l.neto)}</span></div>
        <div className="letras">Son {numeroALetras(l.neto)}{t.cbu ? ' · acreditación en CBU ' + t.cbu : ''}</div>
      </div>
      <div className="rc-sec" style={{ marginTop: 12 }}>
        <div className="rc-head emp"><span>Composición del costo laboral total</span><span>costo {money(costo)}</span></div>
        <div className="rc-bars">
          <div className="rc-bar"><span>Neto que recibe el trabajador</span><div className="track"><div className="fill" style={{ width: pct(l.neto) + '%', background: 'var(--green)' }} /></div><span className="amt">{money(l.neto)}</span></div>
          <div className="rc-bar"><span>Aportes del trabajador</span><div className="track"><div className="fill" style={{ width: pct(l.totalDed) + '%', background: 'var(--red)' }} /></div><span className="amt">{money(l.totalDed)}</span></div>
          {RUBROS_EMPLEADOR.map(([rubro, nombre]) => {
            const c = contribs.find((x) => x.rubro === rubro);
            const monto = c ? c.monto : 0;
            return (
              <div className="rc-bar" key={rubro}><span>{nombre.split(' (')[0]}</span><div className="track"><div className="fill" style={{ width: pct(monto) + '%' }} /></div><span className="amt">{money(monto)}</span></div>
            );
          })}
        </div>
        <div className="rc-total-cost"><span>Costo laboral total del puesto</span><span>{money(costo)}</span></div>
      </div>
      {!noFlags && (l.flags || []).map((f, k) => <div key={k} className={'alert-row ' + (f.tipo === 'error' ? 'error' : 'warn')}>{f.msg}</div>)}
    </div>
  );
}
