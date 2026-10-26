import type * as Phaser from 'phaser';
import type { InputManager } from '../input/InputManager';
import type { RunState } from '../game/RunState';
import { parseTiled, type TiledMap } from '../level/parseTiled';
import type { LevelData } from '../level/types';

// Acceso a los datos compartidos entre escenas (viven en el registry del juego).

export const ESCENAS = {
  boot: 'Boot',
  inicio: 'Start',
  menu: 'Menu',
  ajustes: 'Settings',
  nombre: 'NameEntry',
  juego: 'Game',
  pausa: 'Pause',
  transicion: 'LevelTransition',
  resultado: 'Result',
  ranking: 'Leaderboard',
} as const;

export const getInput = (scene: Phaser.Scene) => scene.registry.get('input') as InputManager;

export const getRun = (scene: Phaser.Scene) => scene.registry.get('run') as RunState | undefined;
export const setRun = (scene: Phaser.Scene, run: RunState | undefined) => scene.registry.set('run', run);

/** Lista ordenada de archivos de nivel (de public/levels/niveles.json). */
export const getNiveles = (scene: Phaser.Scene) => scene.registry.get('niveles') as string[];

const parseados = new Map<string, LevelData>();

/** Nivel ya interpretado (se parsea una sola vez por archivo). */
export function getNivel(scene: Phaser.Scene, indice: number): LevelData {
  const archivo = getNiveles(scene)[indice];
  let nivel = parseados.get(archivo);
  if (!nivel) {
    const mapa = scene.cache.json.get(claveNivel(archivo)) as TiledMap;
    nivel = parseTiled(mapa, archivo.replace(/\.tmj$/, ''));
    parseados.set(archivo, nivel);
  }
  return nivel;
}

export const claveNivel = (archivo: string) => `nivel:${archivo}`;
