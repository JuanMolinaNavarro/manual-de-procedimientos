/**
 * Envío de mails por el SMTP de la empresa (nodemailer). Solo servidor.
 *
 * Variables (.env):
 *   SMTP_HOST, SMTP_PORT (587), SMTP_SECURE (true = TLS directo, típico del 465),
 *   SMTP_USER, SMTP_PASS, MAIL_FROM ("Recursos Humanos <rrhh@empresa.com>"),
 *   APP_URL (URL pública de Aurelius, para los enlaces de los mails).
 *
 * Sin SMTP_HOST el sistema queda en **modo prueba**: arma el mail completo y lo guarda como
 * `.eml` en `uploads/nomina/mails-prueba/` sin enviarlo (se puede abrir con cualquier cliente
 * de correo para revisarlo).
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import nodemailer, { type Transporter } from 'nodemailer';

export const MAILS_PRUEBA_DIR = join(process.cwd(), 'uploads', 'nomina', 'mails-prueba');

export type ModoMail = 'smtp' | 'prueba';

export function modoMail(): ModoMail {
  return process.env.SMTP_HOST ? 'smtp' : 'prueba';
}

/** URL pública de la app para los enlaces (sin barra final). */
export function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

function remitente(): string {
  return process.env.MAIL_FROM ?? process.env.SMTP_USER ?? 'Aurelius <no-reply@localhost>';
}

let transporte: Transporter | null = null;

function smtp(): Transporter {
  if (!transporte) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } : undefined,
    });
  }
  return transporte;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type ResultadoMail = { ok: true; messageId: string } | { ok: false; error: string };

export async function enviarMail(m: Mail): Promise<ResultadoMail> {
  const mensaje = { from: remitente(), to: m.to, subject: m.subject, text: m.text, html: m.html };
  try {
    if (modoMail() === 'smtp') {
      const info = await smtp().sendMail(mensaje);
      return { ok: true, messageId: info.messageId ?? '' };
    }
    // Modo prueba: mismo mensaje MIME, a un archivo.
    const prueba = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
    const info = await prueba.sendMail(mensaje);
    mkdirSync(MAILS_PRUEBA_DIR, { recursive: true });
    const nombre = `${new Date().toISOString().replace(/[:.]/g, '-')}-${m.to.replace(/[^\w.@-]/g, '_')}.eml`;
    writeFileSync(join(MAILS_PRUEBA_DIR, nombre), info.message as Buffer);
    return { ok: true, messageId: `prueba:${nombre}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 300) : 'Error al enviar' };
  }
}
