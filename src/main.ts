import * as Phaser from 'phaser';
import { PALETA } from './palette';
import { BootScene } from './scenes/BootScene';
import { CalibrationScene } from './scenes/CalibrationScene';
import { GameScene } from './scenes/GameScene';
import { LeaderboardScene } from './scenes/LeaderboardScene';
import { LevelTransitionScene } from './scenes/LevelTransitionScene';
import { MenuScene } from './scenes/MenuScene';
import { NameEntryScene } from './scenes/NameEntryScene';
import { PauseOverlay } from './scenes/PauseOverlay';
import { ResultScene } from './scenes/ResultScene';
import { SettingsScene } from './scenes/SettingsScene';
import { StartScene } from './scenes/StartScene';
import type { InputManager } from './input/InputManager';
import { engancharEscenas, iniciarResolucion, tamanoCanvas } from './pantalla';
import { cargarParametros } from './storage/parametros';
import { cargarAjustes } from './storage/settings';
import { PanelParametros } from './ui/PanelParametros';

// Los parámetros cambiados a mano en el panel se aplican antes de crear el juego.
cargarParametros();
// El canvas se crea con la resolución guardada en Ajustes; la lógica sigue en CONFIG.ancho × CONFIG.alto.
iniciarResolucion(cargarAjustes().resolucion);

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'app',
  ...tamanoCanvas(),
  backgroundColor: PALETA.fondo,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // En pantalla completa entra todo #app (no solo el canvas), así se siguen viendo
    // la miniatura de la cámara y el panel de parámetros, que son HTML encima del juego.
    fullscreenTarget: 'app',
  },
  scene: [
    BootScene,
    StartScene,
    MenuScene,
    SettingsScene,
    CalibrationScene,
    NameEntryScene,
    GameScene,
    PauseOverlay,
    LevelTransitionScene,
    ResultScene,
    LeaderboardScene,
  ],
});

engancharEscenas(game);

// La entrada se actualiza una vez por frame, antes que las escenas.
game.events.on(Phaser.Core.Events.PRE_STEP, (_time: number, delta: number) => {
  (game.registry.get('input') as InputManager | undefined)?.update(delta);
});

new PanelParametros(document.getElementById('app')!);

// Solo en desarrollo: acceso al juego desde la consola del navegador (window.orbe).
if (import.meta.env.DEV) (window as unknown as { orbe: Phaser.Game }).orbe = game;
