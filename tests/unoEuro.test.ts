import { describe, expect, it } from 'vitest';
import { FiltroUnoEuro } from '../src/input/unoEuro';

/** Temblor determinístico de ±0,004 (unos 2,5 píxeles de una cámara de 640: lo típico de MediaPipe en quieto). */
const temblor = (i: number) => Math.sin(i * 12.9898) * 0.004;

/** Mayor desvío de la salida respecto de 0,5 con la mano quieta (después de estabilizarse). */
function desvioQuieto(f: FiltroUnoEuro) {
  let max = 0;
  for (let i = 0; i < 120; i++) {
    const y = f.filtrar(0.5 + temblor(i), i / 30);
    if (i > 30) max = Math.max(max, Math.abs(y - 0.5));
  }
  return max;
}

/** Cuánto le falta a la salida después de un movimiento de 0 a 1 en medio segundo (velocidad 2/s). */
function retardoRapido(f: FiltroUnoEuro) {
  let y = 0;
  for (let i = 0; i <= 15; i++) y = f.filtrar(i / 15, i / 30);
  return 1 - y;
}

describe('FiltroUnoEuro', () => {
  it('el primer valor pasa tal cual', () => {
    expect(new FiltroUnoEuro().filtrar(0.42, 0)).toBe(0.42);
  });

  it('con la mano quieta, saca más de la mitad del temblor', () => {
    expect(desvioQuieto(new FiltroUnoEuro(0.8, 5))).toBeLessThan(0.004 * 0.5);
  });

  it('en un movimiento rápido, se atrasa mucho menos que un suavizado fijo igual de fuerte en quieto', () => {
    const unoEuro = retardoRapido(new FiltroUnoEuro(0.8, 5));
    const fijo = retardoRapido(new FiltroUnoEuro(0.8, 0));
    expect(unoEuro).toBeLessThan(fijo * 0.6);
  });

  it('reiniciar vuelve a tomar el primer valor tal cual', () => {
    const f = new FiltroUnoEuro();
    f.filtrar(0.1, 0);
    f.filtrar(0.2, 0.1);
    f.reiniciar();
    expect(f.filtrar(0.9, 0.2)).toBe(0.9);
  });
});
