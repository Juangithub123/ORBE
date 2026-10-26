import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { ESTILOS } from '../ui/text';
import { ESCENAS, getInput } from './shared';

// "Hacé clic para empezar": los navegadores piden un gesto del usuario
// para iniciar el audio, la pantalla completa y la cámara.

export class StartScene extends Phaser.Scene {
  private arrancando = false;

  constructor() {
    super(ESCENAS.inicio);
  }

  create() {
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

    const resultado = await getInput(this).start();
    const aviso = resultado.ok ? undefined : 'No se pudo usar la cámara: se pasó a modo teclado.';
    this.scene.start(ESCENAS.menu, { aviso });
  }
}
