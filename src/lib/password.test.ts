import { pbkdf2Sync, scryptSync } from 'crypto';
import { describe, it, expect } from 'vitest';
import { esHash, hashSecreto, validarPasswordNueva, verificarPassword } from './password';

/** Hash en el formato scrypt de antes de 2026-10 (N chico para que el test sea rápido). */
function scryptViejo(input: string): string {
  const sal = Buffer.alloc(16, 7);
  const h = scryptSync(input, sal, 32, { N: 1024, r: 8, p: 1 });
  return `scrypt$1024$8$1$${sal.toString('hex')}$${h.toString('hex')}`;
}
import { LOGIN_MAX_FALLOS, bloqueoVigente, esperaIp, falloUsuario, ipCliente, registrarFalloIp, IP_MAX_FALLOS } from './login-limite';

describe('password', () => {
  it('hashea con sal (dos hashes distintos) y verifica', async () => {
    const a = await hashSecreto('secreta123');
    const b = await hashSecreto('secreta123');
    expect(esHash(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(a).not.toContain('secreta123');
    expect(await verificarPassword('secreta123', a)).toEqual({ ok: true, rehash: false });
    expect((await verificarPassword('secreta124', a)).ok).toBe(false);
  });
  it('acepta una contraseña vieja en texto plano y pide re-hashearla', async () => {
    expect(await verificarPassword('clave123', 'clave123')).toEqual({ ok: true, rehash: true });
    expect(await verificarPassword('otra', 'clave123')).toEqual({ ok: false, rehash: false });
  });
  it('formato PBKDF2 autodescriptivo', async () => {
    expect(await hashSecreto('secreta123')).toMatch(/^pbkdf2\$600000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
  });
  it('acepta un hash scrypt de antes de 2026-10 y pide pasarlo a PBKDF2', async () => {
    const viejo = scryptViejo('secreta123');
    expect(await verificarPassword('secreta123', viejo)).toEqual({ ok: true, rehash: true });
    expect(await verificarPassword('secreta124', viejo)).toEqual({ ok: false, rehash: false });
  });
  it('PBKDF2 con otras iteraciones verifica y pide re-hashear', async () => {
    const sal = Buffer.alloc(16, 1);
    const h = pbkdf2Sync('secreta123', sal, 1000, 32, 'sha256');
    expect(await verificarPassword('secreta123', `pbkdf2$1000$${sal.toString('hex')}$${h.toString('hex')}`))
      .toEqual({ ok: true, rehash: true });
  });
  it('formato roto → no entra', async () => {
    expect((await verificarPassword('x', 'scrypt$roto')).ok).toBe(false);
    expect((await verificarPassword('x', 'scrypt$a$b$c$zz$zz')).ok).toBe(false);
    expect((await verificarPassword('x', 'pbkdf2$0$00$00')).ok).toBe(false);
    expect((await verificarPassword('x', 'pbkdf2$1000$zz$zz')).ok).toBe(false);
  });
  it('valida largo mínimo', () => {
    expect(validarPasswordNueva('corta')).toMatch(/al menos 8/);
    expect(validarPasswordNueva('         ')).toMatch(/al menos 8/);
    expect(validarPasswordNueva(undefined)).toMatch(/al menos 8/);
    expect(validarPasswordNueva('suficiente')).toBeNull();
  });
});

describe('login-limite', () => {
  it('bloquea al usuario al llegar al máximo de fallos y reinicia la cuenta', () => {
    const ahora = 1_000_000;
    let fallos = 0;
    for (let i = 1; i < LOGIN_MAX_FALLOS; i++) {
      const r = falloUsuario(fallos, ahora);
      expect(r.login_bloqueado_hasta).toBeNull();
      fallos = r.login_fallos;
    }
    const r = falloUsuario(fallos, ahora);
    expect(r.login_fallos).toBe(0);
    expect(bloqueoVigente(r.login_bloqueado_hasta, ahora)).toBeGreaterThan(0);
    expect(bloqueoVigente(r.login_bloqueado_hasta, ahora + 16 * 60_000)).toBe(0);
  });
  it('frena por IP y la ventana se vacía sola', () => {
    const ip = '10.0.0.99';
    const t = 5_000_000;
    for (let i = 0; i < IP_MAX_FALLOS; i++) registrarFalloIp(ip, t);
    expect(esperaIp(ip, t)).toBeGreaterThan(0);
    expect(esperaIp('10.0.0.100', t)).toBe(0);
    expect(esperaIp(ip, t + 16 * 60_000)).toBe(0);
  });
  it('IP: la del proxy (x-real-ip) o la última de x-forwarded-for, nunca la primera', () => {
    expect(ipCliente(new Headers({ 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' }))).toBe('1.2.3.4');
    expect(ipCliente(new Headers({ 'x-forwarded-for': '9.9.9.9, 5.6.7.8' }))).toBe('5.6.7.8');
    expect(ipCliente(new Headers())).toBe('desconocida');
  });
});
