import { describe, expect, it } from 'vitest';
import { circuloTocaCirculo, circuloTocaPoligono, puntoEnPoligono } from '../src/game/collisions';

const cuadrado = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

// Forma de "U" (cóncava): el hueco va de x 30 a 70, y de 0 a 70.
const u = [
  { x: 0, y: 0 },
  { x: 30, y: 0 },
  { x: 30, y: 70 },
  { x: 70, y: 70 },
  { x: 70, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

describe('puntoEnPoligono', () => {
  it('detecta puntos adentro y afuera', () => {
    expect(puntoEnPoligono({ x: 50, y: 50 }, cuadrado)).toBe(true);
    expect(puntoEnPoligono({ x: 150, y: 50 }, cuadrado)).toBe(false);
  });

  it('funciona con polígonos cóncavos', () => {
    expect(puntoEnPoligono({ x: 50, y: 30 }, u)).toBe(false);
    expect(puntoEnPoligono({ x: 15, y: 30 }, u)).toBe(true);
  });
});

describe('circuloTocaPoligono', () => {
  it('toca si el centro está adentro', () => {
    expect(circuloTocaPoligono({ x: 50, y: 50 }, 1, cuadrado)).toBe(true);
  });

  it('toca si el borde se acerca a un lado', () => {
    expect(circuloTocaPoligono({ x: 120, y: 50 }, 25, cuadrado)).toBe(true);
    expect(circuloTocaPoligono({ x: 130, y: 50 }, 25, cuadrado)).toBe(false);
  });

  it('usa la distancia a la esquina, no a la caja', () => {
    // A 30 px en diagonal de la esquina (100,100): la caja ampliada tocaría, el círculo no.
    expect(circuloTocaPoligono({ x: 121, y: 121 }, 25, cuadrado)).toBe(false);
    expect(circuloTocaPoligono({ x: 115, y: 115 }, 25, cuadrado)).toBe(true);
  });

  it('un orbe chico pasa por el hueco de la U y uno grande no', () => {
    expect(circuloTocaPoligono({ x: 50, y: 30 }, 15, u)).toBe(false);
    expect(circuloTocaPoligono({ x: 50, y: 30 }, 25, u)).toBe(true);
  });
});

describe('circuloTocaCirculo', () => {
  it('compara contra la suma de los radios', () => {
    expect(circuloTocaCirculo({ x: 0, y: 0 }, 10, { x: 25, y: 0 }, 16)).toBe(true);
    expect(circuloTocaCirculo({ x: 0, y: 0 }, 10, { x: 27, y: 0 }, 16)).toBe(false);
  });
});
