import { describe, it, expect } from 'vitest';
import { esHash, hashPassword, validarPasswordNueva, verificarPassword } from './password';
import { LOGIN_MAX_FALLOS, bloqueoVigente, esperaIp, falloUsuario, ipCliente, registrarFalloIp, IP_MAX_FALLOS } from './login-limite';

describe('password', () => {
  it('hashea con sal (dos hashes distintos) y verifica', async () => {
    const a = await hashPassword('secreta123');
    const b = await hashPassword('secreta123');
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
  it('formato scrypt roto → no entra', async () => {
    expect((await verificarPassword('x', 'scrypt$roto')).ok).toBe(false);
    expect((await verificarPassword('x', 'scrypt$a$b$c$zz$zz')).ok).toBe(false);
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
