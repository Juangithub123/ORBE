import { FilesetResolver } from '@mediapipe/tasks-vision';
import type { Ajustes } from '../storage/settings';
import type { NormPos, PlayerInput } from './PlayerInput';
import { Etapa, descargar } from './carga';
import { conLimite } from './limite';

export type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
export type Delegado = 'GPU' | 'CPU';

// Base de las fuentes con cámara (Manos y Pose).
// - Usa la cámara compartida (640×480) en un <video> oculto.
// - Corre la detección en un loop propio (requestVideoFrameCallback si existe), separado del update de Phaser.
// - Guarda el último resultado: read() lo devuelve al instante.
// La carga va por etapas, cada una con su avance (ver carga.ts y PanelCarga):
//   cámara (permiso)  ‖  motor de detección (wasm) + modelo (.task)  →  preparar detector (GPU o CPU).
// El motor y los modelos se descargan desde public/mediapipe (sin internet).

const BASE = import.meta.env.BASE_URL;
export const RUTA_MODELOS = `${BASE}mediapipe/models/`;
const RUTA_WASM = `${BASE}mediapipe/wasm/`;

/** Tiempo máximo para que arranque el video una vez abierta la cámara. */
const VIDEO_MAX_MS = 10_000;
/** Si la GPU no termina en este tiempo, se prueba con la CPU (en algunos equipos se cuelga sin dar error). */
const GPU_MAX_MS = 20_000;
/** Tiempo máximo para preparar el detector en la CPU. */
const CPU_MAX_MS = 40_000;

/** Descarga el motor de MediaPipe (wasm) midiendo el avance. Se baja una vez y lo comparten Manos y Pose. */
async function prepararMotor(etapa: Etapa): Promise<WasmFileset> {
  etapa.empezar();
  const simd = await FilesetResolver.isSimdSupported();
  const nombre = simd ? 'vision_wasm_internal' : 'vision_wasm_nosimd_internal';
  const descarga = descargar(`${RUTA_WASM}${nombre}.wasm`);
  etapa.descarga = descarga;
  // MediaPipe pide el .wasm a wasmBinaryPath: se le pasa una URL local con lo ya descargado.
  return { wasmLoaderPath: `${RUTA_WASM}${nombre}.js`, wasmBinaryPath: await descarga.urlLocal('application/wasm') };
}

// La cámara se pide una sola vez y la comparten Manos y Pose: cambiar entre ellas no vuelve a pedir
// permiso. Cada pedido nuevo puede mostrar el aviso del navegador, y si se cierran varios sin responder,
// Chrome deja de preguntar por un tiempo y rechaza directo ("Permission dismissed").
let pedidoCamara: Promise<MediaStream> | null = null;

/** Abre la cámara, o devuelve la que ya está abierta (o pedida). */
export function abrirCamara(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) return Promise.reject(new SinAccesoCamara());
  pedidoCamara ??= navigator.mediaDevices
    .getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false })
    .catch((e) => {
      pedidoCamara = null;
      throw e;
    });
  return pedidoCamara;
}

/** Apaga la cámara (al pasar a teclado). Si todavía se está pidiendo, se apaga apenas llegue. */
export function cerrarCamara() {
  const pedido = pedidoCamara;
  pedidoCamara = null;
  pedido?.then(
    (stream) => stream.getTracks().forEach((t) => t.stop()),
    () => {},
  );
}

/** El navegador no da acceso a la cámara en esta página (por ejemplo, sin https). */
export class SinAccesoCamara extends Error {
  constructor() {
    super('El navegador no da acceso a la cámara en esta página (hace falta https o localhost).');
  }
}

/** La cámara se abrió pero el video no arrancó. */
export class VideoNoArranca extends Error {}

/** Lo que dibuja la vista previa: todos los puntos detectados y el punto que representa a cada jugador. */
export interface VistaCamara {
  video: HTMLVideoElement;
  /** Puntos normalizados SIN espejar (tal como vienen de la cámara). */
  puntos: NormPos[][];
  jugadores: NormPos[];
}

export abstract class CameraInput<D extends { close(): void }> implements PlayerInput {
  protected detector: D | null = null;
  private video: HTMLVideoElement | null = null;
  private activo = false;
  private ultimoTs = 0;
  private jugadores: NormPos[] = [];
  private puntos: NormPos[][] = [];

  /** Etapas de la carga, en orden, para mostrarlas con su barra. */
  readonly etapas: { camara: Etapa; motor: Etapa; modelo: Etapa; detector: Etapa };

  constructor(
    protected ajustes: Ajustes,
    /** Archivo del modelo en public/mediapipe/models. */
    private archivoModelo: string,
    nombreModelo: string,
  ) {
    this.etapas = {
      camara: new Etapa('Cámara'),
      motor: new Etapa('Motor de detección'),
      modelo: new Etapa(`Modelo de ${nombreModelo}`),
      detector: new Etapa('Preparar detector'),
    };
  }

