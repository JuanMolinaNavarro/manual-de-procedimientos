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
