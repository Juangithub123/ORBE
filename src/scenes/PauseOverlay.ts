import * as Phaser from 'phaser';
import { ESCENAS } from './shared';

// Overlay de pausa cuando falta un jugador. Se implementa en la fase 3
// (referencia: docs/referencias/td_pausa.png).

export class PauseOverlay extends Phaser.Scene {
  constructor() {
    super(ESCENAS.pausa);
  }

  create() {}
}
