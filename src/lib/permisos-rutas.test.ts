import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { puedeUsarApi, puedeVerPagina, reglaApi, rutaInternaSegura } from './permisos-rutas';

/** Todas las rutas de `src/app/api/admin/**` como pathname (los `[id]` pasan a `1`). */
function rutasAdmin(): string[] {
  const base = join(process.cwd(), 'src', 'app', 'api', 'admin');
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const nombre of readdirSync(dir)) {
      const p = join(dir, nombre);
      if (statSync(p).isDirectory()) walk(p);
      else if (nombre === 'route.ts') {
        const rel = relative(base, dir).split(sep).map((s) => (s.startsWith('[') ? '1' : s));
        out.push(['/api/admin', ...rel].join('/'));
      }
    }
  };
  walk(base);
  return out;
}

describe('reglaApi', () => {
  it('toda ruta de /api/admin tiene una regla (sin regla = solo superadmin)', () => {
    const sinRegla = rutasAdmin().filter((r) => !reglaApi(r));
    expect(sinRegla).toEqual([]);
  });
  it('gana el prefijo más largo', () => {
    expect(reglaApi('/api/admin/nomina/maestro')?.prefijo).toBe('/api/admin/nomina');
    expect(reglaApi('/api/admin/nomina/firma/aviso')?.prefijo).toBe('/api/admin/nomina/firma');
    expect(reglaApi('/api/admin/nominaX')).toBeNull();
  });
});

describe('puedeUsarApi', () => {
  it('un admin con solo Películas no toca nómina ni asistencia', () => {
    expect(puedeUsarApi('/api/admin/nomina/maestro', 'GET', 'admin', ['peliculas'])).toBe(false);
    expect(puedeUsarApi('/api/admin/asistencia/fichadas', 'GET', 'admin', ['peliculas'])).toBe(false);
    expect(puedeUsarApi('/api/admin/on-demand', 'POST', 'admin', ['peliculas'])).toBe(true);
  });
  it('superadmin y admin sin restricción ([] = todos) pasan', () => {
    expect(puedeUsarApi('/api/admin/nomina/liquidacion/cerrar', 'POST', 'superadmin', ['peliculas'])).toBe(true);
    expect(puedeUsarApi('/api/admin/nomina/liquidacion/cerrar', 'POST', 'admin', [])).toBe(true);
  });
  it('la gestión de usuarios nunca es de un admin, aunque tenga todos los módulos', () => {
    expect(puedeUsarApi('/api/admin/usuarios', 'GET', 'admin', [])).toBe(false);
    expect(puedeUsarApi('/api/admin/usuarios', 'GET', 'admin', ['usuarios'])).toBe(false);
  });
  it('lectura cruzada: el organigrama lee horarios y abre recibos, pero no escribe', () => {
    expect(puedeUsarApi('/api/admin/asistencia/horarios', 'GET', 'admin', ['organigrama'])).toBe(true);
    expect(puedeUsarApi('/api/admin/asistencia/horarios', 'POST', 'admin', ['organigrama'])).toBe(false);
    const pdf = '/api/admin/nomina/firma/recibos/0b6f1c2e-6a1d-4c1e-9d59-3f1c2a4b5d6e/pdf';
    expect(puedeUsarApi(pdf, 'GET', 'admin', ['organigrama'])).toBe(true);
    expect(puedeUsarApi(pdf, 'GET', 'admin', ['gestion-recibos'])).toBe(true);
    expect(puedeUsarApi('/api/admin/nomina/firma/aviso', 'POST', 'admin', ['organigrama'])).toBe(false);
  });
  it('el organigrama solo abre el PDF: el resto de firma es de RR.HH.', () => {
    for (const p of ['panel', 'casos', 'aviso', 'recibos/0b6f1c2e-6a1d-4c1e-9d59-3f1c2a4b5d6e/papel']) {
      expect(puedeUsarApi(`/api/admin/nomina/firma/${p}`, 'GET', 'admin', ['organigrama'])).toBe(false);
    }
  });
  it('lo de RR.HH. de recibos es solo de Gestión de recibos', () => {
    expect(puedeUsarApi('/api/admin/nomina/finnegans/liquidaciones/buscar', 'POST', 'admin', ['nomina-tablero'])).toBe(false);
    expect(puedeUsarApi('/api/admin/nomina/adhesiones', 'POST', 'admin', ['gestion-recibos'])).toBe(true);
    // El estado y la config de nómina los comparten todas las pestañas y la gestión de recibos.
    expect(puedeUsarApi('/api/admin/nomina/estado', 'GET', 'admin', ['gestion-recibos'])).toBe(true);
  });
  it('rutas personales y la foto: cualquier admin (cada ruta se limita a lo propio)', () => {
    expect(puedeUsarApi('/api/admin/mis-recibos', 'GET', 'admin', ['peliculas'])).toBe(true);
    expect(puedeUsarApi('/api/admin/organigrama/empleados/7/foto', 'GET', 'admin', ['asistencia'])).toBe(true);
    expect(puedeUsarApi('/api/admin/organigrama/empleados/7', 'GET', 'admin', ['asistencia'])).toBe(false);
  });
  it('ventas: solo las APIs de Leads y Padrón', () => {
    expect(puedeUsarApi('/api/admin/leads', 'GET', 'ventas', [])).toBe(true);
    expect(puedeUsarApi('/api/admin/leads/5', 'PATCH', 'ventas', [])).toBe(true);
    expect(puedeUsarApi('/api/admin/padron/cargar', 'POST', 'ventas', [])).toBe(true);
    // Lo guardado en `modulos` no cuenta, y lo que es de "cualquier admin" tampoco.
    expect(puedeUsarApi('/api/admin/nomina/estado', 'GET', 'ventas', ['nomina-tablero'])).toBe(false);
    expect(puedeUsarApi('/api/admin/usuarios', 'GET', 'ventas', [])).toBe(false);
    expect(puedeUsarApi('/api/admin/mis-recibos', 'GET', 'ventas', [])).toBe(false);
    expect(puedeUsarApi('/api/admin/organigrama/empleados/7/foto', 'GET', 'ventas', [])).toBe(false);
    expect(puedeUsarApi('/api/bonificaciones', 'POST', 'ventas', [])).toBe(false);
  });
  it('los que no son admin nunca pasan', () => {
    expect(puedeUsarApi('/api/admin/mis-recibos', 'GET', 'empleado', [])).toBe(false);
    expect(puedeUsarApi('/api/bonificaciones', 'POST', 'agente', [])).toBe(false);
  });
});

