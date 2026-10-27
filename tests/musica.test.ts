import { describe, expect, it } from 'vitest';
import {
  PASOS_CICLO,
  bpmPara,
  capasActivas,
  corteAcid,
  golpes,
  notaMoneda,
  progresoGlobal,
  saturacionBombo,
  transponer,
  volumenADb,
} from '../src/audio/musica';

describe('golpes', () => {
  it('bombo en negras; el rolling bass llena las semicorcheas entre bombos', () => {
    const paso = (i: number) => golpes(i);
    expect(Array.from({ length: 16 }, (_, i) => paso(i).bombo).filter(Boolean)).toHaveLength(4);
    expect(paso(0).rumble).toBeNull();
    expect(paso(1).rumble).toBe('E1');
    expect(paso(3).rumble).toBe('E2');
  });

  it('el drone cambia con la raíz de cada compás', () => {
    expect(golpes(0).drone).toEqual(['E2', 'B2', 'E3']);
    expect(golpes(4 * 16).drone).toEqual(['C2', 'G2', 'C3']);
    expect(golpes(1).drone).toBeNull();
  });

  it('el barrido de ruido arranca en el último compás', () => {
    expect(golpes(7 * 16).ruido).toBe(true);
    expect(golpes(0).ruido).toBe(false);
  });

  it('el ciclo se repite', () => {
    expect(golpes(PASOS_CICLO + 5)).toEqual(golpes(5));
    expect(golpes(-1)).toEqual(golpes(PASOS_CICLO - 1));
  });
});

describe('capas por nivel', () => {
  // Con 3 niveles: nivel 1 = 0 a 1/3, nivel 2 = 1/3 a 2/3, nivel 3 = 2/3 a 1.
  const nivel = (n: number, avance: number) => capasActivas('juego', progresoGlobal(n, 3, avance));

  it('nivel 1 tranquilo: bombo, bajo, hats y drone', () => {
    const c = nivel(0, 0);
    expect([...c].sort()).toEqual(['bombo', 'drone', 'hats', 'rumble']);
  });

  it('nivel 2 suma claps, hats en semicorcheas y acid', () => {
    const c = nivel(1, 0);
    for (const capa of ['palmas', 'hats16', 'acid', 'metal'] as const) expect(c.has(capa)).toBe(true);
    expect(c.has('stab')).toBe(false);
  });

  it('nivel 3 suma stabs y barridos de ruido', () => {
    const c = nivel(2, 0);
    expect(c.has('stab')).toBe(true);
    expect(c.has('ruido')).toBe(true);
  });

  it('menú y resultado no tienen bombo; silencio no tiene nada', () => {
    expect(capasActivas('menu', 1).has('bombo')).toBe(false);
    expect(capasActivas('resultado', 1).has('bombo')).toBe(false);
    expect(capasActivas('silencio', 1).size).toBe(0);
  });
});

describe('tempo e intensidad', () => {
  const bpm = { menu: 92, inicial: 100, final: 136 };

  it('el tempo sube con el progreso y cada nivel arranca más rápido', () => {
    expect(bpmPara('juego', progresoGlobal(0, 3, 0), bpm)).toBe(100);
    expect(bpmPara('juego', progresoGlobal(1, 3, 0), bpm)).toBe(112);
    expect(bpmPara('juego', progresoGlobal(2, 3, 0), bpm)).toBe(124);
    expect(bpmPara('juego', 1, bpm)).toBe(136);
    expect(bpmPara('menu', 0.5, bpm)).toBe(92);
  });

  it('el filtro acid se abre en los niveles 2 y 3; el bombo se satura en el 3', () => {
    expect(corteAcid(1 / 3)).toBeCloseTo(250);
    expect(corteAcid(1)).toBeCloseTo(3500);
    expect(saturacionBombo(0.5)).toBe(0);
    expect(saturacionBombo(1)).toBe(1);
  });

  it('progresoGlobal se queda entre 0 y 1', () => {
    expect(progresoGlobal(1, 3, 0.5)).toBeCloseTo(0.5);
    expect(progresoGlobal(2, 3, 5)).toBe(1);
    expect(progresoGlobal(0, 3, -1)).toBe(0);
  });
});

describe('utilidades', () => {
  it('transponer', () => {
    expect(transponer('E2', 7)).toBe('B2');
    expect(transponer('E2', 12)).toBe('E3');
    expect(transponer('B1', 3)).toBe('D2');
    expect(transponer('C2', -1)).toBe('B1');
  });

  it('la moneda sube con la racha y no se pasa', () => {
    expect(notaMoneda(0)).toBe('E5');
    expect(notaMoneda(99)).toBe('B6');
  });

  it('volumen: 0 es silencio y 1 es 0 dB', () => {
    expect(volumenADb(0)).toBe(-Infinity);
    expect(volumenADb(1)).toBe(0);
  });
});
