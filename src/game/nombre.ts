// Reglas del minijuego del nombre del dúo (sin Phaser, para poder probarlas).
// Caen letras y, a veces, objetos especiales: ⌫ (borra una letra), BORRAR (borra todo) y OK (confirma).

export const LETRAS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';

export type TipoCayendo = 'letra' | 'borrar' | 'borrarTodo' | 'ok';

/** Nombre usado si se arranca sin haber escrito nada (clic en "Listo" con el nombre vacío). */
export const NOMBRE_POR_DEFECTO = 'DUO';

/**
 * Qué cae: con probabilidad `probEspecial` cada especial (⌫, BORRAR, OK) y si no, una letra.
 * Con el nombre vacío los especiales no sirven, así que solo caen letras.
 * `r` y `rLetra` son números al azar entre 0 y 1.
 */
export function elegirCayendo(r: number, rLetra: number, probEspecial: number, nombreVacio: boolean): { tipo: TipoCayendo; letra: string } {
  if (!nombreVacio) {
    if (r < probEspecial) return { tipo: 'borrar', letra: '' };
    if (r < probEspecial * 2) return { tipo: 'borrarTodo', letra: '' };
    if (r < probEspecial * 3) return { tipo: 'ok', letra: '' };
  }
  return { tipo: 'letra', letra: LETRAS[Math.min(LETRAS.length - 1, Math.floor(rLetra * LETRAS.length))] };
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