describe('rutaInternaSegura', () => {
  it('acepta rutas del sitio y rechaza otros hosts', () => {
    expect(rutaInternaSegura('/admin/mis-recibos')).toBe('/admin/mis-recibos');
    expect(rutaInternaSegura('/admin/asistencia?tab=calendario')).toBe('/admin/asistencia?tab=calendario');
    expect(rutaInternaSegura('https://evil.example')).toBeNull();
    expect(rutaInternaSegura('//evil.example')).toBeNull();
    expect(rutaInternaSegura('/\\evil.example')).toBeNull();
    expect(rutaInternaSegura('/\tevil')).toBeNull();
    expect(rutaInternaSegura(null)).toBeNull();
  });
});

describe('puedeVerPagina', () => {
  it('páginas de módulo según los módulos; el resto del panel, cualquier admin', () => {
    expect(puedeVerPagina('/admin/nomina/tablero', 'admin', ['peliculas'])).toBe(false);
    expect(puedeVerPagina('/admin/peliculas', 'admin', ['peliculas'])).toBe(true);
    expect(puedeVerPagina('/admin', 'admin', ['peliculas'])).toBe(true);
    expect(puedeVerPagina('/admin/usuarios', 'admin', [])).toBe(false);
    expect(puedeVerPagina('/admin/usuarios', 'superadmin', [])).toBe(true);
    expect(puedeVerPagina('/admin', 'agente', [])).toBe(false);
  });
  it('ventas: el inicio y sus dos módulos, nada más', () => {
    expect(puedeVerPagina('/admin', 'ventas', [])).toBe(true);
    expect(puedeVerPagina('/admin/leads', 'ventas', [])).toBe(true);
    expect(puedeVerPagina('/admin/padron', 'ventas', [])).toBe(true);
    expect(puedeVerPagina('/admin/peliculas', 'ventas', ['peliculas'])).toBe(false);
    expect(puedeVerPagina('/admin/nomina/imprimir', 'ventas', [])).toBe(false);
    expect(puedeVerPagina('/admin/mi-asistencia', 'ventas', [])).toBe(false);
  });
});
