import { describe, it, expect } from 'vitest';
import { EMPLEADO_MODULOS, VENTAS_MODULOS, canAccessPath, getModulosForUser, getModulosParaMenu, modulosEfectivos } from './modulos';
import { isAdminRole, puedeGestionarUsuarios, rolValido, rutaPermitidaEmpleado } from './roles';

describe('modulosEfectivos', () => {
  it('empleado: siempre sus módulos personales, aunque tenga [] (que sería "todos")', () => {
    expect(modulosEfectivos('empleado', [])).toEqual([...EMPLEADO_MODULOS]);
    expect(modulosEfectivos('empleado', ['usuarios', 'organigrama'])).toEqual(['mi-asistencia', 'mis-recibos', 'mis-vacaciones']);
    expect(getModulosForUser(modulosEfectivos('empleado', [])).map((m) => m.href))
      .toEqual(['/admin/mi-asistencia', '/admin/mis-recibos', '/admin/mis-vacaciones']);
  });
  it('Vacaciones y Mis vacaciones son módulos separados', () => {
    expect(canAccessPath('/admin/mis-vacaciones', ['vacaciones'])).toBe(false);
    expect(canAccessPath('/admin/vacaciones', ['mis-vacaciones'])).toBe(false);
    expect(canAccessPath('/admin/vacaciones/seleccion/7', ['vacaciones'])).toBe(true);
  });
  it('ventas: siempre Leads y Padrón, aunque tenga [] u otros módulos guardados', () => {
    expect(modulosEfectivos('ventas', [])).toEqual([...VENTAS_MODULOS]);
    expect(modulosEfectivos('ventas', ['usuarios', 'nomina-tablero'])).toEqual(['leads', 'padron']);
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

describe('getModulosParaMenu', () => {
  it('oculta Nómina de los menús sin tocar el permiso', () => {
    const menu = getModulosParaMenu([]).map((m) => m.slug);
    expect(menu.some((s) => s.startsWith('nomina-'))).toBe(false);
    expect(menu).toContain('vacaciones');
    expect(menu).toContain('gestion-recibos');
    expect(getModulosForUser([]).map((m) => m.slug)).toContain('nomina-tablero');
    expect(getModulosParaMenu(['nomina-tablero', 'organigrama']).map((m) => m.slug)).toEqual(['organigrama']);
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
    '/admin/mis-vacaciones',
    '/admin/mis-vacaciones/documento',
    '/api/admin/mis-vacaciones',
    '/api/admin/organigrama/empleados/12/foto',
    '/api/me',
  ])('permite %s', (p) => expect(rutaPermitidaEmpleado(p)).toBe(true));

  it.each([
    '/',
    '/admin/nomina',
    '/admin/nomina/recibos',
    '/admin/gestion-recibos',
    '/admin/gestion-recibos/acta',
    '/admin/usuarios',
    '/admin/asistencia',
    '/admin/mis-recibos-falso',
    '/admin/vacaciones',
    '/api/admin/vacaciones',
    '/api/admin/vacaciones/seleccion/12',
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
  it('el rol agente (del manual separado) ya no existe', () => {
    expect(rolValido('admin')).toBe(true);
    expect(rolValido('empleado')).toBe(true);
    expect(rolValido('ventas')).toBe(true);
    expect(rolValido('agente')).toBe(false);
    expect(rolValido(null)).toBe(false);
  });
  it('el módulo usuarios solo lo ve el superadmin', () => {
    expect(modulosEfectivos('admin', ['usuarios', 'organigrama'])).toEqual(['organigrama']);
    expect(getModulosForUser(modulosEfectivos('admin', [])).some((m) => m.slug === 'usuarios')).toBe(false);
    expect(getModulosForUser(modulosEfectivos('superadmin', [])).some((m) => m.slug === 'usuarios')).toBe(true);
  });
});