  /** Crea el detector de MediaPipe con el motor y el modelo ya descargados. */
  protected abstract crear(fileset: WasmFileset, modelo: Uint8Array, delegado: Delegado): Promise<D>;
  /** Corre la detección sobre el frame actual. Devuelve los puntos sin espejar. */
  protected abstract detectar(detector: D, video: HTMLVideoElement, ts: number): { jugadores: NormPos[]; puntos: NormPos[][] };

  async start() {
    // La cámara y el detector se preparan a la vez. Si falla uno, se cierra lo que haya abierto el otro
    // (la cámara la cierra InputManager). Cada etapa marca dónde falló.
    const [camara, detector] = await Promise.allSettled([this.prepararCamara(), this.prepararDetector()]);
    if (camara.status === 'rejected' || detector.status === 'rejected') {
      this.cerrarDetector();
      throw camara.status === 'rejected' ? camara.reason : (detector as PromiseRejectedResult).reason;
    }
    this.video = camara.value;
    this.activo = true;
    this.programar();
  }

  private async prepararCamara() {
    const etapa = this.etapas.camara;
    etapa.empezar('esperando permiso (si el navegador pregunta, tocá «Permitir»)');
    try {
      const stream = await abrirCamara();
      etapa.detalle = 'abriendo el video';
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      try {
        await conLimite(video.play(), VIDEO_MAX_MS, 'tardó demasiado');
      } catch (e) {
        throw new VideoNoArranca(`La cámara se abrió pero el video no arrancó (${e instanceof Error ? e.message : e}).`);
      }
      etapa.terminar();
      return video;
    } catch (e) {
      etapa.fallar(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }

  private async prepararDetector() {
    const { motor, detector } = this.etapas;
    const [fileset, datos] = await Promise.all([
      prepararMotor(motor).then(
        (f) => (motor.terminar(), f),
        (e) => {
          motor.fallar(e instanceof Error ? e.message : String(e));
          throw e;
        },
      ),
      this.descargarModelo(),
    ]);

    try {
      detector.empezar('con la GPU');
      try {
        this.detector = await this.crearConLimite(fileset, datos, 'GPU', GPU_MAX_MS, 'la GPU no respondió');
        detector.terminar('GPU');
      } catch (e) {
        console.warn('ORBE: MediaPipe no pudo usar la GPU, se prueba con la CPU', e);
        detector.detalle = 'la GPU no anduvo, probando con la CPU';
        this.detector = await this.crearConLimite(fileset, datos, 'CPU', CPU_MAX_MS, 'El detector no arrancó ni con la GPU ni con la CPU.');
        detector.terminar('CPU');
      }
    } catch (e) {
      detector.fallar(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }

  private async descargarModelo() {
    const etapa = this.etapas.modelo;
    etapa.empezar();
    const descarga = descargar(`${RUTA_MODELOS}${this.archivoModelo}`);
    etapa.descarga = descarga;
    try {
      const datos = await descarga.datos;
      etapa.terminar();
      return datos;
    } catch (e) {
      etapa.fallar(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }

  /** Crea el detector con tiempo máximo. Si termina después de vencido, se cierra (no queda colgado). */
  private crearConLimite(fileset: WasmFileset, datos: Uint8Array, delegado: Delegado, ms: number, mensaje: string) {
    const creando = this.crear(fileset, datos, delegado);
    return conLimite(creando, ms, mensaje).catch((e) => {
      creando.then((d) => d.close()).catch(() => {});
      throw e;
    });
  }

  private cerrarDetector() {
    this.detector?.close();
    this.detector = null;
  }

  stop() {
    // La cámara no se apaga acá: la puede seguir usando el otro modo (ver cerrarCamara).
    this.activo = false;
    if (this.video) this.video.srcObject = null;
    this.video = null;
    this.jugadores = [];
    this.puntos = [];
    this.cerrarDetector();
  }

  read() {
    const espejar = this.ajustes.espejar;
    return { players: this.jugadores.map((p) => ({ x: espejar ? 1 - p.x : p.x, y: p.y })) };
  }

  get vista(): VistaCamara | null {
    return this.video ? { video: this.video, puntos: this.puntos, jugadores: this.jugadores } : null;
  }

  private programar() {
    const video = this.video;
    if (!this.activo || !video) return;
    if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(() => this.paso());
    else requestAnimationFrame(() => this.paso());
  }

  private paso() {
    const video = this.video;
    const detector = this.detector;
    if (!this.activo || !video) return;
    if (detector && video.readyState >= 2) {
      // MediaPipe exige timestamps crecientes.
      const ts = Math.max(performance.now(), this.ultimoTs + 1);
      this.ultimoTs = ts;
      try {
        const r = this.detectar(detector, video, ts);
        this.jugadores = r.jugadores;
        this.puntos = r.puntos;
      } catch (e) {
        console.warn('ORBE: falló la detección en un frame', e);
      }
    }
    this.programar();
  }
}
