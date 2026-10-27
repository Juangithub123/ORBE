import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { OrbView } from '../game/OrbView';
import { HoldButton } from '../ui/HoldButton';
import { ESTILOS } from '../ui/text';
import type { InputManager } from '../input/InputManager';
import { ESCENAS, NOMBRE_MODO, getInput, mostrarCamara, setRun } from './shared';

// Menú principal. Cada botón se activa manteniendo el orbe encima (como en Ajustes),
// con un clic o toque, o con su atajo de teclado.

const BOTONES = [
  { texto: 'Jugar', tecla: 'ENTER', etiqueta: 'Enter', escena: ESCENAS.nombre },
  { texto: 'Ranking', tecla: 'R', etiqueta: 'R', escena: ESCENAS.ranking },
  { texto: 'Ajustes', tecla: 'O', etiqueta: 'O', escena: ESCENAS.ajustes },
];

export class MenuScene extends Phaser.Scene {
  private orbe!: OrbView;
  private botones: HoldButton[] = [];
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

    const kb = this.input.keyboard!;
    this.botones = BOTONES.map((b, i) => {
      const boton = new HoldButton(this, cx + (i - 1) * 320, 400, 260, 100, `${b.texto}\n[${b.etiqueta}]`, () =>
        this.scene.start(b.escena),
      );
      kb.on(`keydown-${b.tecla}`, () => boton.activar());
      return boton;
    });

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
    for (const b of this.botones) b.update(input, delta);
    this.orbe.update(delta);
    this.avisoFalta.setVisible(input.estado !== 'cargando' && input.count < 2);
    // Mientras se ve el panel de carga (abajo a la izquierda), esta línea se oculta para no pisarse.
    this.estadoEntrada.setText(textoEntrada(input)).setVisible(!input.panelCarga.visible);
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
