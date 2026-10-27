import { describe, expect, it } from 'vitest';
import { LETRAS, atrapar, elegirCayendo } from '../src/game/nombre';

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
