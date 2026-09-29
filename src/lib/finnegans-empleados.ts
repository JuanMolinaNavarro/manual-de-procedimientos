/**
 * Parte pura de la carga de empleados de prueba desde el Excel de liquidaciones
 * de Finnegans (hoja RESUMENLIQ). La usa `scripts/cargar-empleados-finnegans.ts`
 * (solo DB de desarrollo). Una empresa por organigrama; un área por convenio.
 */

import { fechaIso, soloDigitos } from './recibos-finnegans-calc';

export interface PersonaFinn {
  cuil: string; // tal cual Finnegans: 20-12345678-9
  cuilDigitos: string;
  nombre: string;
  apellido: string;
  numeroLegajo: string;
  fechaIngreso: string; // ISO o ''
  fechaEgreso: string; // ISO o ''
  categoria: string;
  convenio: string; // nombre del convenio en Finnegans (= área en el organigrama)
  obraSocial: string;
  cbu: string;
  basico: number;
  activo: boolean;
}

export interface EmpresaFinn {
  nombre: string;
  cuit: string; // tal cual Finnegans: 30-12345678-9
  domicilio: string;
  personas: PersonaFinn[];
}

/** Convenio de Finnegans → valor del select de Nómina (`CONVENIOS`) + CCT. */
export function convenioNomina(convenioFinnegans: string): { convenio: string; cct: string } {
  if (/fuera de convenio/i.test(convenioFinnegans)) return { convenio: 'Fuera de convenio', cct: '' };
  return { convenio: 'Otro convenio', cct: convenioFinnegans.trim() };
}

function txt(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

/**
 * Agrupa las filas por empresa y deja una persona por CUIL con los datos de su
 * liquidación más reciente (la de mayor FECHAHASTA; empate → la última fila).
 */
export function agruparEmpleados(filas: Record<string, unknown>[]): EmpresaFinn[] {
  const empresas = new Map<string, EmpresaFinn & { hasta: Map<string, string> }>();
  for (const f of filas) {
    const cuilDigitos = soloDigitos(f.IDENTIFICACIONTRIBUTARIANUMERO);
    const nombreEmpresa = txt(f.EMPRESANOMBRE);
    if (cuilDigitos.length !== 11 || !nombreEmpresa) continue;
    let emp = empresas.get(nombreEmpresa);
    if (!emp) {
      emp = { nombre: nombreEmpresa, cuit: txt(f.EMPRESACUIT), domicilio: txt(f.EMPRESADIRECCION), personas: [], hasta: new Map() };
      empresas.set(nombreEmpresa, emp);
    }
    const hasta = fechaIso(f.FECHAHASTA);
    const previa = emp.hasta.get(cuilDigitos);
    if (previa !== undefined && previa > hasta) continue;
    const egreso = fechaIso(f.FECHAEGRESO);
    const persona: PersonaFinn = {
      cuil: txt(f.IDENTIFICACIONTRIBUTARIANUMERO),
      cuilDigitos,
      nombre: txt(f.PERSONANOMBRE),
      apellido: txt(f.PERSONAAPELLIDO),
      numeroLegajo: txt(f.NUMEROLEGAJO),
      fechaIngreso: fechaIso(f.FECHAINGRESO),
      fechaEgreso: egreso,
      categoria: txt(f.CATEGORIA),
      convenio: txt(f.CONVENIO) || 'Sin convenio',
      obraSocial: txt(f.OBRASOCIAL),
      cbu: txt(f.CBU),
      basico: Number(f.BASICO) || 0,
      activo: !egreso,
    };
    emp.hasta.set(cuilDigitos, hasta);
    const i = emp.personas.findIndex((p) => p.cuilDigitos === cuilDigitos);
    if (i >= 0) emp.personas[i] = persona;
    else emp.personas.push(persona);
  }
  return [...empresas.values()]
    .map((e) => ({
      nombre: e.nombre,
      cuit: e.cuit,
      domicilio: e.domicilio,
      personas: e.personas.sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es')),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
