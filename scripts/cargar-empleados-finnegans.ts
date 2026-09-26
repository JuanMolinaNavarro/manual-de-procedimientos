/**
 * Carga de empleados de PRUEBA desde el Excel de liquidaciones de Finnegans
 * (hoja RESUMENLIQ). SOLO para la DB de desarrollo.
 *
 *   npx tsx --env-file=.env.local scripts/cargar-empleados-finnegans.ts "<ruta.xlsx>"
 *
 * Por cada empresa del Excel:
 *  - un organigrama con el nombre de la empresa (se reutiliza si ya existe) y su
 *    CUIT en Nómina › Datos del empleador (vincula las liquidaciones de Finnegans);
 *  - un área por convenio ("Satsaid 223/75", "Fuera de Convenio");
 *  - una ficha por persona (rol = categoría, inactiva si tiene egreso) con su
 *    maestro de nómina (CUIL, ingreso, categoría, convenio, obra social, CBU, básico);
 *  - un usuario rol `empleado` con usuario = CUIL (solo dígitos) y contraseña de
 *    desarrollo `empleado123` (texto plano, como todo el sistema). Si el usuario ya
 *    existe no se le cambia la contraseña. El usuario queda activo aunque la ficha
 *    esté dada de baja: quien se va sigue pudiendo bajar sus recibos.
 * Idempotente: fichas por CUIL dentro del organigrama, usuarios por nombre de usuario.
 */

import ExcelJS from 'exceljs';
import { prisma } from '../src/lib/prisma';
import { createArea, createEmpleado, createOrganigrama } from '../src/lib/organigrama';
import { updateConfig } from '../src/lib/nomina';
import { agruparEmpleados, convenioNomina } from '../src/lib/finnegans-empleados';
import { soloDigitos } from '../src/lib/recibos-finnegans-calc';

const PASSWORD_DEV = 'empleado123';
const COLORES = ['#0a84ff', '#30d158', '#ff9f0a', '#bf5af2', '#ff375f'];
const QUIEN = 'carga-finnegans';

function abortar(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

/** Protección: nunca contra otra base que la de desarrollo (Docker vía socat en :5544). */
function verificarDestino(): void {
  const raw = process.env.DATABASE_URL;
  if (!raw) abortar('Falta DATABASE_URL (correr con --env-file=.env.local).');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    abortar('DATABASE_URL inválida.');
  }
  const host = url.hostname;
  if (!['localhost', '127.0.0.1'].includes(host) || url.port !== '5544') {
    abortar(`Destino no permitido: ${host}:${url.port || '(default)'}. Este script solo corre contra la DB de desarrollo en localhost:5544.`);
  }
  console.log(`Destino: ${host}:${url.port}/${url.pathname.slice(1)}`);
}

/** "JUAN CARLOS" → "Juan Carlos" (los nombres de Finnegans vienen en mayúsculas). */
function titulo(s: string): string {
  return s
    .toLocaleLowerCase('es')
    .replace(/(^|[\s'-])(\p{L})/gu, (_m, sep: string, l: string) => sep + l.toLocaleUpperCase('es'));
}

async function leerExcel(ruta: string): Promise<Record<string, unknown>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ruta);
  const ws = wb.getWorksheet('RESUMENLIQ');
  if (!ws) abortar('El Excel no tiene la hoja RESUMENLIQ.');
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, col) => {
    headers[col] = String(c.value ?? '').trim();
  });
  const filas: Record<string, unknown>[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const o: Record<string, unknown> = {};
    row.eachCell({ includeEmpty: true }, (c, col) => {
      const h = headers[col];
      if (!h) return;
      const v = c.value;
      o[h] = v && typeof v === 'object' && 'result' in v ? (v as { result: unknown }).result : v;
    });
    filas.push(o);
  });
  return filas;
}

