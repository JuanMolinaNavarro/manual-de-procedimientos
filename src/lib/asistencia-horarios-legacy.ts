/**
 * Parser de los horarios viejos de la ficha del organigrama, para migrarlos al
 * modelo versionado de Asistencia. Solo vive durante el Release A: cuando las
 * columnas `OrgEmpleado.horario` / `OrgEmpleado.horarios` se borren, este
 * archivo se borra con ellas.
 *
 * Formatos que se entienden:
 * - `horarios` Json: `[{ dia: 'Lunes', valor: '08:00 - 17:00' }, …]`.
 * - `horario` texto: `Lun - Vie, 08:00 - 17:00`, `Lun a Vie 9 a 18 hs`,
 *   `Lunes, Miércoles y Viernes 08:00-12:00`. Sin días → se asume L–V.
 * Lo que no parsea devuelve null y queda para cargar a mano.
 */

import { HORA_RE, minutosDe, type DiaSemana, type DiasHorario } from './asistencia-calendario';

/** Rango horario: `08:00 - 17:00`, `8:00–17:00`, `9 a 18`, `08.30 a 12.30 hs`. */
const RANGO_RE = /(\d{1,2})(?:[:.](\d{2}))?\s*(?:hs?\.?)?\s*(?:-|–|—|a|hasta)\s*(\d{1,2})(?:[:.](\d{2}))?/i;

const DIAS_ABREV: [string, DiaSemana][] = [
  ['lun', 0], ['mar', 1], ['mie', 2], ['jue', 3], ['vie', 4], ['sab', 5], ['dom', 6],
];

function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function diaDeTexto(s: string): DiaSemana | null {
  const t = sinAcentos(s.trim()).slice(0, 3);
  return DIAS_ABREV.find(([ab]) => ab === t)?.[1] ?? null;
}

function hhmm(h: string, m: string | undefined): string {
  return `${h.padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}`;
}

/** Rango del texto como `{ entrada, salida }` válido, o null. */
export function parsearRango(texto: string): { entrada: string; salida: string } | null {
  const m = RANGO_RE.exec(texto);
  if (!m) return null;
  const entrada = hhmm(m[1], m[2]);
  const salida = hhmm(m[3], m[4]);
  if (!HORA_RE.test(entrada) || !HORA_RE.test(salida)) return null;
  if (minutosDe(salida) <= minutosDe(entrada)) return null;
  return { entrada, salida };
}

/** Días mencionados en un texto, expandiendo rangos `Lun - Vie` / `lunes a viernes`. */
export function parsearDias(texto: string): DiaSemana[] {
  const t = sinAcentos(texto);
  const re = /\b(lun|mar|mie|jue|vie|sab|dom)[a-z]*\b/g;
  const tokens: { dia: DiaSemana; inicio: number; fin: number }[] = [];
  for (let m = re.exec(t); m; m = re.exec(t)) {
    const dia = diaDeTexto(m[1]);
    if (dia != null) tokens.push({ dia, inicio: m.index, fin: m.index + m[0].length });
  }
  const dias = new Set<DiaSemana>();
  for (let i = 0; i < tokens.length; i++) {
    const cur = tokens[i];
    const sig = tokens[i + 1];
    // Un separador de rango entre dos días ("-", "a") los expande; una coma o "y" no.
    const esRango = !!sig && sig.dia > cur.dia && /^\s*(?:-|–|—|a)\s*$/.test(t.slice(cur.fin, sig.inicio));
    if (esRango) {
      for (let d = cur.dia; d <= sig.dia; d++) dias.add(d as DiaSemana);
      i++;
    } else {
      dias.add(cur.dia);
    }
  }
  return [...dias].sort((a, b) => a - b);
}

/**
 * Convierte los campos viejos al `dias` del modelo nuevo (ciclo 1). Prioriza el
 * Json por día; si no aporta nada, usa el texto. Null si no hay nada parseable.
 */
export function parsearHorarioLegacy(
  horario: string | null | undefined,
  horarios: { dia?: unknown; valor?: unknown }[] | null | undefined,
): DiasHorario | null {
  const out: DiasHorario = {};
  if (Array.isArray(horarios)) {
    for (const h of horarios) {
      const dia = typeof h?.dia === 'string' ? diaDeTexto(h.dia) : null;
      const rango = typeof h?.valor === 'string' ? parsearRango(h.valor) : null;
      if (dia != null && rango) out[dia] = { semanas: [0], ...rango };
    }
  }
  if (Object.keys(out).length > 0) return out;

  if (typeof horario === 'string' && horario.trim()) {
    const rango = parsearRango(horario);
    if (!rango) return null;
    const dias = parsearDias(horario);
    for (const d of dias.length > 0 ? dias : ([0, 1, 2, 3, 4] as DiaSemana[])) out[d] = { semanas: [0], ...rango };
    return out;
  }
  return null;
}
