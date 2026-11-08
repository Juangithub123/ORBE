import { describe, expect, it } from 'vitest';
import { LETRAS, atrapar, elegirCayendo, frenarCaida, letraPonderada } from '../src/game/nombre';

describe('elegirCayendo', () => {
  it('con el nombre vacío solo caen letras', () => {
    expect(elegirCayendo(0, 0, 0.08, true)).toEqual({ tipo: 'letra', letra: 'A' });
  });

  it('cada especial tiene su probabilidad', () => {
    expect(elegirCayendo(0.05, 0, 0.08, false).tipo).toBe('borrar');
    expect(elegirCayendo(0.1, 0, 0.08, false).tipo).toBe('borrarTodo');
    expect(elegirCayendo(0.2, 0, 0.08, false).tipo).toBe('ok');
    expect(elegirCayendo(0.3, 0, 0.08, false).tipo).toBe('letra');
  });

  it('las letras incluyen la Ñ y nunca se pasan del abecedario', () => {
    expect(LETRAS).toContain('Ñ');
    expect(elegirCayendo(1, 0.9999, 0.08, true).letra).toBe('Z');
    expect(elegirCayendo(1, 1, 0.08, true).letra).toBe('Z');
  });
});

describe('atrapar', () => {
  it('las letras se agregan y al llegar al máximo se confirma', () => {
    expect(atrapar('AB', 'letra', 'C', 8)).toEqual({ nombre: 'ABC', confirmar: false });
    expect(atrapar('ABCDEFG', 'letra', 'H', 8)).toEqual({ nombre: 'ABCDEFGH', confirmar: true });
  });

  it('⌫ borra una, BORRAR borra todo', () => {
    expect(atrapar('ABC', 'borrar', '', 8).nombre).toBe('AB');
    expect(atrapar('ABC', 'borrarTodo', '', 8).nombre).toBe('');
  });

  it('OK confirma solo si hay nombre', () => {
    expect(atrapar('ANA', 'ok', '', 8)).toEqual({ nombre: 'ANA', confirmar: true });
    expect(atrapar('', 'ok', '', 8)).toEqual({ nombre: '', confirmar: false });
  });
});

describe('letraPonderada', () => {
  const frecuencia = (peso: number) => {
    const cuenta: Record<string, number> = {};
    const n = 10000;
    for (let i = 0; i < n; i++) {
      const l = letraPonderada((i + 0.5) / n, peso);
      cuenta[l] = (cuenta[l] ?? 0) + 1;
    }
    return cuenta;
  };

  it('con peso 1 todas las letras salen igual de seguido', () => {
    const c = frecuencia(1);
    expect(Object.keys(c)).toHaveLength(LETRAS.length);
    expect(Math.abs(c.A - c.B)).toBeLessThanOrEqual(1);
  });

  it('con peso 3 cada vocal sale el triple que una consonante', () => {
    const c = frecuencia(3);
    expect(c.E / c.B).toBeCloseTo(3, 1);
    expect(c.U / c.Z).toBeCloseTo(3, 1);
  });

  it('con peso 0 no salen vocales', () => {
    const c = frecuencia(0);
    for (const v of 'AEIOU') expect(c[v]).toBeUndefined();
  });

  it('los extremos no se pasan del abecedario', () => {
    expect(letraPonderada(0, 2)).toBe('A');
    expect(letraPonderada(1, 2)).toBe('Z');
  });
});

describe('frenarCaida', () => {
  it('sin frenado la velocidad no cambia', () => {
    expect(frenarCaida(160, 0.5, 0, 0)).toBe(160);
  });

  it('frena hasta la velocidad mínima y ahí se queda', () => {
    expect(frenarCaida(160, 1, 40, 0)).toBe(120);
    expect(frenarCaida(30, 1, 40, 0)).toBe(0);
    expect(frenarCaida(0, 1, 40, 0)).toBe(0);
    expect(frenarCaida(100, 1, 40, 80)).toBe(80);
  });

  it('si ya va más lento que el mínimo, no la acelera', () => {
    expect(frenarCaida(50, 1, 40, 80)).toBe(50);
  });
});
