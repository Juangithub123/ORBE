import { describe, expect, it } from 'vitest';
import { agarreEn, arrastrarZona, claveZona, filtrarAjustes, limitarZona, limpiarNombre } from '../src/control/protocolo';

const ZONA = { x0: 0.2, x1: 0.8, y0: 0.3, y1: 0.7 };

describe('filtrarAjustes', () => {
  it('deja solo los ajustes controlables', () => {
    const r = filtrarAjustes({ espejar: true, camaraId: 'x', kinectServidor: 'otro:1', modoNombre: 'teclado' });
    expect(r).toEqual({ espejar: true, modoNombre: 'teclado' });
  });

  it('descarta tipos equivocados y ordena las zonas', () => {
    const r = filtrarAjustes({ espejar: 'si', volumen: 3, zonaPose: { x0: 0.9, x1: 0.1, y0: 0, y1: 1 }, zonaManos: { x0: 1 } });
    expect(r).toEqual({ volumen: 1, zonaPose: { x0: 0.1, x1: 0.9, y0: 0, y1: 1 } });
  });
});

describe('limitarZona', () => {
  it('no deja zonas fuera de la imagen ni más chicas que el mínimo', () => {
    expect(limitarZona({ x0: -0.5, x1: 1.5, y0: 0.5, y1: 0.5 })).toEqual({ x0: 0, x1: 1, y0: 0.5, y1: 0.55 });
    expect(limitarZona({ x0: 1, x1: 1, y0: 0, y1: 1 }).x0).toBeCloseTo(0.95);
  });
});

describe('claveZona', () => {
  it('cada entrada con sensor tiene su zona; el teclado no', () => {
    expect(claveZona('pose')).toBe('zonaPose');
    expect(claveZona('manos')).toBe('zonaManos');
    expect(claveZona('kinect')).toBe('zonaKinect');
    expect(claveZona('teclado')).toBeNull();
  });
});

describe('limpiarNombre', () => {
  it('pasa a mayúsculas, saca acentos y lo que no es letra, y deja la Ñ', () => {
    expect(limpiarNombre('Ñandú 2 José', 20)).toBe('ÑANDUJOSE');
  });
  it('corta en el máximo de letras', () => {
    expect(limpiarNombre('abcdefghij', 8)).toBe('ABCDEFGH');
  });
});

describe('agarreEn', () => {
  it('reconoce el centro, los bordes y las esquinas', () => {
    expect(agarreEn(ZONA, 0.5, 0.5, 0.03)).toBe('mover');
    expect(agarreEn(ZONA, 0.21, 0.5, 0.03)).toBe('x0');
    expect(agarreEn(ZONA, 0.5, 0.69, 0.03)).toBe('y1');
    expect(agarreEn(ZONA, 0.79, 0.31, 0.03)).toBe('x1y0');
    expect(agarreEn(ZONA, 0.05, 0.5, 0.03)).toBeNull();
  });
});

describe('arrastrarZona', () => {
  it('mover la corre entera sin salirse de la imagen', () => {
    const z = arrastrarZona(ZONA, 'mover', 0.5, -0.5);
    expect(z.x1).toBeCloseTo(1);
    expect(z.x1 - z.x0).toBeCloseTo(0.6);
    expect(z.y0).toBeCloseTo(0);
    expect(z.y1 - z.y0).toBeCloseTo(0.4);
  });

  it('un borde cambia solo ese lado y no cruza al otro', () => {
    expect(arrastrarZona(ZONA, 'x0', -0.1, 0)).toMatchObject({ x1: 0.8, y0: 0.3, y1: 0.7 });
    expect(arrastrarZona(ZONA, 'x0', -0.1, 0).x0).toBeCloseTo(0.1);
    const z = arrastrarZona(ZONA, 'x1', -0.9, 0);
    expect(z.x1 - z.x0).toBeCloseTo(0.05);
  });

  it('una esquina cambia los dos lados', () => {
    const z = arrastrarZona(ZONA, 'x1y1', 0.1, 0.1);
    expect(z.x1).toBeCloseTo(0.9);
    expect(z.y1).toBeCloseTo(0.8);
    expect(z.x0).toBeCloseTo(0.2);
  });
});
