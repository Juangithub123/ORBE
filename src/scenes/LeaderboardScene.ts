import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { CSS, PALETA } from '../palette';
import { OrbView } from '../game/OrbView';
import { leerRanking } from '../storage/leaderboard';
import { HoldButton } from '../ui/HoldButton';
import { ESTILOS } from '../ui/text';
import { ESCENAS, getInput, mostrarCamara } from './shared';

// Ranking local top 10 (ver storage/leaderboard.ts). Si se llega desde el resultado de una partida,
// esa fila se resalta. "Volver" se activa con el orbe, un clic o Esc.

const PRIMERA_FILA = 165;
const ENTRE_FILAS = 42;
/** Columnas: puesto, dúo, nivel y puntaje. */
const X_PUESTO = 300;
const X_EQUIPO = 350;
const X_NIVEL = 860;
const X_PUNTAJE = 1000;

export class LeaderboardScene extends Phaser.Scene {
  private orbe!: OrbView;
  private volver!: HoldButton;

  constructor() {
    super(ESCENAS.ranking);
  }

  /** `resaltar`: fecha de la partida recién guardada, para marcarla. */
  create(data: { resaltar?: number }) {
    mostrarCamara(this, false);
    const cx = CONFIG.ancho / 2;
    this.add.text(cx, 75, 'Ranking', { ...ESTILOS.titulo, fontSize: '72px' }).setOrigin(0.5);

    const ranking = leerRanking();
    if (ranking.length === 0) {
      this.add.text(cx, CONFIG.alto / 2 - 40, 'Todavía no hay partidas.\n¡Jueguen la primera!', { ...ESTILOS.subtitulo, align: 'center' }).setOrigin(0.5);
    } else {
      const encabezado = { ...ESTILOS.ayuda, fontSize: '18px' };
      this.add.text(X_PUESTO, PRIMERA_FILA - 38, '#', encabezado).setOrigin(1, 0.5);
      this.add.text(X_EQUIPO, PRIMERA_FILA - 38, 'DÚO', encabezado).setOrigin(0, 0.5);
      this.add.text(X_NIVEL, PRIMERA_FILA - 38, 'NIVEL', encabezado).setOrigin(1, 0.5);
      this.add.text(X_PUNTAJE, PRIMERA_FILA - 38, 'PUNTAJE', encabezado).setOrigin(1, 0.5);

      ranking.forEach((p, i) => {
        const y = PRIMERA_FILA + i * ENTRE_FILAS;
        const resaltada = p.fecha === data?.resaltar;
        if (resaltada) {
          this.add.rectangle(cx, y, X_PUNTAJE - X_PUESTO + 140, ENTRE_FILAS - 4, PALETA.meta, 0.18).setStrokeStyle(2, PALETA.metaHalo, 0.8);
        }
        const estilo = { ...ESTILOS.subtitulo, fontSize: '28px', color: resaltada ? CSS.meta : CSS.blanco };
        this.add.text(X_PUESTO, y, `${i + 1}`, estilo).setOrigin(1, 0.5);
        this.add.text(X_EQUIPO, y, p.equipo, { ...estilo, fontStyle: 'bold' }).setOrigin(0, 0.5);
        this.add.text(X_NIVEL, y, p.gano ? '¡ganaron!' : `${p.nivel}`, estilo).setOrigin(1, 0.5);
        this.add.text(X_PUNTAJE, y, `${p.puntaje}`, { ...estilo, fontStyle: 'bold' }).setOrigin(1, 0.5);
      });
    }

    this.volver = new HoldButton(this, cx, CONFIG.alto - 70, 400, 64, 'Volver al menú  [Esc]', () => this.scene.start(ESCENAS.menu));
    this.input.keyboard!.on('keydown-ESC', () => this.volver.activar());
    this.orbe = new OrbView(this, getInput(this));
  }

  update(_t: number, delta: number) {
    this.volver.update(getInput(this), delta);
    this.orbe.update(delta);
  }
}
