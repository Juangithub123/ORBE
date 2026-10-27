import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { PALETA } from '../palette';
import type { InputManager } from '../input/InputManager';
import { ESTILOS, encajar } from './text';

// Botón que se activa manteniendo el CENTRO del orbe encima durante holdMs.
// Se llena de izquierda a derecha; si el orbe sale, se vacía rápido.
// Después de activarse, hay que sacar el orbe y volver a entrar para activarlo otra vez.
// Lo mismo al aparecer: si el orbe ya está encima (por ejemplo, venía de un botón de otra pantalla
// en el mismo lugar), hay que sacarlo primero. Así no se encadenan pantallas sin querer.
// Si falta un jugador, no se llena.
// También se activa con un clic o un toque (para usarlo sin teclado, por ejemplo en una tablet).

const VACIADO = 3;
/** Margen (px) entre el texto y el borde del botón. */
const MARGEN = 20;

export class HoldButton {
  private g: Phaser.GameObjects.Graphics;
  private texto: Phaser.GameObjects.Text;
  private zona: Phaser.GameObjects.Zone;
  private progreso = 0;
  /** Arranca bloqueado: se desbloquea cuando el orbe está afuera. */
  private bloqueado = true;
  /** Si es false, el botón se ve apagado y no se llena. */
  habilitado = true;

  constructor(
    private scene: Phaser.Scene,
    private x: number,
    private y: number,
    private ancho: number,
    private alto: number,
    etiqueta: string,
    private alActivar: () => void,
  ) {
    this.g = scene.add.graphics().setDepth(5);
    this.texto = scene.add
      .text(x, y, etiqueta, { ...ESTILOS.boton, fontSize: '26px', align: 'center' })
      .setOrigin(0.5)
      .setDepth(6);
    this.zona = scene.add
      .zone(x, y, ancho, alto)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.activar());
  }

  /** Cambia el texto; si no entra en el botón, se achica. */
  setTexto(etiqueta: string) {
    if (etiqueta === this.texto.text) return this;
    encajar(this.texto.setText(etiqueta), this.ancho - MARGEN * 2);
    return this;
  }

  /** Si el punto (x, y) está dentro del botón. */
  contiene(x: number, y: number) {
    return Math.abs(x - this.x) <= this.ancho / 2 && Math.abs(y - this.y) <= this.alto / 2;
  }

  update(input: InputManager, deltaMs: number) {
    const { orb } = input;
    const adentro = this.contiene(orb.x, orb.y) && input.count === 2;
    if (!adentro) this.bloqueado = false;

    const paso = deltaMs / CONFIG.holdMs;
    const llenando = adentro && !this.bloqueado && this.habilitado;
    this.progreso = Phaser.Math.Clamp(this.progreso + (llenando ? paso : -paso * VACIADO), 0, 1);
    if (this.progreso >= 1) {
      this.progreso = 0;
      this.bloqueado = true;
      this.activar();
    }
    this.dibujar(adentro && this.habilitado);
  }

  /** Activa el botón (también lo usan los atajos de teclado). */
  activar() {
    if (!this.habilitado) return;
    // Fase 6: acorde corto de botón activado.
    const escala = Math.min(1, (this.ancho - MARGEN * 2) / this.texto.width);
    this.scene.tweens.add({ targets: this.texto, scale: { from: escala * 1.15, to: escala }, duration: 200, ease: 'Quad.easeOut' });
    this.alActivar();
  }

  private dibujar(resaltado: boolean) {
    const { g, x, y, ancho, alto } = this;
    const izq = x - ancho / 2;
    const arriba = y - alto / 2;
    g.clear();
    this.texto.setAlpha(this.habilitado ? 1 : 0.35);
    if (this.progreso > 0) {
      g.fillStyle(PALETA.orbe, 0.3);
      g.fillRoundedRect(izq, arriba, Math.max(ancho * this.progreso, 12), alto, 12);
    }
    g.lineStyle(resaltado ? 3 : 2, PALETA.orbe, this.habilitado ? (resaltado ? 1 : 0.7) : 0.25);
    g.strokeRoundedRect(izq, arriba, ancho, alto, 12);
  }

  destroy() {
    this.g.destroy();
    this.texto.destroy();
    this.zona.destroy();
  }
}
