import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { PALETA } from '../palette';
import type { InputManager } from '../input/InputManager';
import { ESTILOS } from './text';

// Botón que se activa manteniendo el CENTRO del orbe encima durante holdMs.
// Se llena de izquierda a derecha; si el orbe sale, se vacía rápido.
// Después de activarse, hay que sacar el orbe y volver a entrar para activarlo otra vez.
// Si falta un jugador, no se llena.

const VACIADO = 3;

export class HoldButton {
  private g: Phaser.GameObjects.Graphics;
  private texto: Phaser.GameObjects.Text;
  private progreso = 0;
  private bloqueado = false;
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
  }

  setTexto(etiqueta: string) {
    this.texto.setText(etiqueta);
    return this;
  }

  update(input: InputManager, deltaMs: number) {
    const { orb } = input;
    const adentro =
      Math.abs(orb.x - this.x) <= this.ancho / 2 && Math.abs(orb.y - this.y) <= this.alto / 2 && input.count === 2;
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
    this.scene.tweens.add({ targets: this.texto, scale: { from: 1.15, to: 1 }, duration: 200, ease: 'Quad.easeOut' });
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
  }
}
