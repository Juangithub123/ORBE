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
import { PauseMenuScene } from './scenes/PauseMenuScene';
import { ResultScene } from './scenes/ResultScene';
import { SettingsScene } from './scenes/SettingsScene';
import { StartScene } from './scenes/StartScene';
import type { InputManager } from './input/InputManager';
import { audio } from './audio/AudioEngine';
import { ESCENAS } from './scenes/shared';
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
  // El audio lo maneja AudioEngine (Tone.js); el de Phaser no se usa.
  audio: { noAudio: true },
  scene: [
    BootScene,
    StartScene,
    MenuScene,
    SettingsScene,
    CalibrationScene,
    NameEntryScene,
    GameScene,
    PauseOverlay,
    PauseMenuScene,
    LevelTransitionScene,
    ResultScene,
    LeaderboardScene,
  ],
});

engancharEscenas(game);

// La entrada se actualiza una vez por frame, antes que las escenas.
// El audio toma el volumen de Ajustes (y los parámetros del panel) en el mismo momento.
game.events.on(Phaser.Core.Events.PRE_STEP, (_time: number, delta: number) => {
  const input = game.registry.get('input') as InputManager | undefined;
  input?.update(delta);
  if (input) audio.sincronizar(input.config.volumen);
});

// Las pantallas de menú tienen música tranquila. El juego, la pausa y el resultado cambian el modo ellos mismos.
const ESCENAS_MENU: string[] = [ESCENAS.menu, ESCENAS.ajustes, ESCENAS.ranking, ESCENAS.calibracion, ESCENAS.nombre];
game.events.once(Phaser.Core.Events.READY, () => {
  for (const s of game.scene.scenes) {
    if (ESCENAS_MENU.includes(s.sys.settings.key)) s.events.on(Phaser.Scenes.Events.CREATE, () => audio.cambiarModo('menu'));
  }
});

new PanelParametros(document.getElementById('app')!);

// Solo en desarrollo: acceso al juego y al audio desde la consola del navegador (window.orbe, window.orbeAudio).
if (import.meta.env.DEV) Object.assign(window, { orbe: game, orbeAudio: audio });
