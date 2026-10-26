import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { PALETA } from '../palette';
import { OrbView } from '../game/OrbView';
import { ESTILOS } from '../ui/text';
import type { InputManager } from '../input/InputManager';
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
  private estadoEntrada!: Phaser.GameObjects.Text;

  constructor() {
    super(ESCENAS.menu);
  }

  create() {
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
      .text(cx, CONFIG.alto - 100, 'Párense los dos frente a la cámara', ESTILOS.subtitulo)
      .setOrigin(0.5)
      .setVisible(false);

    // Estado de la entrada, en vivo: la cámara puede seguir cargando al llegar al menú.
    this.estadoEntrada = this.add
      .text(cx, CONFIG.alto - 12, '', { ...ESTILOS.ayuda, align: 'center', wordWrap: { width: CONFIG.ancho - 120 } })
      .setOrigin(0.5, 1);

    this.orbe = new OrbView(this, getInput(this));
  }

  update(_t: number, delta: number) {
    const input = getInput(this);
    this.orbe.update(delta);
    this.avisoFalta.setVisible(input.estado !== 'cargando' && input.count < 2);
    this.estadoEntrada.setText(textoEntrada(input));
  }
}

function textoEntrada(input: InputManager) {
  const modo = input.config.modoEntrada;
  if (input.estado === 'cargando') return `Entrada: ${NOMBRE_MODO[modo]} · ${input.progreso}`;
  if (input.estado === 'error') return `${input.error}\nMientras, se usa el teclado · se reintenta desde Ajustes`;
  return modo === 'teclado'
    ? 'Entrada: Teclado (WASD mueve a P1, flechas a P2) · Manos y Pose se eligen en Ajustes'
    : `Entrada: ${NOMBRE_MODO[modo]} · se cambia en Ajustes`;
}
