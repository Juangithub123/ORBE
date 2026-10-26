import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTiled, type TiledMap } from '../src/level/parseTiled';

const mapa = JSON.parse(readFileSync(new URL('./fixtures/prueba.tmj', import.meta.url), 'utf8')) as TiledMap;
const nivel = parseTiled(mapa, 'por defecto');
const roca = (id: number) => nivel.rocas.find((r) => r.id === id)!;

describe('parseTiled', () => {
  it('lee el tamaño y las propiedades del mapa', () => {
    expect(nivel.anchoMapa).toBe(1280);
    expect(nivel.altoMapa).toBe(1440);
    expect(nivel.nombre).toBe('Prueba');
    expect(nivel.velScrollInicial).toBe(150);
  });

  it('usa el nombre por defecto si el mapa no tiene', () => {
    const sinProps = parseTiled({ ...mapa, properties: undefined }, 'nivel_x');
    expect(sinProps.nombre).toBe('nivel_x');
    expect(sinProps.velScrollInicial).toBeUndefined();
  });

  it('convierte un rectángulo en 4 puntos con sus límites', () => {
    const r = roca(1);
    expect(r.tipo).toBe('piedra');
    expect(r.puntos).toEqual([
      { x: 100, y: 1000 },
      { x: 300, y: 1000 },
      { x: 300, y: 1050 },
      { x: 100, y: 1050 },
    ]);
    expect([r.minX, r.maxX, r.minY, r.maxY]).toEqual([100, 300, 1000, 1050]);
  });

  it('suma la posición del objeto a los puntos del polígono', () => {
    expect(roca(2).puntos).toEqual([
      { x: 500, y: 1000 },
      { x: 600, y: 1000 },
      { x: 550, y: 920 },
    ]);
  });

  it('convierte una elipse en 32 segmentos y lee radioMin', () => {
    const r = roca(3);
    expect(r.tipo).toBe('piedra_fragil');
    expect(r.puntos).toHaveLength(32);
    expect(r.radioMin).toBe(75);
    expect(r.minX).toBeCloseTo(800);
    expect(r.maxX).toBeCloseTo(900);
    expect(r.minY).toBeCloseTo(900);
    expect(r.maxY).toBeCloseTo(960);
  });

  it('respeta la rotación (90° en sentido horario alrededor de x,y)', () => {
    const r = roca(4);
    expect(r.minX).toBeCloseTo(-20);
    expect(r.maxX).toBeCloseTo(0);
    expect(r.minY).toBeCloseTo(600);
    expect(r.maxY).toBeCloseTo(700);
  });

  it('lee monedas, incluso dentro de grupos con desplazamiento y con el campo class', () => {
    expect(nivel.monedas).toEqual([
      { id: 5, x: 640, y: 700 },
      { id: 10, x: 110, y: 480 },
    ]);
  });

  it('la meta es el borde inferior del rectángulo final', () => {
    expect(nivel.meta).toEqual({ y: 300, yArriba: 100 });
  });

  it('ignora polilíneas, objetos sin clase y objetos ocultos', () => {
    expect(nivel.rocas.map((r) => r.id).sort()).toEqual([1, 2, 3, 4]);
  });
});
