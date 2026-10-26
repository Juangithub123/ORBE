import { CONFIG } from '../config';
import { calcOrb, type OrbState, type Vec2 } from '../game/orb';
import { guardarAjustes, type Ajustes, type Zona } from '../storage/settings';
import { CameraInput } from './CameraInput';
import { CameraPreview } from './CameraPreview';
import { HandsInput } from './HandsInput';
import { KeyboardInput } from './KeyboardInput';
import type { ModoEntrada, NormPos, PlayerInput } from './PlayerInput';
import { PoseInput } from './PoseInput';

// Lo único que conocen las escenas sobre la entrada.
// Elige la fuente según Ajustes, mapea a píxeles de pantalla con la zona de juego,
// suaviza, ordena a los jugadores por x y aplica histéresis a la presencia.

const ZONA_COMPLETA: Zona = { x0: 0, x1: 1, y0: 0, y1: 1 };

export type EstadoEntrada = 'apagada' | 'cargando' | 'lista' | 'error';

export class InputManager {
  /** Posiciones suavizadas en píxeles de pantalla. P1 es siempre el de la izquierda. */
  readonly p1: Vec2 = { x: CONFIG.ancho * 0.35, y: CONFIG.alto * 0.75 };
  readonly p2: Vec2 = { x: CONFIG.ancho * 0.65, y: CONFIG.alto * 0.75 };
  /** Jugadores presentes (0 a 2), con histéresis. */
  count = 2;
  /** Jugadores detectados en el último frame, sin histéresis. */
  countCrudo = 2;
  /** Posiciones normalizadas del último frame (ya espejadas, sin zona), ordenadas por x. Sirven para calibrar. */
  crudos: NormPos[] = [];
  orb: OrbState;
  /** Mientras se calibra, se usa toda la imagen de la cámara (sin zona de juego). */
  calibrando = false;

  estado: EstadoEntrada = 'apagada';
  /** Último error al arrancar la cámara (para mostrar en Ajustes). */
  error = '';
  readonly preview: CameraPreview;

  private fuente: PlayerInput | null = null;
  private modoActivo: ModoEntrada | null = null;
  private desdeCambio = 0;

  constructor(private ajustes: Ajustes) {
    this.orb = calcOrb(this.p1, this.p2, CONFIG);
    this.preview = new CameraPreview(() => (this.fuente instanceof CameraInput ? this.fuente.vista : null), ajustes);
  }

  get modo() {
    return this.modoActivo;
  }

  get config(): Readonly<Ajustes> {
    return this.ajustes;
  }

  /** Arranca la fuente del modo guardado. Si falla (por ejemplo, sin cámara), cae a teclado y lo informa. */
  async start(): Promise<{ ok: boolean; modo: ModoEntrada; error?: unknown }> {
    this.stop();
    const modo = this.ajustes.modoEntrada;
    this.estado = 'cargando';
    this.error = '';
    try {
      const fuente = this.crearFuente(modo);
      this.fuente = fuente;
      await fuente.start();
      // Si mientras cargaba se pidió otra fuente, esta ya no sirve.
      if (this.fuente !== fuente) {
        fuente.stop();
        return { ok: false, modo };
      }
      this.modoActivo = modo;
      this.estado = 'lista';
      this.preview.actualizar();
      return { ok: true, modo };
    } catch (error) {
      console.warn('ORBE: no se pudo iniciar la entrada', modo, error);
      this.fuente?.stop();
      this.fuente = new KeyboardInput();
      await this.fuente.start();
      this.modoActivo = 'teclado';
      this.estado = 'error';
      this.error = describirError(error);
      this.preview.actualizar();
      return { ok: false, modo: 'teclado', error };
    }
  }

  stop() {
    this.fuente?.stop();
    this.fuente = null;
    this.modoActivo = null;
    this.estado = 'apagada';
    this.preview.actualizar();
  }

