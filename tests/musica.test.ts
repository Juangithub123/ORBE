import { describe, expect, it } from 'vitest';
import {
  PASOS_CICLO,
  PROGRESION,
  capasActivas,
  golpes,
  intensidadPorVelocidad,
  notaMoneda,
  subirOctava,
  volumenADb,
} from '../src/audio/musica';

describe('golpes', () => {
  it('el bombo va en negras y el colchón cambia al empezar cada compás', () => {
    const bombos = Array.from({ length: 16 }, (_, i) => golpes(i).bombo);
    expect(bombos.filter(Boolean)).toHaveLength(4);
    expect(golpes(0).colchon).toEqual(PROGRESION[0].colchon);
    expect(golpes(16).colchon).toEqual(PROGRESION[1].colchon);
    expect(golpes(1).colchon).toBeNull();
  });

  it('el bajo sigue al acorde, en dos octavas', () => {
    expect(golpes(0).bajo).toBe('A1');
    expect(golpes(2).bajo).toBe('A2');
    expect(golpes(16).bajo).toBe('F1');
  });

  it('el ciclo se repite', () => {
    expect(golpes(PASOS_CICLO + 5)).toEqual(golpes(5));
    expect(golpes(-1)).toEqual(golpes(PASOS_CICLO - 1));
  });
});

describe('capasActivas', () => {
  it('en el juego se suman capas con la intensidad', () => {
    expect(capasActivas('juego', 0).has('palmas')).toBe(false);
    expect(capasActivas('juego', 0.3).has('palmas')).toBe(true);
    expect(capasActivas('juego', 0.6).has('hatsRapidos')).toBe(true);
    expect(capasActivas('juego', 1).has('melodia')).toBe(true);
  });

  it('el menú y el resultado no tienen bombo; silencio no tiene nada', () => {
    expect(capasActivas('menu', 1).has('bombo')).toBe(false);
    expect(capasActivas('resultado', 1).has('bombo')).toBe(false);
    expect(capasActivas('silencio', 1).size).toBe(0);
  });
});

describe('utilidades', () => {
  it('subirOctava', () => {
    expect(subirOctava('A1')).toBe('A2');
    expect(subirOctava('C#3')).toBe('C#4');
  });

  it('la moneda sube con la racha y no se pasa', () => {
    expect(notaMoneda(0)).toBe('A5');
    expect(notaMoneda(1)).toBe('C6');
    expect(notaMoneda(99)).toBe('E7');
  });

  it('volumen: 0 es silencio y 1 es 0 dB', () => {
    expect(volumenADb(0)).toBe(-Infinity);
    expect(volumenADb(1)).toBe(0);
    expect(volumenADb(0.5)).toBeCloseTo(-12.04, 1);
  });

  it('intensidad según la velocidad', () => {
    expect(intensidadPorVelocidad(110, 110, 320)).toBe(0);
    expect(intensidadPorVelocidad(215, 110, 320)).toBe(0.5);
    expect(intensidadPorVelocidad(500, 110, 320)).toBe(1);
  });
});
