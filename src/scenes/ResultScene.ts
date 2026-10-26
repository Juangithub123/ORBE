import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { PALETA } from '../palette';
import { OrbView } from '../game/OrbView';
import { crearRun } from '../game/RunState';
import { ESTILOS } from '../ui/text';
import { ESCENAS, getInput, getNiveles, getRun, setRun } from './shared';

// GAME OVER / ¡GANARON!, igual que las capturas de TD.
// Acercarse durante holdMs (o la tecla 1) reinicia con el mismo dúo.
// Fase 5: guardado en el ranking y botón Menú que se llena con el orbe.

/** Al entrar, se ignora la cercanía un momento para no reiniciar sin querer. */
const GRACIA_MS = 1000;
/** Velocidad a la que se vacía el anillo al alejarse (veces más rápido que el llenado). */
const VACIADO = 3;

export class ResultScene extends Phaser.Scene {
  private orbe!: OrbView;
  private anillo!: Phaser.GameObjects.Graphics;
  private progreso = 0;
  private desde = 0;
  private reiniciando = false;

  constructor() {
    super(ESCENAS.resultado);
  }

  create(data: { gano: boolean }) {
    const run = getRun(this)!;
    const cx = CONFIG.ancho / 2;
    const cy = CONFIG.alto / 2;
    this.progreso = 0;
    this.desde = this.time.now;
    this.reiniciando = false;

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
    kb.on('keydown-ONE', () => this.reiniciar());
    kb.on('keydown-M', () => this.scene.start(ESCENAS.menu));

    this.orbe = new OrbView(this, getInput(this));
    this.anillo = this.add.graphics().setDepth(11);
  }

  update(time: number, delta: number) {
    this.orbe.update(delta);

    const input = getInput(this);
    const cerca = input.count === 2 && input.orb.dist < CONFIG.distCerca && time - this.desde > GRACIA_MS;
    const paso = delta / CONFIG.holdMs;
    this.progreso = Phaser.Math.Clamp(this.progreso + (cerca ? paso : -paso * VACIADO), 0, 1);
    if (this.progreso >= 1) this.reiniciar();

    this.dibujarAnillo();
  }

  private dibujarAnillo() {
    const g = this.anillo;
    g.clear();
    if (this.progreso <= 0) return;
    const { x, y } = this.orbe.mundo;
    const r = this.orbe.radio + 18;
    const inicio = -Math.PI / 2;
    g.lineStyle(6, PALETA.orbe, 0.25);
    g.strokeCircle(x, y, r);
    g.lineStyle(6, PALETA.orbe, 1);
    g.beginPath();
    g.arc(x, y, r, inicio, inicio + this.progreso * Math.PI * 2, false);
    g.strokePath();
  }

  /** Reinicia en el Nivel 1 con el mismo dúo, sin volver a escribir el nombre. */
  private reiniciar() {
    if (this.reiniciando) return;
    this.reiniciando = true;
    // Fase 6: acorde de botón activado.
    setRun(this, crearRun(getRun(this)!.equipo));
    this.scene.start(ESCENAS.juego);
  }
}
