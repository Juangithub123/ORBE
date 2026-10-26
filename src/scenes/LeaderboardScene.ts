import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { ESTILOS } from '../ui/text';
import { ESCENAS, clicable, mostrarCamara } from './shared';

// Ranking local top 10. Se completa en la fase 5.

export class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super(ESCENAS.ranking);
  }

  create() {
    mostrarCamara(this, false);
    const cx = CONFIG.ancho / 2;
    this.add.text(cx, CONFIG.alto / 2 - 40, 'Ranking', ESTILOS.titulo).setOrigin(0.5);
    this.add.text(cx, CONFIG.alto / 2 + 70, 'Se completa en la fase 5', ESTILOS.subtitulo).setOrigin(0.5);
    clicable(this.add.text(cx, CONFIG.alto - 40, '[Esc] o clic acá: volver al menú', ESTILOS.ayuda).setOrigin(0.5), () =>
      this.scene.start(ESCENAS.menu),
    );
    this.input.keyboard!.on('keydown-ESC', () => this.scene.start(ESCENAS.menu));
  }
}
