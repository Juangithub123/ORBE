import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { OrbView } from '../game/OrbView';
import type { RunState } from '../game/RunState';
import { Hud } from '../ui/Hud';
import { ESTILOS } from '../ui/text';
import { ESCENAS, getInput, getNiveles, getRun } from './shared';

// Un nivel del juego. En la fase 1 está vacío: solo el orbe, el HUD y las salidas.
// Fase 2: rocas, monedas, meta y scroll. Fase 3: cuenta regresiva y pausa.

type Estado = 'cuenta' | 'jugando' | 'pausa' | 'completo' | 'perdido';

export class GameScene extends Phaser.Scene {
  private run!: RunState;
  private orbe!: OrbView;
  private hud!: Hud;
  private estado: Estado = 'jugando';

  constructor() {
    super(ESCENAS.juego);
  }

  create() {
    this.run = getRun(this)!;
    this.estado = 'jugando';

    this.orbe = new OrbView(this, getInput(this));
    this.hud = new Hud(this);

    const cx = CONFIG.ancho / 2;
    const total = getNiveles(this).length;
    this.add
      .text(cx, CONFIG.alto / 2 - 20, `Nivel ${this.run.nivel + 1} de ${total}`, ESTILOS.subtitulo)
      .setOrigin(0.5)
      .setAlpha(0.5);
    this.add
      .text(cx, CONFIG.alto - 30, 'Depuración: [N] pasar de nivel · [K] perder una vida · [1] reiniciar nivel', ESTILOS.ayuda)
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on('keydown-N', () => this.completar());
    kb.on('keydown-ONE', () => this.scene.restart());
    // Temporal hasta la fase 2 (cuando haya rocas): permite probar el GAME OVER.
    kb.on('keydown-K', () => this.danio());
  }

  update(_t: number, delta: number) {
    this.orbe.update(delta);
    this.hud.update(this.run);
  }

  private danio() {
    if (this.estado !== 'jugando') return;
    this.run.vidas = Math.max(0, this.run.vidas - 1);
    this.cameras.main.shake(CONFIG.shakeMs, CONFIG.shakeIntensidad);
    if (this.run.vidas === 0) {
      this.estado = 'perdido';
      this.scene.start(ESCENAS.resultado, { gano: false });
    }
  }

  private completar() {
    if (this.estado !== 'jugando') return;
    this.estado = 'completo';
    if (this.run.nivel + 1 < getNiveles(this).length) {
      this.run.nivel += 1;
      this.scene.start(ESCENAS.transicion);
    } else {
      this.scene.start(ESCENAS.resultado, { gano: true });
    }
  }
}
