import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { ESTILOS } from '../ui/text';
import { ESCENAS } from './shared';

// Ajustes del dispositivo. Se completa en la fase 4 (entrada, calibración, cámara, volumen).

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super(ESCENAS.ajustes);
  }

  create() {
    const cx = CONFIG.ancho / 2;
    this.add.text(cx, CONFIG.alto / 2 - 40, 'Ajustes', ESTILOS.titulo).setOrigin(0.5);
    this.add.text(cx, CONFIG.alto / 2 + 70, 'Se completa en la fase 4', ESTILOS.subtitulo).setOrigin(0.5);
    this.add.text(cx, CONFIG.alto - 40, '[Esc] volver al menú', ESTILOS.ayuda).setOrigin(0.5);
    this.input.keyboard!.on('keydown-ESC', () => this.scene.start(ESCENAS.menu));
  }
}
