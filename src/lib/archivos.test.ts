import { describe, it, expect } from 'vitest';
import { extensionDocumento } from './archivos';

const bytes = (...partes: (string | number[])[]) =>
  Uint8Array.from(partes.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)));

describe('extensionDocumento', () => {
  it('reconoce PDF, PNG, JPG y WEBP por sus primeros bytes', () => {
    expect(extensionDocumento(bytes('%PDF-1.7'))).toBe('.pdf');
    expect(extensionDocumento(bytes([0x89], 'PNG', [0x0d, 0x0a]))).toBe('.png');
    expect(extensionDocumento(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe('.jpg');
    expect(extensionDocumento(bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 '))).toBe('.webp');
  });
  it('rechaza lo demás aunque se llame .pdf', () => {
    expect(extensionDocumento(bytes('MZ', [0x90, 0]))).toBeNull();
    expect(extensionDocumento(bytes('<html>'))).toBeNull();
    expect(extensionDocumento(new Uint8Array())).toBeNull();
  });
});
