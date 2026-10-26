import { describe, expect, it } from 'vitest';
import { escalaAuto } from '../src/pantalla';

describe('escalaAuto', () => {
  it('llena la pantalla en pasos de 0,25', () => {
    expect(escalaAuto(1920, 1080)).toBe(1.5);
    expect(escalaAuto(2560, 1440)).toBe(2);
    expect(escalaAuto(3840, 2160)).toBe(3);
  });
  it('en pantallas no 16:9 usa el lado que limita', () => {
    expect(escalaAuto(2560, 1600)).toBe(2);
    expect(escalaAuto(1366, 768)).toBe(1);
  });
  it('nunca baja de 1 ni pasa de 3', () => {
    expect(escalaAuto(800, 600)).toBe(1);
    expect(escalaAuto(7680, 4320)).toBe(3);
  });
});
