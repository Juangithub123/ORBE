import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { OrbView } from '../game/OrbView';
import type { ModoEntrada } from '../input/PlayerInput';
import { borrarRanking } from '../storage/leaderboard';
import { HoldButton } from '../ui/HoldButton';
import { ESTILOS } from '../ui/text';
import { ESCENAS, getInput, mostrarCamara } from './shared';

// Ajustes del dispositivo (se guardan en localStorage).
// Cada botón se activa manteniendo el orbe encima, o con su número en el teclado.

const MODOS: ModoEntrada[] = ['pose', 'manos', 'teclado'];
const NOMBRE_MODO: Record<ModoEntrada, string> = { pose: 'Pose (2 personas)', manos: 'Manos (1 persona)', teclado: 'Teclado' };
/** Tiempo para la segunda confirmación de "Restablecer ranking". */
const CONFIRMAR_MS = 5000;

export class SettingsScene extends Phaser.Scene {
  private orbe!: OrbView;
  private botones: HoldButton[] = [];
  private estado!: Phaser.GameObjects.Text;
  private bEntrada!: HoldButton;
  private bPunto!: HoldButton;
  private bEspejar!: HoldButton;
  private bCalibrar!: HoldButton;
  private bCamara!: HoldButton;
  private bVolumen!: HoldButton;
  private bRanking!: HoldButton;
  private confirmarRankingHasta = 0;
  private rankingBorrado = false;

  constructor() {
    super(ESCENAS.ajustes);
  }

  create() {
    mostrarCamara(this, true);
    this.confirmarRankingHasta = 0;
    this.rankingBorrado = false;
    const input = getInput(this);
    const cx = CONFIG.ancho / 2;
    this.add.text(cx, 60, 'Ajustes', { ...ESTILOS.titulo, fontSize: '64px' }).setOrigin(0.5);

    const col = [cx - 250, cx + 250];
    const fila = (i: number) => 165 + i * 100;
    const crear = (c: number, f: number, accion: () => void) => {
      const b = new HoldButton(this, col[c], fila(f), 460, 80, '', accion);
      this.botones.push(b);
      return b;
    };
    this.botones = [];
    this.bEntrada = crear(0, 0, () => this.cambiarModo());
    this.bPunto = crear(0, 1, () => input.aplicarAjustes({ puntoPose: input.config.puntoPose === 'torso' ? 'muneca' : 'torso' }));
    this.bEspejar = crear(0, 2, () => input.aplicarAjustes({ espejar: !input.config.espejar }));
    this.bCalibrar = crear(0, 3, () => this.scene.start(ESCENAS.calibracion));
    this.bCamara = crear(1, 0, () => input.aplicarAjustes({ mostrarCamaraEnJuego: !input.config.mostrarCamaraEnJuego }));
    this.bVolumen = crear(1, 1, () => input.aplicarAjustes({ volumen: siguienteVolumen(input.config.volumen) }));
    this.bRanking = crear(1, 2, () => this.restablecerRanking());
    const bVolver = crear(1, 3, () => this.scene.start(ESCENAS.menu));
    bVolver.setTexto('Volver  [Esc]');

    this.estado = this.add.text(cx, CONFIG.alto - 28, '', ESTILOS.ayuda).setOrigin(0.5);

    const kb = this.input.keyboard!;
    const atajos: [string, HoldButton][] = [
      ['ONE', this.bEntrada],
      ['TWO', this.bPunto],
      ['THREE', this.bEspejar],
      ['FOUR', this.bCalibrar],
      ['FIVE', this.bCamara],
      ['SIX', this.bVolumen],
      ['SEVEN', this.bRanking],
      ['ESC', bVolver],
    ];
    for (const [tecla, boton] of atajos) kb.on(`keydown-${tecla}`, () => boton.activar());

    this.orbe = new OrbView(this, input);
  }

  update(time: number, delta: number) {
    const input = getInput(this);
    const a = input.config;
    const camara = input.modo === 'pose' || input.modo === 'manos';

    this.bEntrada.setTexto(`Entrada: ${NOMBRE_MODO[a.modoEntrada]}  [1]`);
    this.bPunto.setTexto(`Punto de Pose: ${a.puntoPose === 'torso' ? 'centro del torso' : 'muñeca más alta'}  [2]`);
    this.bPunto.habilitado = a.modoEntrada === 'pose';
    this.bEspejar.setTexto(`Espejar cámara: ${a.espejar ? 'sí' : 'no'}  [3]`);
    this.bCalibrar.setTexto(camara ? 'Calibrar zona de juego  [4]' : 'Calibrar zona (solo con cámara)');
    this.bCalibrar.habilitado = camara && input.estado === 'lista';
    this.bCamara.setTexto(`Cámara en el juego: ${a.mostrarCamaraEnJuego ? 'sí' : 'no'}  [5]`);
    this.bVolumen.setTexto(`Volumen: ${Math.round(a.volumen * 100)} %  [6]`);
    this.bRanking.setTexto(
      this.rankingBorrado
        ? 'Ranking borrado'
        : time < this.confirmarRankingHasta
          ? '¿Seguro? Activalo otra vez'
          : 'Restablecer ranking  [7]',
    );

    for (const b of this.botones) b.update(input, delta);
    this.orbe.update(delta);
    this.estado.setText(this.textoEstado());
  }

  private cambiarModo() {
    const input = getInput(this);
    const i = MODOS.indexOf(input.config.modoEntrada);
    input.aplicarAjustes({ modoEntrada: MODOS[(i + 1) % MODOS.length] }).then(() => mostrarCamara(this, true));
  }

  private restablecerRanking() {
    if (this.time.now < this.confirmarRankingHasta) {
      borrarRanking();
      this.rankingBorrado = true;
      this.confirmarRankingHasta = 0;
    } else {
      this.rankingBorrado = false;
      this.confirmarRankingHasta = this.time.now + CONFIRMAR_MS;
    }
  }

  private textoEstado() {
    const input = getInput(this);
    switch (input.estado) {
      case 'cargando':
        return 'Cargando la cámara y el modelo…';
      case 'error':
        return `No se pudo usar la cámara: ${input.error} Se usa el teclado.`;
      case 'lista':
        if (input.modo === 'teclado') return 'Teclado: WASD mueve a P1, flechas a P2 · P simula que falta un jugador';
        return `Cámara lista · ${input.modo === 'pose' ? 'personas' : 'manos'} detectadas: ${input.countCrudo}`;
      default:
        return '';
    }
  }
}

function siguienteVolumen(v: number) {
  const siguiente = Math.round(v * 10) / 10 + 0.2;
  return siguiente > 1.0001 ? 0 : Math.min(1, siguiente);
}
