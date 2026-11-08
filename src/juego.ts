import * as Phaser from 'phaser';
import { CONFIG } from './config';
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
import { engancharEscenas, iniciarResolucion, ponerHorizontal, tamanoCanvas } from './pantalla';
import { cargarParametros } from './storage/parametros';
import { cargarAjustes } from './storage/settings';
import { elegirPerfil, resolverPerfil } from './perfil';
import { PanelParametros } from './ui/PanelParametros';
import { MedidorRendimiento } from './ui/MedidorRendimiento';
import { PuenteJuego } from './control/PuenteJuego';
import { abrirVentanaControl } from './control/abrir';

// Los parámetros cambiados a mano en el panel se aplican antes de crear el juego.
cargarParametros();
// El canvas se crea con el perfil y la resolución guardados en Ajustes (el perfil se puede cambiar en la
// pantalla de inicio); la lógica sigue en CONFIG.ancho × CONFIG.alto.
const ajustesIniciales = cargarAjustes();
elegirPerfil(resolverPerfil(ajustesIniciales.perfil));
iniciarResolucion(ajustesIniciales.resolucion);

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
  // GPU de alto rendimiento (en notebooks con dos GPU, la dedicada).
  render: { powerPreference: 'high-performance' },
  // En pantallas de 90 o 120 Hz (muchas tablets) no hace falta dibujar más de fpsMax cuadros por segundo.
  fps: { limit: CONFIG.fpsMax },
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
// En celulares y tablets, al entrar en pantalla completa se traba la orientación horizontal.
game.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, ponerHorizontal);

// La entrada se actualiza una vez por frame, antes que las escenas.
// El audio toma el volumen de Ajustes (y los parámetros del panel) en el mismo momento.
game.events.on(Phaser.Core.Events.PRE_STEP, (_time: number, delta: number) => {
  const input = game.registry.get('input') as InputManager | undefined;
  input?.update(delta);
  if (input) audio.sincronizar(input.config.volumen);
  // fpsMax se puede cambiar desde el panel con el juego andando.
  if (game.loop.fpsLimit !== CONFIG.fpsMax) game.loop.setFPSLimit(CONFIG.fpsMax);
});

// Las pantallas de menú tienen música tranquila. El juego, la pausa y el resultado cambian el modo ellos mismos.
const ESCENAS_MENU: string[] = [ESCENAS.menu, ESCENAS.ajustes, ESCENAS.ranking, ESCENAS.calibracion, ESCENAS.nombre];
game.events.once(Phaser.Core.Events.READY, () => {
  for (const s of game.scene.scenes) {
    if (ESCENAS_MENU.includes(s.sys.settings.key)) s.events.on(Phaser.Scenes.Events.CREATE, () => audio.cambiarModo('menu'));
  }
});

const panel = new PanelParametros(document.getElementById('app')!);
// Ventana de control (para el operador): se abre con F4 o desde el panel ⚙, y habla con el juego por PuenteJuego.
new PuenteJuego(game, () => panel.refrescar());
window.addEventListener('keydown', (e) => {
  if (e.key !== 'F4') return;
  e.preventDefault();
  abrirVentanaControl();
});
new MedidorRendimiento(game, () => game.registry.get('input') as InputManager | undefined);

// Solo en desarrollo: acceso al juego y al audio desde la consola del navegador (window.orbe, window.orbeAudio).
if (import.meta.env.DEV) Object.assign(window, { orbe: game, orbeAudio: audio });
