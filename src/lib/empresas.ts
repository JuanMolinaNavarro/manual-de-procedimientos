export const EMPRESAS = [
  'Providers',
  'CCC',
  'Salta Cable',
  'TCC',
  'Valle Medios',
  'Intersas',
  'FlyNet',
  'Las Talitas',
] as const;

export type Empresa = (typeof EMPRESAS)[number];

const EMPRESAS_STRINGS: readonly string[] = EMPRESAS;
export function isEmpresa(value: string): value is Empresa {
  return EMPRESAS_STRINGS.includes(value);
}
