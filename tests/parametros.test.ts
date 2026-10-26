import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { leerDefiniciones, rango } from '../src/storage/parametros';

const fuente = readFileSync(new URL('../src/config.ts', import.meta.url), 'utf8');

describe('leerDefiniciones', () => {
  const defs = leerDefiniciones(fuente, CONFIG);

  it('encuentra todos los parámetros editables de config.ts, con sección y descripción', () => {
    const claves = defs.map((d) => d.clave);
    const esperadas = Object.keys(CONFIG).filter((k) => !['ancho', 'alto', 'espejar', 'volumenGeneral'].includes(k));
    expect(claves.sort()).toEqual(esperadas.sort());
    for (const d of defs) {
      expect(d.seccion, d.clave).not.toBe('');
      expect(d.descripcion, d.clave).not.toBe('');
    }
  });

  it('toma la sección y el comentario de cada parámetro', () => {
    const radioMax = defs.find((d) => d.clave === 'radioMax')!;
    expect(radioMax.seccion).toBe('Orbe');
    expect(radioMax.descripcion).toBe('Radio del orbe (px) cuando los jugadores están cerca.');
  });

  it('ignora claves que no son números ni booleanos', () => {
    const src = '// --- A ---\n/** texto */\nnombre: "x",\n/** num */\nn: 2,';
    expect(leerDefiniciones(src, { nombre: 'x', n: 2 })).toEqual([{ clave: 'n', seccion: 'A', descripcion: 'num' }]);
  });
});

describe('rango', () => {
  it('enteros: de 0 a 4 veces el valor, paso 1', () => {
    expect(rango(1500)).toEqual({ min: 0, max: 6000, paso: 1 });
  });
  it('fracciones: de 0 a 1', () => {
    expect(rango(0.25)).toEqual({ min: 0, max: 1, paso: 0.01 });
  });
  it('valores chicos: paso más fino', () => {
    const r = rango(0.01);
    expect(r.max).toBeCloseTo(0.1);
    expect(r.paso).toBeCloseTo(0.001);
  });
  it('cero: rango por defecto', () => {
    expect(rango(0)).toEqual({ min: 0, max: 100, paso: 1 });
  });
});
