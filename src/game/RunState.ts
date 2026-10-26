import { CONFIG } from '../config';

// Datos de una partida: viajan entre escenas por el registry de Phaser.

export interface RunState {
  /** Nombre del dúo. */
  equipo: string;
  puntaje: number;
  vidas: number;
  /** Índice del nivel actual (0 = primer nivel). */
  nivel: number;
}

export function crearRun(equipo: string): RunState {
  return { equipo, puntaje: 0, vidas: CONFIG.vidasIniciales, nivel: 0 };
}
