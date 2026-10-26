import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { PALETA } from '../palette';
import { OrbView } from '../game/OrbView';
import { ESTILOS, encajar } from '../ui/text';
import { ESCENAS, NOMBRE_MODO, clicable, getInput, mostrarCamara, setRun } from './shared';

// Menú principal. En la fase 5 los botones pasan a ser HoldButton (se llenan con el orbe encima).
// Por ahora se usan con un clic o toque, o con los atajos de teclado.

const BOTONES = [
  { texto: 'Jugar', tecla: 'Enter', escena: ESCENAS.nombre },
  { texto: 'Ranking', tecla: 'R', escena: ESCENAS.ranking },
  { texto: 'Ajustes', tecla: 'O', escena: ESCENAS.ajustes },
];

export class MenuScene extends Phaser.Scene {
  private orbe!: OrbView;
  private avisoFalta!: Phaser.GameObjects.Text;

  constructor() {
    super(ESCENAS.menu);
  }

  create(data: { aviso?: string }) {
    mostrarCamara(this, true);
    // Volver al menú termina el dúo actual: el próximo "Jugar" es un dúo nuevo.
    setRun(this, undefined);

    const cx = CONFIG.ancho / 2;
    this.add.text(cx, 120, 'ORBE', ESTILOS.titulo).setOrigin(0.5);
    this.add.text(cx, 210, 'La salida es colectiva', ESTILOS.subtitulo).setOrigin(0.5);

    const g = this.add.graphics();
    BOTONES.forEach((b, i) => {
      const x = cx + (i - 1) * 320;
      const y = 400;
      g.lineStyle(2, PALETA.orbe, 0.7);
      g.strokeRoundedRect(x - 130, y - 50, 260, 100, 14);
      this.add.text(x, y - 8, b.texto, ESTILOS.boton).setOrigin(0.5);
      this.add.text(x, y + 30, `[${b.tecla}]`, ESTILOS.ayuda).setOrigin(0.5);
      clicable(this.add.zone(x, y, 260, 100), () => this.scene.start(b.escena));
    });

    const kb = this.input.keyboard!;
    kb.on('keydown-ENTER', () => this.scene.start(ESCENAS.nombre));
    kb.on('keydown-R', () => this.scene.start(ESCENAS.ranking));
    kb.on('keydown-O', () => this.scene.start(ESCENAS.ajustes));

    this.avisoFalta = this.add
      .text(cx, CONFIG.alto - 60, 'Párense los dos frente a la cámara', ESTILOS.subtitulo)
      .setOrigin(0.5)
      .setVisible(false);

    if (data?.aviso) {
      encajar(this.add.text(cx, CONFIG.alto - 110, data.aviso, ESTILOS.ayuda).setOrigin(0.5), CONFIG.ancho - 40);
    }
    const input = getInput(this);
    const modo = input.modo ?? input.config.modoEntrada;
    const ayuda =
      modo === 'teclado'
        ? 'Entrada: Teclado (WASD mueve a P1, flechas a P2) · Manos y Pose se eligen en Ajustes'
        : `Entrada: ${NOMBRE_MODO[modo]} · se cambia en Ajustes`;
    encajar(this.add.text(cx, CONFIG.alto - 24, ayuda, ESTILOS.ayuda).setOrigin(0.5), CONFIG.ancho - 40);

    this.orbe = new OrbView(this, getInput(this));
  }

  update(_t: number, delta: number) {
    this.orbe.update(delta);
    this.avisoFalta.setVisible(getInput(this).count < 2);
  }
}
