/**
 * Nómina — constantes puras (sin Prisma ni React). Portadas del prototipo
 * PayRoll Assistant: defaults del régimen general argentino, textos de ayuda,
 * rubros del recibo modelo (Decreto 407/2026, Anexo III) y tipos de dominio.
 *
 * Todo porcentaje o regla es editable en Parámetros: acá viven solo los
 * valores por defecto.
 */

// ─── Parámetros del motor ────────────────────────────────────────────────────

export interface Params {
  jubilacion: number;
  ley19032: number;
  obraSocial: number;
  sindicato: number;
  // Contribuciones a cargo del empleador, desagregadas en los rubros que exige
  // el recibo modelo. Suman 26,4 % + ART por defecto.
  cSegSocial: number;
  cObraSocial: number;
  cInssjp: number;
  art: number;
  cSindical: number;
  cCamara: number;
  cOtros: number;
  presentismo: number;
  antiguedadAnio: number;
  divisorHora: number;
  divisorVacaciones: number;
  topeDeducciones: number;
  alertaVariacion: number;
}
export type ParamKey = keyof Params;

export const DEFAULT_PARAMS: Params = {
  jubilacion: 11, ley19032: 3, obraSocial: 3, sindicato: 2,
  cSegSocial: 18.9, cObraSocial: 6, cInssjp: 1.5, art: 4, cSindical: 0, cCamara: 0, cOtros: 0,
  presentismo: 8.33, antiguedadAnio: 1,
  divisorHora: 200, divisorVacaciones: 25, topeDeducciones: 20, alertaVariacion: 30,
};

export const PARAM_KEYS = Object.keys(DEFAULT_PARAMS) as ParamKey[];

/** [etiqueta, ayuda] de cada parámetro, en el orden de la pantalla. */
export const PARAM_META: Record<ParamKey, [string, string]> = {
  jubilacion:       ['Jubilación (empleado) %', 'Aporte jubilatorio retenido al empleado sobre lo remunerativo.'],
  ley19032:         ['Ley 19.032 / PAMI %', 'Aporte del empleado al INSSJP sobre lo remunerativo.'],
  obraSocial:       ['Obra social %', 'Aporte del empleado a su obra social.'],
  sindicato:        ['Cuota sindical %', 'Se descuenta solo a empleados marcados como afiliados en el Maestro.'],
  cSegSocial:       ['Contrib. seguridad social %', 'SIPA + Fondo Nacional de Empleo + Asignaciones Familiares. Costo empresa; va en el recibo (rubro «seguridad social»).'],
  cObraSocial:      ['Contrib. obra social %', 'Contribución patronal a la obra social del empleado. Costo empresa.'],
  cInssjp:          ['Contrib. INSSJP / PAMI %', 'Contribución patronal al INSSJP. Costo empresa.'],
  art:              ['ART %', 'Alícuota de la aseguradora de riesgos (varía por empresa: verificar con la póliza). Costo empresa.'],
  cSindical:        ['Contrib. sindical patronal %', 'Solo si el convenio impone una contribución del empleador al sindicato. 0 si no aplica.'],
  cCamara:          ['Contrib. cámaras empresariales %', 'Aportes convencionales a cámaras o entidades empresarias. 0 si no aplica.'],
  cOtros:           ['Otras contribuciones %', 'Cualquier otro concepto a cargo del empleador por ley o convenio.'],
  presentismo:      ['Presentismo %', 'Se paga si el empleado no tuvo faltas injustificadas. Poné 0 para desactivarlo.'],
  antiguedadAnio:   ['Antigüedad % por año', 'Porcentaje del básico por cada año de antigüedad (según convenio).'],
  divisorHora:      ['Divisor valor hora', 'Horas mensuales de jornada completa. Valor hora = básico ÷ divisor.'],
  divisorVacaciones: ['Divisor vacacional', 'Divisor del plus vacacional según LCT (básico ÷ 25 vs ÷ 30).'],
  topeDeducciones:  ['Tope de deducciones %', 'Si los descuentos superan este % del bruto, se dispara una alerta.'],
  alertaVariacion:  ['Alerta variación %', 'Si el neto varía más que esto vs el último período cerrado, alerta.'],
};

/** Rubros del costo laboral (orden del Anexo III) → [rubro, nombre, clave de parámetro]. */
export const RUBROS_EMPLEADOR: readonly (readonly [string, string, ParamKey])[] = [
  ['sindical',   'Sindical (contribución patronal)', 'cSindical'],
  ['segsocial',  'Seguridad social (SIPA, FNE, AAFF)', 'cSegSocial'],
  ['obrasocial', 'Obra social (contribución)', 'cObraSocial'],
  ['inssjp',     'I.N.S.S.J.P. (contribución)', 'cInssjp'],
  ['art',        'A.R.T.', 'art'],
  ['camara',     'Cámaras o entidades empresariales', 'cCamara'],
  ['otros',      'Otros rubros', 'cOtros'],
];

