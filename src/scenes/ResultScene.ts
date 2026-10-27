import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { PALETA } from '../palette';
import { OrbView } from '../game/OrbView';
import { crearRun } from '../game/RunState';
import { ESTILOS, encajar } from '../ui/text';
import { HoldButton } from '../ui/HoldButton';
import { guardarPartida } from '../storage/leaderboard';
import { CSS } from '../palette';
import { ESCENAS, clicable, getInput, getNiveles, getRun, setRun, mostrarCamara } from './shared';

// GAME OVER / ¡GANARON!, igual que las capturas de TD.
// Acercarse durante holdMs (o la tecla 1, o un clic en el texto) reinicia con el mismo dúo.
// La partida se guarda en el ranking al llegar acá (salvo las de prueba) y se muestra el puesto.
// Menú y Ranking son botones que se llenan con el orbe; con el orbe sobre un botón, acercarse no reinicia.

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
  private botones: HoldButton[] = [];

  constructor() {
    super(ESCENAS.resultado);
  }

  create(data: { gano: boolean }) {
    mostrarCamara(this, false);
    const run = getRun(this)!;
    const cx = CONFIG.ancho / 2;
    const cy = CONFIG.alto / 2;
    this.progreso = 0;
    this.desde = this.time.now;
    this.reiniciando = false;

    this.add.text(cx, cy - 30, data.gano ? '¡GANARON!' : 'GAME OVER', ESTILOS.titulo).setOrigin(0.5);
    const texto = data.gano ? 'Acérquense entre sí para jugar de nuevo (o tecla 1)' : 'Acérquense entre sí para reiniciar (o tecla 1)';
    clicable(encajar(this.add.text(cx, cy + 70, texto, ESTILOS.subtitulo).setOrigin(0.5), CONFIG.ancho - 40), () => this.reiniciar());
    const nivel = data.gano ? getNiveles(this).length : run.nivel + 1;
    this.add
      .text(cx, cy - 170, `${run.equipo} · Puntaje: ${run.puntaje} · Nivel ${nivel}`, { ...ESTILOS.subtitulo, fontSize: '28px' })
      .setOrigin(0.5);

    // Guardado en el ranking (una sola vez por partida; las de prueba no cuentan).
    const fecha = Date.now();
    if (!run.prueba) {
      const puesto = guardarPartida({ equipo: run.equipo, puntaje: run.puntaje, nivel, gano: data.gano, fecha });
      const texto = puesto ? `¡Puesto ${puesto} en el ranking!` : 'Esta vez no entraron en el top 10';
      this.add.text(cx, cy + 125, texto, { ...ESTILOS.subtitulo, fontSize: '28px', color: puesto ? CSS.meta : CSS.gris }).setOrigin(0.5);
    }

    const menu = new HoldButton(this, cx - 220, CONFIG.alto - 85, 360, 64, 'Menú  [M]', () => this.scene.start(ESCENAS.menu));
    const ranking = new HoldButton(this, cx + 220, CONFIG.alto - 85, 360, 64, 'Ranking  [R]', () =>
      this.scene.start(ESCENAS.ranking, { resaltar: fecha }),
    );
    this.botones = [menu, ranking];

    const kb = this.input.keyboard!;
    kb.on('keydown-ONE', () => this.reiniciar());
    kb.on('keydown-M', () => menu.activar());
    kb.on('keydown-R', () => ranking.activar());

    this.orbe = new OrbView(this, getInput(this));
    this.anillo = this.add.graphics().setDepth(11);
  }

  update(time: number, delta: number) {
    this.orbe.update(delta);

    const input = getInput(this);
    for (const b of this.botones) b.update(input, delta);
    const sobreBoton = this.botones.some((b) => b.contiene(input.orb.x, input.orb.y));
    const cerca = !sobreBoton && input.count === 2 && input.orb.dist < CONFIG.distCerca && time - this.desde > GRACIA_MS;
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
