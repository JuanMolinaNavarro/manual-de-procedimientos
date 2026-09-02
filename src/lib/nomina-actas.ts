import { join } from 'path';

/** Actas de adhesión escaneadas (PDF). Mismo criterio que uploads/organigrama. */
export const ACTAS_DIR = join(process.cwd(), 'uploads', 'nomina', 'actas');
export const ACTA_MAX_BYTES = 15 * 1024 * 1024;
