import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { ESTILOS } from '../ui/text';
import { ESCENAS, getNivel, getRun } from './shared';

// Pantalla entre niveles: "Nivel N", nombre del nivel y puntaje acumulado.
// Más adelante, acá va la historia.

export class LevelTransitionScene extends Phaser.Scene {
  constructor() {
    super(ESCENAS.transicion);
  }

  create() {
    const run = getRun(this)!;
    const cx = CONFIG.ancho / 2;
    this.add.text(cx, CONFIG.alto / 2 - 60, `Nivel ${run.nivel + 1}`, ESTILOS.titulo).setOrigin(0.5);
    this.add.text(cx, CONFIG.alto / 2 + 50, getNivel(this, run.nivel).nombre, ESTILOS.subtitulo).setOrigin(0.5);
    this.add.text(cx, CONFIG.alto / 2 + 110, `Puntaje: ${run.puntaje}`, ESTILOS.ayuda).setOrigin(0.5);

    this.time.delayedCall(CONFIG.transicionNivelMs, () => this.scene.start(ESCENAS.juego));
  }
}
