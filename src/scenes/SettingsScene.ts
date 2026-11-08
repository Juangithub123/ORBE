import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { OrbView } from '../game/OrbView';
import type { ModoEntrada } from '../input/PlayerInput';
import { listarCamaras } from '../input/CameraInput';
import { borrarRanking } from '../storage/leaderboard';
import { HoldButton } from '../ui/HoldButton';
import { ESTILOS } from '../ui/text';
import { RESOLUCIONES, cambiarResolucion, estaEnPantallaCompleta, nombreResolucion, ponerPantallaCompleta } from '../pantalla';
import { ESCENAS, NOMBRE_CAMARA, NOMBRE_MODO, NOMBRE_PUNTO_KINECT, PUNTOS_KINECT, conSensor, clicable, getInput, mostrarCamara, siguienteCamara, siguienteVolumen } from './shared';

// Ajustes del dispositivo (se guardan en localStorage).
// Cada botón se activa manteniendo el orbe encima, con un clic o toque, o con su número en el teclado.

const MODOS: ModoEntrada[] = ['pose', 'manos', 'kinect', 'teclado'];
/** Tiempo para la segunda confirmación de "Restablecer ranking". */
const CONFIRMAR_MS = 5000;
/** Cuánto se muestra un aviso (por ejemplo, si el navegador no deja pasar a pantalla completa). */
const AVISO_MS = 5000;

// Dos columnas: a la izquierda la entrada (seis botones), a la derecha la pantalla y lo demás.
const ANCHO_BOTON = 540;
const ALTO_BOTON = 60;
const SEPARACION = 30;
const PRIMERA_FILA = 125;
const ENTRE_FILAS = 74;

export class SettingsScene extends Phaser.Scene {
  private orbe!: OrbView;
  private botones: HoldButton[] = [];
  private estado!: Phaser.GameObjects.Text;
  private bEntrada!: HoldButton;
  private bWebcam!: HoldButton;
  /** Cámaras conectadas (se listan al entrar y cuando se conecta o desconecta una). */
  private camaras: { id: string; nombre: string }[] = [];
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
    this.bWebcam = crear(0, 1, () => this.cambiarWebcam());
    this.bPunto = crear(0, 2, () => this.cambiarPunto());
    this.bEspejar = crear(0, 3, () => input.aplicarAjustes({ espejar: !input.config.espejar }));
    this.bCalibrar = crear(0, 4, () => this.scene.start(ESCENAS.calibracion));
    this.bCamara = crear(0, 5, () => input.aplicarAjustes({ camaraEnJuego: siguienteCamara(input.config.camaraEnJuego) }));
    this.bResolucion = crear(1, 0, () => this.cambiarResolucion());
    this.bPantalla = crear(1, 1, () => this.alternarPantalla());
    this.bVolumen = crear(1, 2, () => input.aplicarAjustes({ volumen: siguienteVolumen(input.config.volumen) }));
    this.bRanking = crear(1, 3, () => this.restablecerRanking());
    const bVolver = crear(1, 5, () => this.scene.start(ESCENAS.menu));

