import { CONFIG } from '../config';
import { calcOrb, type OrbState, type Vec2 } from '../game/orb';
import type { Ajustes, Zona } from '../storage/settings';
import { KeyboardInput } from './KeyboardInput';
import type { ModoEntrada, NormPos, PlayerInput } from './PlayerInput';

// Lo único que conocen las escenas sobre la entrada.
// Elige la fuente según Ajustes, mapea a píxeles de pantalla con la zona de juego,
// suaviza, ordena a los jugadores por x y aplica histéresis a la presencia.

const ZONA_COMPLETA: Zona = { x0: 0, x1: 1, y0: 0, y1: 1 };

export class InputManager {
  /** Posiciones suavizadas en píxeles de pantalla. P1 es siempre el de la izquierda. */
  readonly p1: Vec2 = { x: CONFIG.ancho * 0.35, y: CONFIG.alto * 0.75 };
  readonly p2: Vec2 = { x: CONFIG.ancho * 0.65, y: CONFIG.alto * 0.75 };
  /** Jugadores presentes (0 a 2), con histéresis. */
  count = 2;
  /** Jugadores detectados en el último frame, sin histéresis. */
  countCrudo = 2;
  orb: OrbState;

  private fuente: PlayerInput | null = null;
  private modoActivo: ModoEntrada | null = null;
  private desdeCambio = 0;

  constructor(private ajustes: Ajustes) {
    this.orb = calcOrb(this.p1, this.p2, CONFIG);
  }

  get modo() {
    return this.modoActivo;
  }

  /** Arranca la fuente del modo guardado. Si falla (por ejemplo, sin cámara), cae a teclado y lo informa. */
  async start(): Promise<{ ok: boolean; modo: ModoEntrada; error?: unknown }> {
    this.stop();
    const modo = this.ajustes.modoEntrada;
    try {
      this.fuente = this.crearFuente(modo);
      await this.fuente.start();
      this.modoActivo = modo;
      return { ok: true, modo };
    } catch (error) {
      this.fuente?.stop();
      this.fuente = new KeyboardInput();
      await this.fuente.start();
      this.modoActivo = 'teclado';
      return { ok: false, modo: 'teclado', error };
    }
  }

  stop() {
    this.fuente?.stop();
    this.fuente = null;
    this.modoActivo = null;
  }

  /** Se llama una vez por frame (lo engancha main.ts al loop del juego). */
  update(deltaMs: number) {
    if (!this.fuente) return;
    const { players } = this.fuente.read();
    const zona = this.modoActivo === 'pose' ? this.ajustes.zonaPose : this.modoActivo === 'manos' ? this.ajustes.zonaManos : ZONA_COMPLETA;
    const enPantalla = players.map((p) => this.aPantalla(p, zona)).sort((a, b) => a.x - b.x);

    this.countCrudo = enPantalla.length;
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

  private crearFuente(modo: ModoEntrada): PlayerInput {
    switch (modo) {
      case 'teclado':
        return new KeyboardInput();
      default:
        // Manos y Pose llegan en la fase 4.
        throw new Error(`Modo de entrada "${modo}" todavía no implementado`);
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