  /**
   * Guarda los ajustes. Si cambió el modo de entrada, reinicia la fuente.
   * (Espejar, punto de Pose y zonas se leen en vivo, no hace falta reiniciar.)
   */
  aplicarAjustes(cambios: Partial<Ajustes>) {
    const modoAntes = this.ajustes.modoEntrada;
    Object.assign(this.ajustes, cambios);
    guardarAjustes(this.ajustes);
    if (this.ajustes.modoEntrada !== modoAntes) return this.start();
    return Promise.resolve({ ok: true, modo: this.ajustes.modoEntrada });
  }

  /** Se llama una vez por frame (lo engancha main.ts al loop del juego). */
  update(deltaMs: number) {
    if (!this.fuente || this.estado === 'cargando') return;
    const { players } = this.fuente.read();
    this.crudos = [...players].sort((a, b) => a.x - b.x);
    const enPantalla = this.crudos.map((p) => this.aPantalla(p, this.zonaActual()));

    this.countCrudo = Math.min(2, enPantalla.length);
    this.actualizarPresencia(deltaMs);

    // Suavizado independiente de los FPS: el factor está pensado para 60 FPS.
    const k = 1 - Math.pow(1 - CONFIG.suavizado, deltaMs / (1000 / 60));
    if (enPantalla.length >= 2) {
      this.acercar(this.p1, enPantalla[0], k);
      this.acercar(this.p2, enPantalla[1], k);
    } else if (enPantalla.length === 1) {
      // Con un solo jugador, se mueve el marcador más cercano y el otro queda donde estaba.
      const p = enPantalla[0];
      const d1 = Math.hypot(p.x - this.p1.x, p.y - this.p1.y);
      const d2 = Math.hypot(p.x - this.p2.x, p.y - this.p2.y);
      this.acercar(d1 <= d2 ? this.p1 : this.p2, p, k);
    }

    this.orb = calcOrb(this.p1, this.p2, CONFIG);
  }

  private zonaActual(): Zona {
    if (this.calibrando) return ZONA_COMPLETA;
    if (this.modoActivo === 'pose') return this.ajustes.zonaPose;
    if (this.modoActivo === 'manos') return this.ajustes.zonaManos;
    return ZONA_COMPLETA;
  }

  private crearFuente(modo: ModoEntrada): PlayerInput {
    switch (modo) {
      case 'manos':
        return new HandsInput(this.ajustes);
      case 'pose':
        return new PoseInput(this.ajustes);
      default:
        return new KeyboardInput();
    }
  }

  private aPantalla(p: NormPos, zona: Zona): Vec2 {
    const nx = (p.x - zona.x0) / (zona.x1 - zona.x0);
    const ny = (p.y - zona.y0) / (zona.y1 - zona.y0);
    return {
      x: Math.min(1, Math.max(0, nx)) * CONFIG.ancho,
      y: Math.min(1, Math.max(0, ny)) * CONFIG.alto,
    };
  }

  private acercar(actual: Vec2, objetivo: Vec2, k: number) {
    actual.x += (objetivo.x - actual.x) * k;
    actual.y += (objetivo.y - actual.y) * k;
  }

  private actualizarPresencia(deltaMs: number) {
    if (this.countCrudo === this.count) {
      this.desdeCambio = 0;
      return;
    }
    this.desdeCambio += deltaMs;
    const espera = this.countCrudo < this.count ? CONFIG.presenciaPerdidaMs : CONFIG.presenciaVueltaMs;
    if (this.desdeCambio >= espera) {
      this.count = this.countCrudo;
      this.desdeCambio = 0;
    }
  }
}

function describirError(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === 'NotAllowedError') return 'Se negó el permiso de cámara.';
    if (e.name === 'NotFoundError') return 'No se encontró ninguna cámara.';
    if (e.name === 'NotReadableError') return 'La cámara está en uso por otro programa.';
  }
  return e instanceof Error ? e.message : String(e);
}
