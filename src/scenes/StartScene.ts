import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { ESTILOS } from '../ui/text';
import { crearRun } from '../game/RunState';
import { ESCENAS, getInput, getNiveles, setRun, mostrarCamara } from './shared';

// "Hacé clic para empezar": los navegadores piden un gesto del usuario
// para iniciar el audio, la pantalla completa y la cámara.

export class StartScene extends Phaser.Scene {
  private arrancando = false;

  constructor() {
    super(ESCENAS.inicio);
  }

  create() {
    mostrarCamara(this, false);
    this.arrancando = false;
    const cx = CONFIG.ancho / 2;
    this.add.text(cx, CONFIG.alto / 2 - 40, 'ORBE', ESTILOS.titulo).setOrigin(0.5);
    this.add
      .text(cx, CONFIG.alto / 2 + 70, 'Hacé clic o presioná una tecla para empezar', ESTILOS.subtitulo)
      .setOrigin(0.5);

    this.input.once('pointerdown', () => this.arrancar());
    this.input.keyboard?.once('keydown', () => this.arrancar());
  }

  private async arrancar() {
    if (this.arrancando) return;
    this.arrancando = true;

    // Fase 6: AudioEngine.resume().
    if (!this.scale.isFullscreen) {
      try {
        this.scale.startFullscreen();
      } catch {
        // Si el navegador no deja, se sigue en ventana.
      }
    }

    const input = getInput(this);
    if (input.config.modoEntrada !== 'teclado') {
      this.add
        .text(CONFIG.ancho / 2, CONFIG.alto - 80, 'Preparando la cámara… (si el navegador pregunta, permití el acceso)', ESTILOS.ayuda)
        .setOrigin(0.5);
    }
    const resultado = await input.start();

    // Depuración: ?nivel=2 arranca directo en ese nivel con un dúo de prueba.
    const nivel = Number(new URLSearchParams(location.search).get('nivel'));
    if (nivel >= 1 && nivel <= getNiveles(this).length) {
      setRun(this, { ...crearRun('PRUEBA'), nivel: nivel - 1 });
      this.scene.start(ESCENAS.juego);
      return;
    }

    const aviso = resultado.ok ? undefined : `No se pudo usar la cámara (${input.error}): se pasó a modo teclado.`;
    this.scene.start(ESCENAS.menu, { aviso });
  }
}
