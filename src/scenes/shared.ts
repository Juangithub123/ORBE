import type * as Phaser from 'phaser';
import type { InputManager } from '../input/InputManager';
import type { RunState } from '../game/RunState';

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
