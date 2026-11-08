// Reglas del minijuego del nombre del dúo (sin Phaser, para poder probarlas).
// Caen letras y, a veces, objetos especiales: ⌫ (borra una letra), BORRAR (borra todo) y OK (confirma).
// Las vocales pueden caer más seguido (casi todos los nombres las necesitan) y las letras pueden ir frenando
// hasta quedarse quietas, para que sea más fácil atraparlas.

export const LETRAS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
const VOCALES = 'AEIOU';

/** Formas de elegir el nombre: atrapando letras que caen, con un teclado en pantalla o sin nombre (DUO). */
export type ModoNombre = 'caen' | 'teclado' | 'sin';

export type TipoCayendo = 'letra' | 'borrar' | 'borrarTodo' | 'ok';

/** Nombre usado si se arranca sin haber escrito nada (clic en "Listo" con el nombre vacío). */
export const NOMBRE_POR_DEFECTO = 'DUO';

/**
 * Qué cae: con probabilidad `probEspecial` cada especial (⌫, BORRAR, OK) y si no, una letra.
 * Con el nombre vacío los especiales no sirven, así que solo caen letras.
 * Cada vocal pesa `pesoVocales` veces lo que una consonante (1 = todas igual de seguido).
 * `r` y `rLetra` son números al azar entre 0 y 1.
 */
export function elegirCayendo(
  r: number,
  rLetra: number,
  probEspecial: number,
  nombreVacio: boolean,
  pesoVocales = 1,
): { tipo: TipoCayendo; letra: string } {
  if (!nombreVacio) {
    if (r < probEspecial) return { tipo: 'borrar', letra: '' };
    if (r < probEspecial * 2) return { tipo: 'borrarTodo', letra: '' };
    if (r < probEspecial * 3) return { tipo: 'ok', letra: '' };
  }
  return { tipo: 'letra', letra: letraPonderada(rLetra, pesoVocales) };
}

/** Letra al azar (r entre 0 y 1) donde cada vocal pesa `pesoVocales` veces lo que una consonante. */
export function letraPonderada(r: number, pesoVocales: number) {
  const peso = (l: string) => (VOCALES.includes(l) ? Math.max(0, pesoVocales) : 1);
  const total = [...LETRAS].reduce((suma, l) => suma + peso(l), 0);
  let resto = Math.min(Math.max(r, 0), 0.999999) * total;
  for (const l of LETRAS) {
    resto -= peso(l);
    if (resto < 0) return l;
  }
  return LETRAS[LETRAS.length - 1];
}

/**
 * Velocidad de caída después de `dt` segundos: baja `frenado` px/s por segundo hasta `vMinima`
 * (0 = la letra se queda quieta). Sin frenado, sigue igual. Si ya va más lento que el mínimo, no cambia.
 */
export function frenarCaida(v: number, dt: number, frenado: number, vMinima: number) {
  if (frenado <= 0 || v <= vMinima) return v;
  return Math.max(Math.max(0, vMinima), v - frenado * dt);
}

/** Aplica lo atrapado al nombre. `confirmar` es true con OK (si hay nombre) o al llegar al máximo de letras. */
export function atrapar(nombre: string, tipo: TipoCayendo, letra: string, maxLetras: number): { nombre: string; confirmar: boolean } {
  switch (tipo) {
    case 'borrar':
      return { nombre: nombre.slice(0, -1), confirmar: false };
    case 'borrarTodo':
      return { nombre: '', confirmar: false };
    case 'ok':
      return { nombre, confirmar: nombre.length > 0 };
    case 'letra': {
      if (nombre.length >= maxLetras) return { nombre, confirmar: true };
      const nuevo = nombre + letra;
      return { nombre: nuevo, confirmar: nuevo.length >= maxLetras };
    }
  }
}
