import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { PALETA } from '../palette';
import type { InputManager } from '../input/InputManager';
import type { Vec2 } from './orb';

// Dibujo del orbe: círculo blanco con halo, estela hacia abajo (en coordenadas de mundo)
// y los dos anillos grises de los jugadores.
// Todo se dibuja en coordenadas de mundo: pantallaY + camara.scrollY.

const RADIO_MARCADOR = 22;

export class OrbView {
  private g: Phaser.GameObjects.Graphics;
  private estela: (Vec2 & { r: number })[] = [];
  private radioVisible: number;
  /** Mostrar u ocultar los anillos de los jugadores. */
  marcadores = true;
  /** Si es true, el orbe parpadea (invulnerabilidad). */
  parpadeo = false;

  constructor(
    private scene: Phaser.Scene,
    private input: InputManager,
    depth = 10,
  ) {
    this.g = scene.add.graphics().setDepth(depth);
    this.radioVisible = input.orb.radio;
  }

  /** Radio tal como se dibuja (sigue al radio real con un leve suavizado). Es el que se usa para chocar. */
  get radio() {
    return this.radioVisible;
  }

  /** Posición del centro del orbe en coordenadas de mundo. */
  get mundo(): Vec2 {
    const cam = this.scene.cameras.main;
    return { x: this.input.orb.x + cam.scrollX, y: this.input.orb.y + cam.scrollY };
  }

  update(deltaMs: number) {
    const { orb, p1, p2 } = this.input;
    const cam = this.scene.cameras.main;
    const k = 1 - Math.pow(0.8, deltaMs / (1000 / 60));
    this.radioVisible += (orb.radio - this.radioVisible) * k;
    const centro = this.mundo;

    this.estela.unshift({ x: centro.x, y: centro.y, r: this.radioVisible });
    if (this.estela.length > CONFIG.estelaCopias + 1) this.estela.length = CONFIG.estelaCopias + 1;

    const g = this.g;
    g.clear();

    // Anillos de los jugadores.
    if (this.marcadores) {
      g.lineStyle(2, PALETA.marcador, 0.6);
      g.strokeCircle(p1.x + cam.scrollX, p1.y + cam.scrollY, RADIO_MARCADOR);
      g.strokeCircle(p2.x + cam.scrollX, p2.y + cam.scrollY, RADIO_MARCADOR);
    }

    const visible = !this.parpadeo || Math.floor(this.scene.time.now / 80) % 2 === 0;
    if (!visible) return;

    // Estela: copias anteriores que se desvanecen.
    for (let i = this.estela.length - 1; i >= 1; i--) {
      const e = this.estela[i];
      const t = 1 - i / (this.estela.length + 1);
      g.fillStyle(PALETA.orbe, 0.12 * t);
      g.fillCircle(e.x, e.y, e.r * (0.7 + 0.3 * t));
    }

    // Halo: círculos concéntricos cada vez más transparentes.
    const r = this.radioVisible;
    for (let i = 4; i >= 1; i--) {
      g.fillStyle(PALETA.orbe, 0.06);
      g.fillCircle(centro.x, centro.y, r * (1 + i * 0.18));
    }
    g.fillStyle(PALETA.orbe, 1);
    g.fillCircle(centro.x, centro.y, r);
  }

  /** Borra la estela (por ejemplo, al reiniciar un nivel o mover la cámara de golpe). */
  limpiarEstela() {
    this.estela.length = 0;
  }

  destroy() {
    this.g.destroy();
  }
}