async function main() {
  const ruta = process.argv[2];
  if (!ruta) abortar('Uso: npx tsx --env-file=.env.local scripts/cargar-empleados-finnegans.ts "<ruta.xlsx>"');
  verificarDestino();

  const filas = await leerExcel(ruta);
  const empresas = agruparEmpleados(filas);
  console.log(`Excel: ${filas.length} filas, ${empresas.length} empresas.\n`);

  const tot = { organigramas: 0, areas: 0, fichasNuevas: 0, fichasActualizadas: 0, usuariosNuevos: 0, usuariosActualizados: 0, avisos: 0 };

  for (const emp of empresas) {
    let org = await prisma.organigrama.findFirst({ where: { nombre: emp.nombre }, orderBy: { id: 'asc' } });
    if (!org) {
      org = await createOrganigrama(emp.nombre, emp.domicilio || null);
      tot.organigramas++;
    }
    await updateConfig(org.id, { empresa: { razonSocial: emp.nombre, cuit: emp.cuit, domicilio: emp.domicilio } }, QUIEN);

    const convenios = [...new Set(emp.personas.map((p) => p.convenio))].sort();
    for (const [i, nombre] of convenios.entries()) {
      const existe = await prisma.orgArea.findFirst({ where: { organigrama_id: org.id, nombre } });
      if (!existe) {
        await createArea({ organigrama_id: org.id, nombre, color: COLORES[i % COLORES.length], is_top: false });
        tot.areas++;
      }
    }

    const maestros = await prisma.nominaEmpleado.findMany({
      where: { empleado: { organigrama_id: org.id } },
      select: { empleado_id: true, cuil: true },
    });
    const fichaPorCuil = new Map(maestros.map((m) => [soloDigitos(m.cuil), m.empleado_id]));

    for (const p of emp.personas) {
      const nombreCompleto = titulo(`${p.nombre} ${p.apellido}`.trim());
      const ficha = {
        nombre: nombreCompleto,
        rol: p.categoria || 'Sin categoría',
        area: p.convenio,
        estado: p.activo ? 'active' : 'inactive',
      };
      let empleadoId = fichaPorCuil.get(p.cuilDigitos);
      if (empleadoId) {
        await prisma.orgEmpleado.update({ where: { id: empleadoId }, data: { ...ficha, updated_by: QUIEN } });
        tot.fichasActualizadas++;
      } else {
        const creada = await createEmpleado({ organigrama_id: org.id, ...ficha, created_by: QUIEN } as Parameters<typeof createEmpleado>[0]);
        empleadoId = creada.id;
        tot.fichasNuevas++;
      }
      const { convenio, cct } = convenioNomina(p.convenio);
      const maestro = {
        cuil: p.cuil,
        fecha_ingreso: p.fechaIngreso,
        categoria: p.categoria,
        convenio,
        cct,
        obra_social: p.obraSocial,
        cbu: p.cbu,
        basico: p.basico,
        updated_by: QUIEN,
      };
      await prisma.nominaEmpleado.upsert({
        where: { empleado_id: empleadoId },
        create: { empleado_id: empleadoId, ...maestro },
        update: maestro,
      });

      const nombre = titulo(p.nombre);
      const apellido = titulo(p.apellido);
      const usuario = await prisma.usuario.findUnique({ where: { usuario: p.cuilDigitos } });
      const otroConLaFicha = await prisma.usuario.findFirst({ where: { empleado_id: empleadoId, NOT: { usuario: p.cuilDigitos } } });
      if (otroConLaFicha) {
        console.warn(`  ⚠ ${nombreCompleto}: la ficha ya está vinculada al usuario "${otroConLaFicha.usuario}"; no se crea el suyo.`);
        tot.avisos++;
        continue;
      }
      if (!usuario) {
        await prisma.usuario.create({
          data: { usuario: p.cuilDigitos, password: PASSWORD_DEV, rol: 'empleado', nombre, apellido, empleado_id: empleadoId, isActive: true },
        });
        tot.usuariosNuevos++;
      } else {
        await prisma.usuario.update({
          where: { id: usuario.id },
          data: { rol: 'empleado', nombre, apellido, empleado_id: empleadoId },
        });
        tot.usuariosActualizados++;
      }
    }
    console.log(`✔ ${emp.nombre} (org ${org.id}): ${emp.personas.length} personas, áreas ${convenios.join(' / ')}`);
  }

  console.log('\nResumen:', tot);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
