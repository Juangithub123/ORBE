import { FilesetResolver } from '@mediapipe/tasks-vision';
import type { Ajustes } from '../storage/settings';
import type { NormPos, PlayerInput } from './PlayerInput';

type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

// Base de las fuentes con cámara (Manos y Pose).
// - Abre la cámara a 640×480 en un <video> oculto.
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

/** Lo que dibuja la vista previa: todos los puntos detectados y el punto que representa a cada jugador. */
export interface VistaCamara {
  video: HTMLVideoElement;
  /** Puntos normalizados SIN espejar (tal como vienen de la cámara). */
  puntos: NormPos[][];
  jugadores: NormPos[];
}

export abstract class CameraInput implements PlayerInput {
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private activo = false;
  private ultimoTs = 0;
  private jugadores: NormPos[] = [];
  private puntos: NormPos[][] = [];

  constructor(protected ajustes: Ajustes) {}

  /** Crea el detector de MediaPipe (se llama una vez, en start). */
  protected abstract crearDetector(): Promise<void>;
  /** Corre la detección sobre el frame actual. Devuelve los puntos sin espejar. */
  protected abstract detectar(video: HTMLVideoElement, ts: number): { jugadores: NormPos[]; puntos: NormPos[][] };
  protected abstract cerrarDetector(): void;

  async start() {
    // Se piden juntos el permiso de cámara y el modelo, para que el arranque sea más corto.
    const [stream] = await Promise.all([
      navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false }),
      this.crearDetector(),
    ]);
    this.stream = stream;
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    this.video = video;
    this.activo = true;
    this.programar();
  }

  stop() {
    this.activo = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
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
