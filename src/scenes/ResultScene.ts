import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { OrbView } from '../game/OrbView';
import { crearRun } from '../game/RunState';
import { ESTILOS } from '../ui/text';
import { ESCENAS, getInput, getNiveles, getRun, setRun } from './shared';

// GAME OVER / ¡GANARON!, igual que las capturas de TD.
// Fase 3: reinicio acercándose (anillo que se llena). Fase 5: guardado en el ranking y botón Menú.

export class ResultScene extends Phaser.Scene {
  private orbe!: OrbView;

  constructor() {
    super(ESCENAS.resultado);
  }

  create(data: { gano: boolean }) {
    const run = getRun(this)!;
    const cx = CONFIG.ancho / 2;
    const cy = CONFIG.alto / 2;

    this.add.text(cx, cy - 30, data.gano ? '¡GANARON!' : 'GAME OVER', ESTILOS.titulo).setOrigin(0.5);
    this.add
      .text(cx, cy + 70, data.gano ? 'Acérquense entre sí para jugar de nuevo (o tecla 1)' : 'Acérquense entre sí para reiniciar (o tecla 1)', ESTILOS.subtitulo)
      .setOrigin(0.5);
    const nivel = data.gano ? getNiveles(this).length : run.nivel + 1;
    this.add
      .text(cx, cy - 170, `${run.equipo} · Puntaje: ${run.puntaje} · Nivel ${nivel}`, ESTILOS.ayuda)
      .setOrigin(0.5);
    this.add.text(cx, CONFIG.alto - 30, '[M] volver al menú', ESTILOS.ayuda).setOrigin(0.5);

    const kb = this.input.keyboard!;
    // Reinicia con el mismo dúo, sin volver a escribir el nombre.
    kb.on('keydown-ONE', () => {
      setRun(this, crearRun(run.equipo));
      this.scene.start(ESCENAS.juego);
    });
    kb.on('keydown-M', () => this.scene.start(ESCENAS.menu));

    this.orbe = new OrbView(this, getInput(this));
  }

  update(_t: number, delta: number) {
    this.orbe.update(delta);
  }
}
