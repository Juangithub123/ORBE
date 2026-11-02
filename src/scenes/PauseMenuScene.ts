import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { OrbView } from '../game/OrbView';
import { HoldButton } from '../ui/HoldButton';
import { ESTILOS } from '../ui/text';
import { ESCENAS, NOMBRE_CAMARA, getInput, mostrarCamaraJuego, siguienteCamara, siguienteVolumen } from './shared';

// Pausa a pedido (Esc durante el juego): se dibuja encima del nivel, que queda congelado.
// Los botones se activan con el orbe, con un clic o con su tecla. Esc (lo maneja GameScene) sigue jugando.
// "Cámara" cambia cómo se ve la cámara durante el juego (sobre el juego, miniatura o nada) y se guarda en Ajustes.
// "Seguir" y "Volver al menú" se le avisan a GameScene con eventos, que decide qué hacer.

export const EVENTO_SEGUIR = 'pausa-seguir';
export const EVENTO_SALIR = 'pausa-salir';

export class PauseMenuScene extends Phaser.Scene {
  private orbe!: OrbView;
  private botones: HoldButton[] = [];
  private bVolumen!: HoldButton;
  private bCamara!: HoldButton;

  constructor() {
    super(ESCENAS.menuPausa);
  }

  create() {
    const input = getInput(this);
    const cx = CONFIG.ancho / 2;
    const juego = this.scene.get(ESCENAS.juego);
    this.add.rectangle(0, 0, CONFIG.ancho, CONFIG.alto, 0x000000, 0.7).setOrigin(0);
    this.add.text(cx, 130, 'PAUSA', { ...ESTILOS.titulo, fontSize: '110px' }).setOrigin(0.5);

    const crear = (y: number, accion: () => void) => {
      const b = new HoldButton(this, cx, y, 520, 64, '', accion);
      this.botones.push(b);
      return b;
    };
    this.botones = [];
    crear(260, () => juego.events.emit(EVENTO_SEGUIR)).setTexto('Seguir jugando  [Esc]');
    this.bVolumen = crear(340, () => input.aplicarAjustes({ volumen: siguienteVolumen(input.config.volumen) }));
    this.bCamara = crear(420, () => {
      input.aplicarAjustes({ camaraEnJuego: siguienteCamara(input.config.camaraEnJuego) });
      mostrarCamaraJuego(this);
    });
    const bMenu = crear(500, () => juego.events.emit(EVENTO_SALIR)).setTexto('Volver al menú  [M]');

    const kb = this.input.keyboard!;
    kb.on('keydown-V', () => this.bVolumen.activar());
    kb.on('keydown-C', () => this.bCamara.activar());
    kb.on('keydown-M', () => bMenu.activar());

    this.add
      .text(cx, CONFIG.alto - 28, 'Mantengan el orbe sobre un botón, o hagan clic', ESTILOS.ayuda)
      .setOrigin(0.5);
    this.orbe = new OrbView(this, input);
  }

  update(_t: number, delta: number) {
    const input = getInput(this);
    this.bVolumen.setTexto(`Volumen: ${Math.round(input.config.volumen * 100)} %  [V]`);
    const conCamara = input.modo === 'manos' || input.modo === 'pose';
    this.bCamara.habilitado = conCamara;
    this.bCamara.setTexto(conCamara ? `Cámara: ${NOMBRE_CAMARA[input.config.camaraEnJuego]}  [C]` : 'Cámara: (solo con Manos o Pose)');
    for (const b of this.botones) b.update(input, delta);
    this.orbe.update(delta);
  }
}
