import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { ESTILOS } from '../ui/text';
import { ESCENAS, getInput } from './shared';

// Overlay de pausa cuando falta un jugador (referencia: docs/referencias/td_pausa.png).
// Oscurece el juego y muestra "PAUSA" con la cantidad de jugadores detectados.
// La abre y la cierra GameScene según la presencia de los jugadores.

export class PauseOverlay extends Phaser.Scene {
  private numero!: Phaser.GameObjects.Text;

  constructor() {
    super(ESCENAS.pausa);
  }

  create() {
    const cx = CONFIG.ancho / 2;
    const cy = CONFIG.alto / 2;
    this.add.rectangle(0, 0, CONFIG.ancho, CONFIG.alto, 0x000000, 0.6).setOrigin(0);
    this.add.text(cx, cy - 70, 'PAUSA', { ...ESTILOS.titulo, fontSize: '130px' }).setOrigin(0.5);
    this.numero = this.add.text(cx, cy + 50, '', { ...ESTILOS.hudPuntaje, fontSize: '56px' }).setOrigin(0.5);
    this.add.text(cx, cy + 115, 'Falta un jugador: párense los dos frente a la cámara', ESTILOS.subtitulo).setOrigin(0.5);
  }

  update() {
    // Jugadores detectados en este momento (sin esperar la histéresis de presencia).
    this.numero.setText(`${getInput(this).countCrudo} / 2`);
  }
}