/**
 * Mergea parámetros guardados sobre los defaults. Migra el viejo parámetro
 * único `contribuciones` repartiéndolo en los rubros nuevos sin cambiar el
 * total (26,4 → 18,9 + 6 + 1,5).
 */
export function mergeParams(raw: unknown): Params {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Params = { ...DEFAULT_PARAMS };
  if (typeof src.contribuciones === 'number' && src.cSegSocial === undefined) {
    out.cSegSocial = Math.max(0, Math.round((src.contribuciones - 7.5) * 100) / 100);
  }
  for (const k of PARAM_KEYS) {
    const v = src[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

// ─── Datos del empleador ─────────────────────────────────────────────────────

export interface Empresa {
  razonSocial: string;
  cuit: string;
  domicilio: string;
  lugarPagoCargas: string;
  bancoDepositos: string;
  ultimoDepositoFecha: string;
  ultimoDepositoPeriodo: string;
  cctDefault: string;
}
export type EmpresaKey = keyof Empresa;

export const DEFAULT_EMPRESA: Empresa = {
  razonSocial: '', cuit: '', domicilio: '', lugarPagoCargas: '', bancoDepositos: '',
  ultimoDepositoFecha: '', ultimoDepositoPeriodo: '', cctDefault: '',
};

/** [clave, etiqueta, ayuda] de los campos del empleador (recibo, sección 1). */
export const EMPRESA_CAMPOS: readonly (readonly [EmpresaKey, string, string])[] = [
  ['razonSocial', 'Razón social', 'Nombre íntegro o razón social del empleador.'],
  ['cuit', 'CUIT', 'Formato 30-12345678-9.'],
  ['domicilio', 'Domicilio', 'Domicilio legal del empleador.'],
  ['lugarPagoCargas', 'Lugar de pago de cargas sociales', 'Banco o entidad donde se depositan aportes y contribuciones.'],
  ['bancoDepositos', 'Banco interviniente', 'Banco por el que se realiza el depósito (art. 12 Dec-Ley 17.250/67).'],
  ['ultimoDepositoFecha', 'Fecha del último depósito', 'Fecha del último pago de aportes y contribuciones.'],
  ['ultimoDepositoPeriodo', 'Período del último depósito', 'Ej.: 2026-07.'],
  ['cctDefault', 'Convenio colectivo (por defecto)', 'Ej.: CCT 130/75. Se puede cambiar por persona en el Maestro.'],
];

export function mergeEmpresa(raw: unknown): Empresa {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Empresa = { ...DEFAULT_EMPRESA };
  for (const k of Object.keys(DEFAULT_EMPRESA) as EmpresaKey[]) {
    const v = src[k];
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

// ─── Maestro y novedades ─────────────────────────────────────────────────────

export interface Maestro {
  cuil: string;
  fechaIngreso: string; // ISO yyyy-mm-dd o ''
  basico: number;
  categoria: string;
  convenio: string;
  cct: string;
  afiliado: boolean;
  obraSocial: string;
  cbu: string;
  incluir: boolean;
}

export const DEFAULT_MAESTRO: Maestro = {
  cuil: '', fechaIngreso: '', basico: 0, categoria: '', convenio: 'Fuera de convenio',
  cct: '', afiliado: false, obraSocial: '', cbu: '', incluir: true,
};

export const CONVENIOS = [
  'Fuera de convenio', 'Comercio (CCT 130/75)', 'UOM', 'UOCRA', 'Gastronómicos', 'Otro convenio',
] as const;

export interface Novedad {
  he50: number;
  he100: number;
  faltasInj: number;
  diasSinGoce: number;
  diasVacaciones: number;
  comisiones: number;
  premios: number;
  sac: number;
  asigFamiliares: number;
  ganancias: number;
  adelantos: number;
  embargos: number;
  notas: string;
}
export type NovedadNumKey = Exclude<keyof Novedad, 'notas'>;

export const DEFAULT_NOVEDAD: Novedad = {
  he50: 0, he100: 0, faltasInj: 0, diasSinGoce: 0, diasVacaciones: 0, comisiones: 0, premios: 0,
  sac: 0, asigFamiliares: 0, ganancias: 0, adelantos: 0, embargos: 0, notas: '',
};

/** Columnas numéricas de la carga mensual, con su ayuda y el paso del input. */
export const NOVEDAD_COLS: readonly { key: NovedadNumKey; label: string; desc: string; step: number }[] = [
  { key: 'he50', label: 'HE 50%', desc: 'Horas extra comunes (días hábiles). Cargá cantidad de horas.', step: 0.5 },
  { key: 'he100', label: 'HE 100%', desc: 'Horas extra en feriados, domingos o nocturnas. Cantidad de horas.', step: 0.5 },
  { key: 'faltasInj', label: 'Faltas inj.', desc: 'Días de ausencia sin justificar. Descuenta el día y hace perder el presentismo.', step: 1 },
  { key: 'diasSinGoce', label: 'Días s/goce', desc: 'Licencias sin goce de sueldo. Descuenta el día pero no el presentismo.', step: 1 },
  { key: 'diasVacaciones', label: 'Días vac.', desc: 'Días de vacaciones gozados en el mes. Genera el plus vacacional.', step: 1 },
  { key: 'comisiones', label: 'Comisiones $', desc: 'Resultado de ventas del mes, en pesos. Es remunerativo.', step: 100 },
  { key: 'premios', label: 'Premios $', desc: 'Bonos y reconocimientos en pesos (acá caen los bonos otorgados). Remunerativo.', step: 100 },
  { key: 'sac', label: 'SAC $', desc: 'Aguinaldo. Solo en jun/dic: mejor sueldo del semestre ÷ 2.', step: 100 },
  { key: 'asigFamiliares', label: 'Asig. fam. $', desc: 'Asignaciones por hijos u otras cargas. No remunerativo, no paga aportes.', step: 100 },
  { key: 'ganancias', label: 'Ganancias $', desc: 'Retención de Imp. a las Ganancias que calcule el contador.', step: 100 },
  { key: 'adelantos', label: 'Adelantos $', desc: 'Anticipos de sueldo ya pagados en el mes. Se descuentan del neto.', step: 100 },
  { key: 'embargos', label: 'Embargos $', desc: 'Descuentos por orden judicial.', step: 100 },
];

// ─── Conceptos adicionales ───────────────────────────────────────────────────

export type ConceptoTipo = 'rem' | 'norem' | 'ded';
export type ConceptoCalculo = 'monto' | 'pct_basico' | 'pct_rem';

export interface Concepto {
  id: number;
  nombre: string;
  tipo: ConceptoTipo;
  calculo: ConceptoCalculo;
  valor: number;
  activo: boolean;
  orden: number;
}

export const CONCEPTO_TIPOS: readonly [ConceptoTipo, string][] = [
  ['rem', 'Haber remunerativo'], ['norem', 'Haber no remunerativo'], ['ded', 'Deducción'],
];
export const CONCEPTO_CALCULOS: readonly [ConceptoCalculo, string][] = [
  ['monto', 'Monto fijo $'], ['pct_basico', '% del básico'], ['pct_rem', '% del remunerativo'],
];

export const DEFAULT_CONCEPTOS: Omit<Concepto, 'id'>[] = [
  { nombre: 'Premio por objetivos', tipo: 'rem', calculo: 'monto', valor: 0, activo: false, orden: 0 },
  { nombre: 'Viáticos no remunerativos', tipo: 'norem', calculo: 'monto', valor: 0, activo: false, orden: 1 },
];

// ─── Bonos y reconocimientos (gamification) ──────────────────────────────────
// ambito: 'empresa' = común a todos · nombre de área = específico de esa área
// monto: 0 = reconocimiento honorífico · >0 = al otorgarlo suma ese premio en Novedades

export type Metrica = 'racha_presentismo' | 'horas_extra' | 'comisiones' | 'premios';

/** [nombre, descripción, glifo] de cada métrica. */
export const METRICA_META: Record<Metrica, [string, string, string]> = {
  racha_presentismo: ['Racha de presentismo', 'meses seguidos sin faltas injustificadas', '★'],
  horas_extra:       ['Horas extra del mes', 'HE 50% + HE 100% del período', '▲'],
  comisiones:        ['Comisiones del mes', 'mayor resultado comercial del período', 'Nº1'],
  premios:           ['Premios del mes', 'mayor reconocimiento por resultados del período', '◆'],
};
export const METRICAS = Object.keys(METRICA_META) as Metrica[];

export interface Bono {
  id: number;
  nombre: string;
  ambito: string;
  metrica: Metrica;
  monto: number;
  activo: boolean;
  orden: number;
}

export const DEFAULT_BONOS: Omit<Bono, 'id'>[] = [
  { nombre: 'Presentismo Perfecto', ambito: 'empresa', metrica: 'racha_presentismo', monto: 0, activo: true, orden: 0 },
  { nombre: 'Compromiso Extra', ambito: 'empresa', metrica: 'horas_extra', monto: 0, activo: true, orden: 1 },
];

// ─── Validaciones ────────────────────────────────────────────────────────────

export const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const PIN_RE = /^\d{4,8}$/;


