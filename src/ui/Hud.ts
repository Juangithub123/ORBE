import type * as Phaser from 'phaser';
import { CONFIG } from '../config';
import type { RunState } from '../game/RunState';
import { ESTILOS } from './text';

// HUD del juego: "Vidas: N" arriba a la izquierda y el puntaje (entero) arriba al centro.
// Queda fijo en pantalla aunque la cámara se mueva.

export class Hud {
  private vidas: Phaser.GameObjects.Text;
  private puntaje: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.vidas = scene.add.text(55, 52, '', ESTILOS.hudVidas).setScrollFactor(0).setDepth(100);
    this.puntaje = scene.add
      .text(CONFIG.ancho / 2, 64, '', ESTILOS.hudPuntaje)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);
  }

  update(run: RunState) {
    this.vidas.setText(`Vidas: ${run.vidas}`);
    this.puntaje.setText(String(Math.round(run.puntaje)));
  }
}