    void this.actualizarCamaras();
    const alCambiarDispositivos = () => void this.actualizarCamaras();
    navigator.mediaDevices?.addEventListener('devicechange', alCambiarDispositivos);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => navigator.mediaDevices?.removeEventListener('devicechange', alCambiarDispositivos));
    bVolver.setTexto('Volver  [Esc]');

    // Si la cámara falló, un clic en este texto (o R) la reintenta.
    this.estado = clicable(
      this.add
        .text(cx, CONFIG.alto - 12, '', { ...ESTILOS.ayuda, align: 'center', wordWrap: { width: CONFIG.ancho - 120 } })
        .setOrigin(0.5, 1),
      () => this.reintentarCamara(),
    );

    const kb = this.input.keyboard!;
    const atajos: [string, HoldButton][] = [
      ['ONE', this.bEntrada],
      ['C', this.bWebcam],
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
    kb.on('keydown-R', () => this.reintentarCamara());

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
    const camara = conSensor(input.modo);

    const sinCamara = input.estado === 'error' && a.modoEntrada !== 'teclado';
    this.bEntrada.setTexto(`Entrada: ${NOMBRE_MODO[a.modoEntrada]}${sinCamara ? (a.modoEntrada === 'kinect' ? ' · sin conexión' : ' · sin cámara') : ''}  [1]`);
    this.bWebcam.setTexto(`Webcam: ${a.camaraId ? a.camaraNombre || 'elegida' : 'la predeterminada'}  [C]`);
    this.bPunto.setTexto(
      a.modoEntrada === 'kinect'
        ? `Punto del Kinect: ${NOMBRE_PUNTO_KINECT[a.puntoKinect]}  [2]`
        : `Punto de Pose: ${a.puntoPose === 'torso' ? 'centro del torso' : 'muñeca más alta'}  [2]`,
    );
    this.bPunto.habilitado = a.modoEntrada === 'pose' || a.modoEntrada === 'kinect';
    this.bEspejar.setTexto(`Espejar cámara: ${a.espejar ? 'sí' : 'no'}  [3]`);
    this.bCalibrar.setTexto(camara ? 'Calibrar zona de juego  [4]' : 'Calibrar zona (necesita cámara o Kinect)');
    this.bCalibrar.habilitado = camara && input.estado === 'lista';
    this.bCamara.setTexto(`Cámara en el juego: ${NOMBRE_CAMARA[a.camaraEnJuego]}  [5]`);
    this.bResolucion.setTexto(`Resolución: ${nombreResolucion(a.resolucion)}  [6]`);
    this.bPantalla.setTexto(`Pantalla: ${estaEnPantallaCompleta(this.game) ? 'completa' : 'ventana'}  [7]`);
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
    const aviso = time < this.avisoHasta;
    // Mientras se ve el panel de carga (abajo a la izquierda), esta línea se oculta para no pisarse.
    this.estado.setText(aviso ? this.aviso : this.textoEstado()).setVisible(aviso || !input.panelCarga.visible);
  }

  private cambiarModo() {
    const input = getInput(this);
    const i = MODOS.indexOf(input.config.modoEntrada);
    input.aplicarAjustes({ modoEntrada: MODOS[(i + 1) % MODOS.length] }).then(() => mostrarCamara(this, true));
  }

  private reintentarCamara() {
    const input = getInput(this);
    if (input.estado !== 'error' || input.config.modoEntrada === 'teclado') return;
    input.start().then(() => mostrarCamara(this, true));
  }

  /** Punto de cada jugador: en Pose, torso o muñeca; en Kinect, recorre las articulaciones. */
  private cambiarPunto() {
    const input = getInput(this);
    const a = input.config;
    if (a.modoEntrada === 'kinect') {
      const i = PUNTOS_KINECT.indexOf(a.puntoKinect);
      input.aplicarAjustes({ puntoKinect: PUNTOS_KINECT[(i + 1) % PUNTOS_KINECT.length] });
    } else {
      input.aplicarAjustes({ puntoPose: a.puntoPose === 'torso' ? 'muneca' : 'torso' });
    }
  }

  /** Lista las cámaras conectadas (los nombres aparecen después de dar permiso de cámara). */
  private async actualizarCamaras() {
    try {
      this.camaras = await listarCamaras();
    } catch {
      this.camaras = [];
    }
  }

  /** Pasa a la cámara siguiente: la predeterminada → cada cámara conectada → la predeterminada. */
  private cambiarWebcam() {
    const input = getInput(this);
    if (this.camaras.length === 0) {
      this.avisar('No se encontraron cámaras (o falta el permiso): elegí Manos o Pose y permití la cámara.');
      return;
    }
    const opciones = [{ id: '', nombre: '' }, ...this.camaras];
    const i = opciones.findIndex((c) => c.id === input.config.camaraId);
    const siguiente = opciones[(i + 1) % opciones.length];
    input.aplicarAjustes({ camaraId: siguiente.id, camaraNombre: siguiente.nombre }).then(() => mostrarCamara(this, true));
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
    const completa = !estaEnPantallaCompleta(this.game);
    getInput(this).aplicarAjustes({ pantallaCompleta: completa });
    ponerPantallaCompleta(this.game, completa);
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
        return input.progreso;
      case 'error':
        return `${input.error}\nMientras, se usa el teclado · Clic acá o [R] para reintentar`;
      case 'lista':
        if (input.modo === 'teclado') return 'Teclado: WASD mueve a P1, flechas a P2 · P simula que falta un jugador';
        if (input.modo === 'kinect') return `Kinect conectado (TouchDesigner) · personas detectadas: ${input.countCrudo}`;
        return `Cámara lista · ${input.modo === 'pose' ? 'personas' : 'manos'} detectadas: ${input.countCrudo}`;
      default:
        return '';
    }
  }
}
