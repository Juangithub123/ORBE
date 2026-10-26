import { FilesetResolver } from '@mediapipe/tasks-vision';
import type { Ajustes } from '../storage/settings';
import type { NormPos, PlayerInput } from './PlayerInput';
import { conLimite } from './limite';

type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

// Base de las fuentes con cámara (Manos y Pose).
// - Usa la cámara compartida (640×480) en un <video> oculto.
// - Corre la detección en un loop propio (requestVideoFrameCallback si existe), separado del update de Phaser.
// - Guarda el último resultado: read() lo devuelve al instante.
// Los modelos y el wasm se cargan desde public/mediapipe (sin internet).

const BASE = import.meta.env.BASE_URL;
export const RUTA_MODELOS = `${BASE}mediapipe/models/`;

let fileset: Promise<WasmFileset> | null = null;

/** El wasm de MediaPipe se carga una sola vez y lo comparten Manos y Pose. */
export function cargarFileset() {
  fileset ??= FilesetResolver.forVisionTasks(`${BASE}mediapipe/wasm`);
  return fileset;
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


/** Tiempo máximo para cargar el modelo de detección (descarga, wasm y GPU o CPU). */
const MODELO_MAX_MS = 90_000;
/** Tiempo máximo para que arranque el video una vez abierta la cámara. */
const VIDEO_MAX_MS = 10_000;


/** Lo que dibuja la vista previa: todos los puntos detectados y el punto que representa a cada jugador. */
export interface VistaCamara {
  video: HTMLVideoElement;
  /** Puntos normalizados SIN espejar (tal como vienen de la cámara). */
  puntos: NormPos[][];
  jugadores: NormPos[];
}

export abstract class CameraInput implements PlayerInput {
  private video: HTMLVideoElement | null = null;
  private activo = false;
  private ultimoTs = 0;
  private jugadores: NormPos[] = [];
  private puntos: NormPos[][] = [];
  private camaraLista = false;
  private modeloListo = false;

  constructor(protected ajustes: Ajustes) {}

  /** Cómo va el arranque, para mostrarlo mientras carga (y saber qué paso se trabó). */
  get progreso() {
    const camara = this.camaraLista ? 'lista' : 'esperando permiso (si el navegador pregunta, tocá «Permitir»)';
    return `Cámara: ${camara} · Modelo: ${this.modeloListo ? 'listo' : 'cargando…'}`;
  }

  /** Crea el detector de MediaPipe (se llama una vez, en start). */
  protected abstract crearDetector(): Promise<void>;
  /** Corre la detección sobre el frame actual. Devuelve los puntos sin espejar. */
  protected abstract detectar(video: HTMLVideoElement, ts: number): { jugadores: NormPos[]; puntos: NormPos[][] };
  protected abstract cerrarDetector(): void;

  async start() {
    // Se piden juntos la cámara y el modelo, para que el arranque sea más corto.
    // Si falla uno, se cierra lo que haya abierto el otro (la cámara la cierra InputManager).
    const [camara, detector] = await Promise.allSettled([
      abrirCamara().then((stream) => {
        this.camaraLista = true;
        return stream;
      }),
      conLimite(this.crearDetector(), MODELO_MAX_MS, 'El modelo de detección no terminó de cargar (revisá la conexión).').then(() => {
        this.modeloListo = true;
      }),
    ]);
    if (camara.status === 'rejected' || detector.status === 'rejected') {
      this.cerrarDetector();
      throw camara.status === 'rejected' ? camara.reason : (detector as PromiseRejectedResult).reason;
    }
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = camara.value;
    try {
      await conLimite(video.play(), VIDEO_MAX_MS, 'tardó demasiado');
    } catch (e) {
      this.cerrarDetector();
      throw new VideoNoArranca(`La cámara se abrió pero el video no arrancó (${e instanceof Error ? e.message : e}).`);
    }
    this.video = video;
    this.activo = true;
    this.programar();
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
    if (!this.activo || !video) return;
    if (video.readyState >= 2) {
      // MediaPipe exige timestamps crecientes.
      const ts = Math.max(performance.now(), this.ultimoTs + 1);
      this.ultimoTs = ts;
      try {
        const r = this.detectar(video, ts);
        this.jugadores = r.jugadores;
        this.puntos = r.puntos;
      } catch (e) {
        console.warn('ORBE: falló la detección en un frame', e);
      }
    }
    this.programar();
  }
}
