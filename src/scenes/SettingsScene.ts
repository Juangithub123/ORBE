import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { OrbView } from '../game/OrbView';
import type { ModoEntrada } from '../input/PlayerInput';
import { borrarRanking } from '../storage/leaderboard';
import { HoldButton } from '../ui/HoldButton';
import { ESTILOS, encajar } from '../ui/text';
import { RESOLUCIONES, cambiarResolucion, nombreResolucion } from '../pantalla';
import { ESCENAS, NOMBRE_MODO, getInput, mostrarCamara } from './shared';

// Ajustes del dispositivo (se guardan en localStorage).
// Cada botón se activa manteniendo el orbe encima, con un clic o toque, o con su número en el teclado.

const MODOS: ModoEntrada[] = ['pose', 'manos', 'teclado'];
/** Tiempo para la segunda confirmación de "Restablecer ranking". */
const CONFIRMAR_MS = 5000;
/** Cuánto se muestra un aviso (por ejemplo, si el navegador no deja pasar a pantalla completa). */
const AVISO_MS = 5000;

// Dos columnas de cinco botones: a la izquierda la entrada, a la derecha la pantalla y lo demás.
const ANCHO_BOTON = 540;
const ALTO_BOTON = 64;
const SEPARACION = 30;
const PRIMERA_FILA = 135;
const ENTRE_FILAS = 80;

export class SettingsScene extends Phaser.Scene {
  private orbe!: OrbView;
  private botones: HoldButton[] = [];
  private estado!: Phaser.GameObjects.Text;
  private bEntrada!: HoldButton;
  private bPunto!: HoldButton;
  private bEspejar!: HoldButton;
  private bCalibrar!: HoldButton;
  private bCamara!: HoldButton;
  private bResolucion!: HoldButton;
  private bPantalla!: HoldButton;
  private bVolumen!: HoldButton;
  private bRanking!: HoldButton;
  private confirmarRankingHasta = 0;
  private rankingBorrado = false;
  private aviso = '';
  private avisoHasta = 0;

  constructor() {
    super(ESCENAS.ajustes);
  }

