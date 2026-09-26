import { describe, it, expect } from 'vitest';
import { EMPLEADO_MODULOS, canAccessPath, getModulosForUser, modulosEfectivos } from './modulos';
import { isAdminRole, puedeGestionarPin, puedeGestionarUsuarios, rutaPermitidaEmpleado } from './roles';

describe('modulosEfectivos', () => {
  it('empleado: siempre sus dos módulos, aunque tenga [] (que sería "todos")', () => {
    expect(modulosEfectivos('empleado', [])).toEqual([...EMPLEADO_MODULOS]);
    expect(modulosEfectivos('empleado', ['usuarios', 'organigrama'])).toEqual(['mi-asistencia', 'mis-recibos']);
    expect(getModulosForUser(modulosEfectivos('empleado', [])).map((m) => m.href)).toEqual(['/admin/mi-asistencia', '/admin/mis-recibos']);
  });
  it('superadmin: todos; admin: lo guardado (sin usuarios)', () => {
    expect(modulosEfectivos('superadmin', ['usuarios'])).toEqual([]);
    expect(modulosEfectivos('admin', ['organigrama'])).toEqual(['organigrama']);
    // admin sin restricción ([] = todos) ve todo menos la gestión de usuarios
    expect(modulosEfectivos('admin', null)).not.toContain('usuarios');
    expect(modulosEfectivos('admin', null)).toContain('organigrama');
  });
  it('admin con solo `usuarios` no queda con [] (que significaría todos)', () => {
    const m = modulosEfectivos('admin', ['usuarios']);
    expect(m.length).toBeGreaterThan(0);
    expect(getModulosForUser(m)).toEqual([]);
    expect(canAccessPath('/admin/nomina/tablero', m)).toBe(false);
  });
  it('Gestión de recibos y Mis recibos son módulos separados', () => {
    expect(canAccessPath('/admin/mis-recibos', ['gestion-recibos'])).toBe(false);
    expect(canAccessPath('/admin/gestion-recibos', ['mis-recibos'])).toBe(false);
    expect(canAccessPath('/admin/gestion-recibos/acta', ['gestion-recibos'])).toBe(true);
    // Ya no es una pestaña de Nómina: el permiso de nómina no la cubre.
    expect(canAccessPath('/admin/gestion-recibos', ['nomina-liquidacion', 'nomina-parametros'])).toBe(false);
  });
  it('el slug viejo nomina-recibos guardado en un usuario se lee como gestion-recibos', () => {
    expect(modulosEfectivos('admin', ['nomina-recibos', 'organigrama'])).toEqual(['gestion-recibos', 'organigrama']);
    expect(canAccessPath('/admin/gestion-recibos', modulosEfectivos('admin', ['nomina-recibos']))).toBe(true);
  });
});

describe('rol empleado', () => {
  it('no es admin', () => expect(isAdminRole('empleado')).toBe(false));

  it.each([
    '/admin',
    '/admin/mi-asistencia',
    '/admin/mis-recibos',
    '/api/admin/mi-asistencia',
    '/api/admin/mis-recibos',
    '/api/admin/mis-recibos/0b7f3c2e-1111-4222-8333-444455556666/pdf',
    '/api/admin/organigrama/empleados/12/foto',
    '/api/me',
  ])('permite %s', (p) => expect(rutaPermitidaEmpleado(p)).toBe(true));

  it.each([
    '/',
    '/retencion/inicio',
    '/admin/nomina',
    '/admin/nomina/recibos',
    '/admin/gestion-recibos',
    '/admin/gestion-recibos/acta',
    '/admin/usuarios',
    '/admin/asistencia',
    '/admin/mis-recibos-falso',
    '/api/admin/nomina/recibos',
    '/api/admin/nomina/finnegans/liquidaciones',
    '/api/admin/usuarios',
    '/api/admin/organigrama/empleados/12',
    '/api/admin/organigrama/empleados/12/foto/x',
    '/api/bonificaciones',
  ])('bloquea %s', (p) => expect(rutaPermitidaEmpleado(p)).toBe(false));
});

describe('separación de funciones', () => {
  it('solo el superadmin gestiona usuarios', () => {
    expect(puedeGestionarUsuarios('superadmin')).toBe(true);
    for (const r of ['admin', 'empleado', 'agente', null]) expect(puedeGestionarUsuarios(r)).toBe(false);
  });
  it('el superadmin nunca define ni cambia PINs; el admin (RR.HH.) sí', () => {
    expect(puedeGestionarPin('superadmin')).toBe(false);
    expect(puedeGestionarPin('admin')).toBe(true);
    for (const r of ['empleado', 'agente', undefined]) expect(puedeGestionarPin(r)).toBe(false);
  });
  it('el módulo usuarios solo lo ve el superadmin', () => {
    expect(modulosEfectivos('admin', ['usuarios', 'organigrama'])).toEqual(['organigrama']);
    expect(getModulosForUser(modulosEfectivos('admin', [])).some((m) => m.slug === 'usuarios')).toBe(false);
    expect(getModulosForUser(modulosEfectivos('superadmin', [])).some((m) => m.slug === 'usuarios')).toBe(true);
  });
});
