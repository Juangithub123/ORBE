import { describe, expect, it } from 'vitest';
import { perfilRecomendado } from '../src/perfil';

const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 14; TB370FU) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const ANDROID_ESCRITORIO = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

describe('perfilRecomendado', () => {
  it('tablet Android: liviano', () => {
    expect(perfilRecomendado({ userAgent: ANDROID_TABLET, maxTouchPoints: 10, nucleos: 8, memoriaGb: 8 })).toBe('liviano');
  });

  it('tablet Android pidiendo la versión de escritorio (se presenta como Linux): liviano', () => {
    expect(perfilRecomendado({ userAgent: ANDROID_ESCRITORIO, maxTouchPoints: 10, nucleos: 8, memoriaGb: 8 })).toBe('liviano');
  });

  it('iPad (se presenta como Mac, pero es táctil): liviano', () => {
    expect(perfilRecomendado({ userAgent: IPAD, maxTouchPoints: 5, nucleos: 8 })).toBe('liviano');
  });

  it('computadora: completo', () => {
    expect(perfilRecomendado({ userAgent: WINDOWS, maxTouchPoints: 0, nucleos: 8, memoriaGb: 16 })).toBe('completo');
    expect(perfilRecomendado({ userAgent: IPAD, maxTouchPoints: 0, nucleos: 8 })).toBe('completo');
    expect(perfilRecomendado({ userAgent: ANDROID_ESCRITORIO, maxTouchPoints: 0, nucleos: 12 })).toBe('completo');
  });

  it('notebook táctil con Windows: completo', () => {
    expect(perfilRecomendado({ userAgent: WINDOWS, maxTouchPoints: 10, nucleos: 8, memoriaGb: 16 })).toBe('completo');
  });

  it('computadora con poca CPU o memoria: liviano', () => {
    expect(perfilRecomendado({ userAgent: WINDOWS, maxTouchPoints: 0, nucleos: 4 })).toBe('liviano');
    expect(perfilRecomendado({ userAgent: WINDOWS, maxTouchPoints: 0, nucleos: 8, memoriaGb: 4 })).toBe('liviano');
  });
});