  create() {
    mostrarCamara(this, true);
    this.confirmarRankingHasta = 0;
    this.rankingBorrado = false;
    this.aviso = '';
    const input = getInput(this);
    const cx = CONFIG.ancho / 2;
    this.add.text(cx, 58, 'Ajustes', { ...ESTILOS.titulo, fontSize: '56px' }).setOrigin(0.5);

    const col = [cx - (ANCHO_BOTON + SEPARACION) / 2, cx + (ANCHO_BOTON + SEPARACION) / 2];
    this.botones = [];
    const crear = (c: number, f: number, accion: () => void) => {
      const b = new HoldButton(this, col[c], PRIMERA_FILA + f * ENTRE_FILAS, ANCHO_BOTON, ALTO_BOTON, '', accion);
      this.botones.push(b);
      return b;
    };
    this.bEntrada = crear(0, 0, () => this.cambiarModo());
    this.bPunto = crear(0, 1, () => input.aplicarAjustes({ puntoPose: input.config.puntoPose === 'torso' ? 'muneca' : 'torso' }));
    this.bEspejar = crear(0, 2, () => input.aplicarAjustes({ espejar: !input.config.espejar }));
    this.bCalibrar = crear(0, 3, () => this.scene.start(ESCENAS.calibracion));
    this.bCamara = crear(0, 4, () => input.aplicarAjustes({ mostrarCamaraEnJuego: !input.config.mostrarCamaraEnJuego }));
    this.bResolucion = crear(1, 0, () => this.cambiarResolucion());
    this.bPantalla = crear(1, 1, () => this.alternarPantalla());
    this.bVolumen = crear(1, 2, () => input.aplicarAjustes({ volumen: siguienteVolumen(input.config.volumen) }));
    this.bRanking = crear(1, 3, () => this.restablecerRanking());
    const bVolver = crear(1, 4, () => this.scene.start(ESCENAS.menu));
    bVolver.setTexto('Volver  [Esc]');

    this.estado = this.add.text(cx, CONFIG.alto - 28, '', ESTILOS.ayuda).setOrigin(0.5);

    const kb = this.input.keyboard!;
    const atajos: [string, HoldButton][] = [
      ['ONE', this.bEntrada],
      ['TWO', this.bPunto],
      ['THREE', this.bEspejar],
      ['FOUR', this.bCalibrar],
      ['FIVE', this.bCamara],
      ['SIX', this.bResolucion],
      ['SEVEN', this.bPantalla],
      ['EIGHT', this.bVolumen],
      ['NINE', this.bRanking],
      ['ESC', bVolver],
    ];
    for (const [tecla, boton] of atajos) kb.on(`keydown-${tecla}`, () => boton.activar());

    // El navegador solo deja pasar a pantalla completa con un clic o una tecla, no con el orbe.
    const fallo = () => this.avisar('El navegador no dejó pasar a pantalla completa: probá con un clic en el botón.');
    this.scale.on(Phaser.Scale.Events.FULLSCREEN_FAILED, fallo);
    this.scale.on(Phaser.Scale.Events.FULLSCREEN_UNSUPPORTED, fallo);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.FULLSCREEN_FAILED, fallo);
      this.scale.off(Phaser.Scale.Events.FULLSCREEN_UNSUPPORTED, fallo);
    });

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
    this.bCalibrar.setTexto(camara ? 'Calibrar zona de juego  [4]' : 'Calibrar zona (necesita cámara)');
    this.bCalibrar.habilitado = camara && input.estado === 'lista';
    this.bCamara.setTexto(`Cámara en el juego: ${a.mostrarCamaraEnJuego ? 'sí' : 'no'}  [5]`);
    this.bResolucion.setTexto(`Resolución: ${nombreResolucion(a.resolucion)}  [6]`);
    this.bPantalla.setTexto(`Pantalla: ${this.scale.isFullscreen ? 'completa' : 'ventana'}  [7]`);
    this.bVolumen.setTexto(`Volumen: ${Math.round(a.volumen * 100)} %  [8]`);
    this.bRanking.setTexto(
      this.rankingBorrado
        ? 'Ranking borrado'
        : time < this.confirmarRankingHasta
          ? '¿Seguro? Activalo otra vez'
          : 'Restablecer ranking  [9]',
    );

    for (const b of this.botones) b.update(input, delta);
    this.orbe.update(delta);
    encajar(this.estado.setText(time < this.avisoHasta ? this.aviso : this.textoEstado()), CONFIG.ancho - 40);
  }

  private cambiarModo() {
    const input = getInput(this);
    const i = MODOS.indexOf(input.config.modoEntrada);
    input.aplicarAjustes({ modoEntrada: MODOS[(i + 1) % MODOS.length] }).then(() => mostrarCamara(this, true));
  }

  /** Pasa a la resolución siguiente y vuelve a crear la escena, para que los textos se rehagan nítidos. */
  private cambiarResolucion() {
    const input = getInput(this);
    const i = RESOLUCIONES.indexOf(input.config.resolucion);
    const resolucion = RESOLUCIONES[(i + 1) % RESOLUCIONES.length];
    input.aplicarAjustes({ resolucion });
    cambiarResolucion(this.game, resolucion);
    this.scene.restart();
  }

  /** Alterna pantalla completa / ventana y lo guarda como forma de arrancar el juego. */
  private alternarPantalla() {
    const completa = !this.scale.isFullscreen;
    getInput(this).aplicarAjustes({ pantalla: completa ? 'completa' : 'ventana' });
    if (completa) this.scale.startFullscreen();
    else this.scale.stopFullscreen();
  }

  private avisar(texto: string) {
    this.aviso = texto;
    this.avisoHasta = this.time.now + AVISO_MS;
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
