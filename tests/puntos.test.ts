import { describe, expect, it } from 'vitest';
import { centroPalma, centroTorso, munecaMasAlta, type PuntoVisible } from '../src/input/puntos';

/** Pose de 33 puntos en (0.5, 0.5), con algunos puntos cambiados. */
function pose(cambios: Record<number, PuntoVisible>): PuntoVisible[] {
  return Array.from({ length: 33 }, (_, i) => cambios[i] ?? { x: 0.5, y: 0.5, visibility: 1 });
}

describe('centroPalma', () => {
  it('promedia la muñeca y tres nudillos', () => {
    const mano = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
    mano[0] = { x: 0.4, y: 0.8 };
    mano[5] = { x: 0.5, y: 0.6 };
    mano[9] = { x: 0.6, y: 0.6 };
    mano[17] = { x: 0.7, y: 0.6 };
    expect(centroPalma(mano).x).toBeCloseTo(0.55);
    expect(centroPalma(mano).y).toBeCloseTo(0.65);
  });
});

describe('centroTorso', () => {
  const hombros = { 11: { x: 0.4, y: 0.3, visibility: 0.99 }, 12: { x: 0.6, y: 0.3, visibility: 0.99 } };

  it('con las caderas visibles, promedia hombros y caderas', () => {
    const p = pose({ ...hombros, 23: { x: 0.45, y: 0.7, visibility: 0.9 }, 24: { x: 0.55, y: 0.7, visibility: 0.9 } });
    expect(centroTorso(p).x).toBeCloseTo(0.5);
    expect(centroTorso(p).y).toBeGreaterThan(0.45);
  });

  it('con las caderas fuera de cuadro, usa solo los hombros', () => {
    const p = pose({ ...hombros, 23: { x: 0.45, y: 1.3, visibility: 0.1 }, 24: { x: 0.55, y: 1.3, visibility: 0.2 } });
    expect(centroTorso(p)).toEqual({ x: 0.5, y: 0.3 });
  });
});

describe('munecaMasAlta', () => {
  it('elige la más alta entre las visibles', () => {
    const p = pose({ 15: { x: 0.3, y: 0.2, visibility: 0.9 }, 16: { x: 0.7, y: 0.4, visibility: 0.9 } });
    expect(munecaMasAlta(p)).toMatchObject({ x: 0.3, y: 0.2 });
  });

  it('ignora una muñeca que no se ve aunque esté más alta', () => {
    const p = pose({ 15: { x: 0.3, y: 0.1, visibility: 0.2 }, 16: { x: 0.7, y: 0.4, visibility: 0.9 } });
    expect(munecaMasAlta(p)).toMatchObject({ x: 0.7, y: 0.4 });
  });

  it('si no se ve ninguna muñeca, usa el torso', () => {
    const p = pose({ 15: { x: 0.3, y: 0.1, visibility: 0.1 }, 16: { x: 0.7, y: 0.1, visibility: 0.1 } });
    expect(munecaMasAlta(p)).toEqual({ x: 0.5, y: 0.5 });
  });
});
