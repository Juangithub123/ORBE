import type * as Phaser from 'phaser';
import { CONFIG } from '../config';
import type { InputManager } from '../input/InputManager';
import type { Roca } from '../level/types';
import type { Vec2 } from '../game/orb';
import { FUENTE } from './text';

// Overlay de depuración (F1): FPS, entrada, orbe, scroll y polígonos de colisión.

export interface DatosDebug {
  orbeMundo: Vec2;
  radio: number;
  vel: number;
  estado: string;
  invulnerableTotal: boolean;
  rocas: Roca[];
}

export class DebugOverlay {
  private texto: Phaser.GameObjects.Text;
  private g: Phaser.GameObjects.Graphics;
  visible = CONFIG.debug;

  constructor(
    private scene: Phaser.Scene,
    private input: InputManager,
  ) {
    this.g = scene.add.graphics().setDepth(90);
    this.texto = scene.add
      .text(12, CONFIG.alto - 12, '', { fontFamily: FUENTE, fontSize: '16px', color: '#00ff88', backgroundColor: '#000000aa' })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(200);
  }

  alternar() {
    this.visible = !this.visible;
  }

  update(d: DatosDebug) {
    this.g.clear();
    this.texto.setVisible(this.visible);
    if (!this.visible) return;

    const { orb, count, countCrudo, modo } = this.input;
    this.texto.setText(
      [
        `FPS ${this.scene.game.loop.actualFps.toFixed(0)}`,
        `entrada ${modo} · jugadores ${count} (crudo ${countCrudo})`,
        `radio ${d.radio.toFixed(1)} · cercanía ${orb.cercania.toFixed(2)} · dist ${orb.dist.toFixed(0)}`,
        `vel ${d.vel.toFixed(0)} px/s · scrollY ${this.scene.cameras.main.scrollY.toFixed(0)} · ${d.estado}${d.invulnerableTotal ? ' · INVULNERABLE (G)' : ''}`,
      ].join('\n'),
    );

    this.g.lineStyle(2, 0x00ff88, 0.9);
    for (const r of d.rocas) this.g.strokePoints(r.puntos as Phaser.Math.Vector2[], true, true);
    this.g.lineStyle(2, d.radio >= CONFIG.radioRomper ? 0xff8a30 : 0x00ff88, 1);
    this.g.strokeCircle(d.orbeMundo.x, d.orbeMundo.y, d.radio);
  }
}
