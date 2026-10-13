import { describe, it, expect } from 'vitest';
import { CONFIG_DEFAULT, evaluarDia, resumenLiquidacion, type FichadaDia, type HorarioVersion } from './asistencia-calendario';
import { compensada, explicarDia, grupoDelDia, pendienteDeRevisar, plural, porcentajeHoras, resumenMesPersona, tardanza, tardesCompensadas } from './asistencia-tablero-calc';

// Septiembre 2026: el 2 es miércoles, el 5 sábado. Horario L–V 08:00–16:00, tolerancia general 10.
const HOY = '2026-09-15';
const VERSION: HorarioVersion = {
  id: 1,
  empleadoId: 10,
  vigenteDesde: '2026-01-01',
  vigenteHasta: null,
  incluir: true,
  cicloSemanas: 1,
  cicloAncla: '2025-12-29',
  toleranciaMin: null,
  dias: Object.fromEntries([0, 1, 2, 3, 4].map((d) => [d, { semanas: [0], entrada: '08:00', salida: '16:00' }])),
};

const marca = (fecha: string, hhmm: string, tipo: number): FichadaDia => ({ fechaHora: new Date(`${fecha}T${hhmm}:00-03:00`).toISOString(), tipo });
const dia = (fecha: string, marcas: [string, number][], hoy = HOY) =>
  evaluarDia({ fecha, hoy, version: VERSION, fichadas: marcas.map(([h, t]) => marca(fecha, h, t)) }, CONFIG_DEFAULT);

describe('compensada', () => {
  it('llegó 22 min tarde y se quedó 30: compensada, y los 8 que sobran no son hora extra', () => {
    const c = dia('2026-09-02', [['08:22', 0], ['12:30', 2], ['16:30', 1]]);
    expect(tardanza(c)).toBe(22);
    expect(compensada(c)).toBe(true);
    expect(explicarDia(c)).toEqual([
      'Llegó 22 min tarde: tenía que entrar a las 08:00.',
      'Se quedó 30 min después de las 16:00.',
      'Eso cubre la llegada tarde: queda compensada.',
      'Los 8 min que quedan no suman hora extra: se cuenta de a media hora completa.',
      'Trabajó 8 h 8 min, de 08:22 a 16:30.',
    ]);
  });

  it('llegó 41 min tarde y se fue a horario: no compensada', () => {
    const c = dia('2026-09-07', [['08:41', 0], ['16:00', 1]]);
    expect(c.estado).toBe('tarde_grave');
    expect(compensada(c)).toBe(false);
    expect(explicarDia(c)).toContain('La llegada tarde no se compensó.');
  });

  it('a horario con 1 h 40 de más: suma 1 h 30 min al 50 %', () => {
    const c = dia('2026-09-04', [['08:03', 0], ['17:40', 1]]);
    expect(compensada(c)).toBe(false);
    expect(explicarDia(c)).toContain('Suma 1 h 30 min al 50 % de hora extra.');
  });
});

describe('grupoDelDia', () => {
  it('hoy sin marcas: según la hora de entrada, todavía no fichó o entra más tarde', () => {
    const c = dia(HOY, []);
    expect(c.estado).toBe('pendiente');
    expect(grupoDelDia(c, 10 * 60)).toBe('sin_fichar');
    expect(grupoDelDia(c, 7 * 60)).toBe('entra_mas_tarde');
  });

  it('un día pasado sin marcas es falta; un sábado sin horario no va a ninguna lista', () => {
    expect(grupoDelDia(dia('2026-09-02', []), 0)).toBe('falto');
    expect(grupoDelDia(dia('2026-09-05', []), 0)).toBeNull();
  });
});

describe('pendienteDeRevisar', () => {
  it('marca faltas, días sin entrada y sin salida', () => {
    expect(pendienteDeRevisar(dia('2026-09-02', []))).toBe('falto');
    expect(pendienteDeRevisar(dia('2026-09-02', [['16:00', 1]]))).toBe('sin_entrada');
    expect(pendienteDeRevisar(dia('2026-09-02', [['08:00', 0]]))).toBe('sin_salida');
    expect(pendienteDeRevisar(dia('2026-09-02', [['08:00', 0], ['16:00', 1]]))).toBeNull();
    const justificado = evaluarDia({ fecha: '2026-09-02', hoy: HOY, version: VERSION, fichadas: [], justificado: true }, CONFIG_DEFAULT);
    expect(pendienteDeRevisar(justificado)).toBeNull();
    expect(grupoDelDia(justificado, 0)).toBe('falto');
  });
});

describe('resumenMesPersona', () => {
  it('cuenta las llegadas tarde compensadas aparte', () => {
    const celdas = [
      dia('2026-09-02', [['08:22', 0], ['16:30', 1]]), // tarde, compensada
      dia('2026-09-03', [['08:41', 0], ['16:00', 1]]), // tarde grave, sin compensar
      dia('2026-09-04', []), // falta
      dia('2026-09-07', [['08:00', 0]]), // sin salida
    ];
    const r = resumenMesPersona(resumenLiquidacion(celdas), false);
    expect(r).toMatchObject({ tardes: 2, compensadas: 1, minutosTarde: 63, faltas: 1, sinMarca: 1 });
    const conJustificada = [...celdas, evaluarDia({ fecha: '2026-09-08', hoy: HOY, version: VERSION, fichadas: [], justificado: true }, CONFIG_DEFAULT)];
    expect(resumenMesPersona(resumenLiquidacion(conJustificada), false)).toMatchObject({ faltas: 1, justificadas: 1 });
  });
});

describe('helpers de lectura', () => {
  it('plural', () => {
    expect(plural(1, 'vez', 'veces')).toBe('1 vez');
    expect(plural(0, 'vez', 'veces')).toBe('0 veces');
  });

  it('porcentajeHoras: tope 100 y sin horas esperadas da 0', () => {
    expect(porcentajeHoras({ minutosTrabajados: 90, minutosEsperados: 120 })).toBe(75);
    expect(porcentajeHoras({ minutosTrabajados: 200, minutosEsperados: 120 })).toBe(100);
    expect(porcentajeHoras({ minutosTrabajados: 50, minutosEsperados: 0 })).toBe(0);
  });

  it('tardesCompensadas cuenta solo las completas', () => {
    expect(tardesCompensadas({ tardes: [
      { fecha: 'a', minutos: 20, grave: false, recuperado: 20 },
      { fecha: 'b', minutos: 20, grave: false, recuperado: 19 },
    ] })).toBe(1);
  });
});
