import { describe, expect, it } from 'vitest';
import {
  armarTrama,
  crc16,
  esRespuestaA,
  extraerTramas,
  fechaReloj,
  largoRespuesta,
  parsearContadores,
  parsearInfo1,
  parsearRegistros,
  parsearRespuesta,
} from './anviz-tcb';

const hex = (s: string) => Buffer.from(s.replace(/\s+/g, ''), 'hex');

// Tramas reales capturadas del log de CrossChex Standard (dispositivo 1 = PROSPERO).
describe('anviz-tcb: tramas', () => {
  it('crc16 coincide con los vectores del log', () => {
    expect(crc16(hex('A5 00 00 00 01 3C 00 00'))).toBe(0xa949);
    expect(crc16(hex('A5 00 00 00 01 40 00 02 02 19'))).toBe(0xc03e);
    expect(crc16(hex('A5 00 00 00 01 40 00 02 00 19'))).toBe(0xf38e);
    expect(crc16(hex('A5 00 00 00 01 4E 00 04 02 00 00 33'))).toBe(0x4d94);
    expect(crc16(hex('A5 00 00 00 01 30 00 00'))).toBe(0x0cea);
  });

  it('armarTrama reproduce los pedidos de CrossChex byte a byte', () => {
    expect(armarTrama(1, 0x3c)).toEqual(hex('A5 00 00 00 01 3C 00 00 49 A9'));
    expect(armarTrama(1, 0x40, new Uint8Array([2, 25]))).toEqual(hex('A5 00 00 00 01 40 00 02 02 19 3E C0'));
    expect(armarTrama(1, 0x40, new Uint8Array([0, 25]))).toEqual(hex('A5 00 00 00 01 40 00 02 00 19 8E F3'));
    expect(armarTrama(1, 0x4e, new Uint8Array([2, 0, 0, 0x33]))).toEqual(hex('A5 00 00 00 01 4E 00 04 02 00 00 33 94 4D'));
    expect(armarTrama(177, 0x30)).toHaveLength(10);
  });

  it('parsea la respuesta de contadores (0x3C)', () => {
    const trama = hex('A5 00 00 00 01 BC 00 00 12 00 00 BD 00 01 38 00 00 0C 00 00 07 00 C3 50 00 00 33 24 EC');
    expect(largoRespuesta(trama)).toBe(trama.length);
    const r = parsearRespuesta(trama);
    expect(r).toMatchObject({ deviceId: 1, cmd: 0x3c, ret: 0 });
    expect(parsearContadores(r.data)).toEqual({
      usuarios: 189,
      huellas: 312,
      claves: 12,
      tarjetas: 7,
      registrosTotales: 50000,
      registrosNuevos: 51,
    });
  });

  it('rechaza una trama con CRC alterado', () => {
    const trama = hex('A5 00 00 00 01 BC 00 00 12 00 00 BD 00 01 38 00 00 0C 00 00 07 00 C3 50 00 00 33 24 ED');
    expect(() => parsearRespuesta(trama)).toThrow(/CRC/);
  });

  it('parsea la respuesta de info (0x30)', () => {
    const r = parsearRespuesta(hex('A5 00 00 00 01 B0 00 00 12 30 33 2E 32 36 2E 39 33 40 1A 81 0A 05 00 20 00 00 02 DF 36'));
    const info = parsearInfo1(r.data);
    expect(info.firmware).toBe('03.26.93');
    expect(info.sleepMin).toBe(10);
  });

  it('parsea registros (0x40): un registro', () => {
    const r = parsearRespuesta(hex('A5 00 00 00 01 C0 00 00 0F 01 00 00 00 00 01 32 2A A3 D0 01 00 00 00 00 F4 C6'));
    const regs = parsearRegistros(r.data);
    expect(regs).toHaveLength(1);
    expect(regs[0].userId).toBe('1');
    expect(regs[0].modo).toBe(1);
    expect(regs[0].tipo).toBe(0);
    expect(regs[0].workType).toBe(0);
  });

  it('parsea registros (0x40): user id de 5 bytes = DNI y fecha local -03:00', () => {
    // Fragmento real: usuario 43498727, 0x322989D0 s desde época reloj, huella, tipo 1 (salida).
    // Coincide con la fichada de CrossChex: 43498727 el 2026-09-02 13:04 (salida).
    const data = Buffer.concat([Buffer.from([1]), hex('00 02 97 BC E7 32 29 89 D0 01 01 00 00 00')]);
    const [reg] = parsearRegistros(data);
    expect(reg.userId).toBe('43498727');
    expect(reg.tipo).toBe(1);
    expect(reg.fecha).toBe('2026-09-02');
    // 2026-09-02 13:04:16 hora Argentina (-03:00) = 16:04:16Z
    expect(reg.fechaHora.toISOString()).toBe('2026-09-02T16:04:16.000Z');
  });

  it('fechaReloj: 0 segundos es el 2/1/2000 00:00 local', () => {
    const { fechaHora, fecha } = fechaReloj(0);
    expect(fecha).toBe('2000-01-02');
    expect(fechaHora.toISOString()).toBe('2000-01-02T03:00:00.000Z');
  });
});

// Capturadas en GRAL PAZ CCC (device 20) el 8/9/2026 con una sonda de solo
// lectura: al pedir contadores, el reloj empujó primero la fichada que alguien
// acababa de marcar (cmd 0x5F, 14 bytes) y recién después contestó el 0x3C.
describe('anviz-tcb: tramas que el reloj empuja sin que se las pidan', () => {
  const conCrc = (s: string) => {
    const b = hex(s);
    const c = crc16(b);
    return Buffer.concat([b, Buffer.from([c & 0xff, c >> 8])]);
  };
  const empujada = conCrc('A5 00000014 DF 00 000E 00000001AE 32315785 01 00 000000');
  const contadores = conCrc('A5 00000014 BC 00 0012 0000F9 00017D 000014 000005 0027DC 000025');

  it('extraerTramas separa dos tramas pegadas en un chunk y guarda el resto', () => {
    const { tramas, resto } = extraerTramas(Buffer.concat([empujada, contadores, Buffer.from([0xa5, 0x00])]));
    expect(tramas).toHaveLength(2);
    expect(tramas[0]).toEqual(empujada);
    expect(tramas[1]).toEqual(contadores);
    expect(resto).toEqual(Buffer.from([0xa5, 0x00]));
  });

  it('la trama empujada no es respuesta al 0x3C; la de contadores sí', () => {
    expect(esRespuestaA(empujada, 0x3c)).toBe(false);
    expect(esRespuestaA(contadores, 0x3c)).toBe(true);
    expect(parsearRespuesta(empujada)).toMatchObject({ deviceId: 20, cmd: 0x5f, ret: 0 });
    expect(parsearRespuesta(empujada).data).toHaveLength(14);
  });

  it('con la empujada descartada, los contadores reales de GRAL PAZ parsean bien', () => {
    expect(parsearContadores(parsearRespuesta(contadores).data)).toMatchObject({
      usuarios: 249,
      registrosTotales: 10204,
      registrosNuevos: 37,
    });
  });

  it('parsearContadores sigue rechazando 14 bytes: es lo que pasaba antes del fix', () => {
    expect(() => parsearContadores(parsearRespuesta(empujada).data)).toThrow(/corta \(14 bytes\)/);
  });
});
