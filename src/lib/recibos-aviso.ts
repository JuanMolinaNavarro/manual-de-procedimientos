/**
 * Contenido del aviso "tus recibos están disponibles" (lógica pura, testeada).
 *
 * A propósito NO lleva adjuntos, importes ni datos del recibo: solo avisa que hay recibos
 * para ver y firmar, y el enlace al portal. El mail es la notificación de la puesta a
 * disposición; el recibo y la firma están en el portal.
 */

import { fmtMes } from './asistencia-calendario';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function emailValido(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v.trim());
}

export function normalizarEmail(v: string): string {
  return v.trim().toLowerCase();
}

function escaparHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export interface DatosAviso {
  nombre: string;
  empresa: string;
  periodo: string; // yyyy-mm
  recibos: number;
  url: string; // enlace a Mis recibos
}

export function armarMailAviso(d: DatosAviso): { subject: string; text: string; html: string } {
  const mes = fmtMes(d.periodo);
  const mesCap = mes.charAt(0).toUpperCase() + mes.slice(1);
  const primerNombre = d.nombre.split(/\s+/)[0] || d.nombre;
  const cuantos = d.recibos === 1 ? 'tu recibo de sueldo' : `tus ${d.recibos} recibos de sueldo`;
  const instruccion = d.recibos === 1
    ? 'Para verlo y firmarlo entrá a Aurelius con tu usuario, andá a "Recibos" y firmalo con tu PIN personal.'
    : 'Para verlos y firmarlos entrá a Aurelius con tu usuario, andá a "Recibos" y firmá cada uno con tu PIN personal.';
  const subject = `${mesCap}: ${d.recibos === 1 ? 'tu recibo de sueldo está disponible' : 'tus recibos de sueldo están disponibles'}`;
  const text = [
    `Hola ${primerNombre}:`,
    '',
    `Ya está${d.recibos === 1 ? '' : 'n'} disponible${d.recibos === 1 ? '' : 's'} ${cuantos} de ${mes} (${d.empresa}).`,
    '',
    instruccion,
    'Podés firmar en conformidad o en disconformidad; firmar en disconformidad no te hace perder ningún derecho.',
    '',
    d.url,
    '',
    'Por seguridad este mail no incluye el recibo ni importes. Nadie de la empresa te va a pedir tu PIN.',
    'Si olvidaste tu PIN, acercate a Recursos Humanos.',
  ].join('\n');
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.5">
<p>Hola ${escaparHtml(primerNombre)}:</p>
<p>Ya está${d.recibos === 1 ? '' : 'n'} disponible${d.recibos === 1 ? '' : 's'} <b>${escaparHtml(cuantos)}</b> de ${escaparHtml(mes)} (${escaparHtml(d.empresa)}).</p>
<p>${escaparHtml(instruccion)}
Podés firmar en conformidad o en disconformidad; firmar en disconformidad no te hace perder ningún derecho.</p>
<p><a href="${escaparHtml(d.url)}" style="display:inline-block;background:#1f2937;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Ver y firmar mis recibos</a></p>
<p style="font-size:12px;color:#666">Por seguridad este mail no incluye el recibo ni importes. Nadie de la empresa te va a pedir tu PIN.
Si olvidaste tu PIN, acercate a Recursos Humanos.</p>
</body></html>`;
  return { subject, text, html };
}
