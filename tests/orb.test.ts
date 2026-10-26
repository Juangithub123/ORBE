import { describe, expect, it } from 'vitest';
import { calcOrb, type OrbParams } from '../src/game/orb';

const params: OrbParams = { radioMin: 25, radioMax: 90, distCerca: 150, distLejos: 700 };

describe('calcOrb', () => {
  it('el centro es el promedio de los jugadores', () => {
    const o = calcOrb({ x: 100, y: 200 }, { x: 300, y: 400 }, params);
    expect(o.x).toBe(200);
    expect(o.y).toBe(300);
  });

  it('cerca da radio máximo y cercanía 1', () => {
    const o = calcOrb({ x: 0, y: 0 }, { x: 100, y: 0 }, params);
    expect(o.radio).toBe(90);
    expect(o.cercania).toBe(1);
  });

  it('lejos da radio mínimo y cercanía 0', () => {
    const o = calcOrb({ x: 0, y: 0 }, { x: 1000, y: 0 }, params);
    expect(o.radio).toBe(25);
    expect(o.cercania).toBe(0);
  });

  it('interpola en el medio del rango', () => {
    const o = calcOrb({ x: 0, y: 0 }, { x: 425, y: 0 }, params);
    expect(o.radio).toBeCloseTo(57.5);
    expect(o.cercania).toBeCloseTo(0.5);
  });

  it('usa la distancia euclídea (no solo x)', () => {
    const o = calcOrb({ x: 0, y: 0 }, { x: 300, y: 400 }, params);
    expect(o.dist).toBe(500);
  });

  it('es simétrico: intercambiar jugadores no cambia nada', () => {
    const a = calcOrb({ x: 10, y: 50 }, { x: 600, y: 300 }, params);
    const b = calcOrb({ x: 600, y: 300 }, { x: 10, y: 50 }, params);
    expect(b).toEqual(a);
  });
});
