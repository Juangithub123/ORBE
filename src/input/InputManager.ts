import { CONFIG } from '../config';
import { calcOrb, type OrbState, type Vec2 } from '../game/orb';
import { guardarAjustes, type Ajustes, type Zona } from '../storage/settings';
import { CameraInput, SinAccesoCamara, VideoNoArranca, cerrarCamara } from './CameraInput';
import { CameraPreview } from './CameraPreview';
import type { Etapa } from './carga';
import { PanelCarga } from '../ui/PanelCarga';
import { FiltroUnoEuro } from './unoEuro';
import { HandsInput } from './HandsInput';
import { KeyboardInput } from './KeyboardInput';
import type { ModoEntrada, NormPos, PlayerInput } from './PlayerInput';
import { PoseInput } from './PoseInput';

// Lo único que conocen las escenas sobre la entrada.
// Elige la fuente según Ajustes, ordena a los jugadores por x, filtra el temblor de la cámara (One Euro,
// una vez por detección), mapea a píxeles de pantalla con la zona de juego, une las detecciones en un
// movimiento continuo (suavizado por frame) y aplica histéresis a la presencia.

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
  /** Posiciones normalizadas (ya espejadas, sin zona), ordenadas por x y, con cámara, filtradas. Sirven para calibrar. */
  crudos: NormPos[] = [];
  orb: OrbState;
  /** Mientras se calibra, se usa toda la imagen de la cámara (sin zona de juego). */
  calibrando = false;

  estado: EstadoEntrada = 'apagada';
  /** Último error al arrancar la cámara (para mostrar en Ajustes). */
  error = '';
  readonly preview: CameraPreview;
  readonly panelCarga: PanelCarga;
  /** Etapas de la última carga de cámara. Quedan después de un error, para ver en cuál falló. */
  carga: Etapa[] = [];

  private fuente: PlayerInput | null = null;
  private modoActivo: ModoEntrada | null = null;
  private desdeCambio = 0;
  /** Filtro One Euro de cada jugador (de izquierda a derecha), en x y en y. */
  private filtros = [new FiltroXY(), new FiltroXY()];
  /** Momento de la última detección filtrada (para filtrar cada detección una sola vez). */
  private ultimaDeteccion = -1;
  /** Cuenta los arranques: el resultado de un arranque viejo (por ejemplo, un aviso de permiso que se
   * cerró después de cambiar de modo) se descarta y no pisa al modo elegido después. */
  private intento = 0;

  constructor(private ajustes: Ajustes) {
    this.orb = calcOrb(this.p1, this.p2, CONFIG);
    this.preview = new CameraPreview(
      () => (this.fuente instanceof CameraInput ? this.fuente.vista : null),
      () => this.zona,
      ajustes,
    );
    this.panelCarga = new PanelCarga(this);
    this.vigilarPermiso();
  }

  get modo() {
    return this.modoActivo;
  }

  get config(): Readonly<Ajustes> {
    return this.ajustes;
  }

  /** Con cámara: cuánto tarda cada detección y cuántas hay por segundo (para el medidor de rendimiento). */
  get estadisticasCamara() {
    return this.fuente instanceof CameraInput && this.estado === 'lista' ? this.fuente.estadisticas : null;
  }

  /** Mientras carga: qué etapas están en curso (el detalle de cada una está en PanelCarga). */
  get progreso() {
    const enCurso = this.carga.filter((e) => e.estado === 'en curso').map((e) => e.nombre.toLowerCase());
    return enCurso.length ? `Cargando: ${enCurso.join(', ')}…` : 'Cargando…';
  }

  /** Arranca la fuente del modo guardado. Si falla (por ejemplo, sin cámara), cae a teclado y lo informa. */
  async start(): Promise<{ ok: boolean; modo: ModoEntrada; error?: unknown }> {
    this.stop();
    this.reiniciarFiltros();
    const intento = ++this.intento;
    const modo = this.ajustes.modoEntrada;
    if (modo === 'teclado') cerrarCamara();
    this.estado = 'cargando';
    this.error = '';
    const fuente = this.crearFuente(modo);
    this.fuente = fuente;
    this.carga = fuente instanceof CameraInput ? Object.values(fuente.etapas) : [];
    try {
      await fuente.start();
    } catch (error) {
      console.warn('ORBE: no se pudo iniciar la entrada', modo, error);
      fuente.stop();
      // Si mientras cargaba se eligió otro modo, este error ya no importa.
      if (intento !== this.intento) return { ok: false, modo };
      cerrarCamara();
      const teclado = new KeyboardInput();
      this.fuente = teclado;
      await teclado.start();
      this.modoActivo = 'teclado';
      this.estado = 'error';
      this.error = await describirError(error);
      this.preview.actualizar();
      return { ok: false, modo: 'teclado', error };
    }
    // Si mientras cargaba se eligió otro modo, esta fuente ya no sirve.
    if (intento !== this.intento) {
      fuente.stop();
      return { ok: false, modo };
    }
    this.modoActivo = modo;
    this.estado = 'lista';
    this.preview.actualizar();
    return { ok: true, modo };
  }


  stop() {
    this.fuente?.stop();
    this.fuente = null;
    this.modoActivo = null;
    this.estado = 'apagada';
    this.preview.actualizar();
  }

  /**
   * Guarda los ajustes. Si cambió el modo de entrada o la cámara, reinicia la fuente.
   * (Espejar, punto de Pose y zonas se leen en vivo, no hace falta reiniciar.)
   */
  aplicarAjustes(cambios: Partial<Ajustes>) {
    const modoAntes = this.ajustes.modoEntrada;
    const camaraAntes = this.ajustes.camaraId;
    Object.assign(this.ajustes, cambios);
    guardarAjustes(this.ajustes);
    if (this.ajustes.modoEntrada !== modoAntes) return this.start();
    // Otra cámara: se apaga la actual y se abre la nueva (si se está usando la cámara).
    if (this.ajustes.camaraId !== camaraAntes && this.ajustes.modoEntrada !== 'teclado') {
      cerrarCamara();
      return this.start();
    }
    return Promise.resolve({ ok: true, modo: this.ajustes.modoEntrada });
  }

  /** Se llama una vez por frame (lo engancha main.ts al loop del juego). */
  update(deltaMs: number) {
    if (!this.fuente || this.estado === 'cargando') return;
    const { players, t } = this.fuente.read();
    const ordenados = [...players].sort((a, b) => a.x - b.x).slice(0, 2);
    if (t === undefined) {
      // Teclado: no hay temblor que filtrar.
      this.crudos = ordenados;
    } else if (t !== this.ultimaDeteccion) {
      // Cámara: cada detección nueva pasa una vez por el filtro, con su momento real.
      this.ultimaDeteccion = t;
      // Si apareció o desapareció alguien, los índices ya no son las mismas personas: se empieza de cero.
      if (ordenados.length !== this.crudos.length) this.reiniciarFiltros();
      this.crudos = ordenados.map((p, i) => this.filtros[i].filtrar(p, t / 1000));
    }
    const enPantalla = this.crudos.map((p) => this.aPantalla(p, this.zona));

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

  /** Si se permite la cámara después de un error (desde el candado), se reintenta solo, sin recargar. */
  private vigilarPermiso() {
    navigator.permissions
      ?.query({ name: 'camera' as PermissionName })
      .then((permiso) => {
        permiso.addEventListener('change', () => {
          if (permiso.state === 'granted' && this.estado === 'error' && this.ajustes.modoEntrada !== 'teclado') this.start();
        });
      })
      .catch(() => {
        // Sin Permissions API para la cámara: se reintenta a mano.
      });
  }

  private reiniciarFiltros() {
    for (const f of this.filtros) f.reiniciar();
    this.ultimaDeteccion = -1;
  }

  /** Zona de juego en uso: la parte de la imagen (ya espejada) que ocupa toda la pantalla. */
  get zona(): Zona {
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

/** Estado del permiso de cámara según el navegador ('granted', 'denied', 'prompt'), si lo informa. */
async function estadoPermiso(): Promise<PermissionState | null> {
  try {
    return (await navigator.permissions.query({ name: 'camera' as PermissionName })).state;
  } catch {
    // Firefox y algunos navegadores no informan el permiso de cámara.
    return null;
  }
}

const COMO_PERMITIR = 'Permitila en el candado de la barra de direcciones (Cámara → Permitir).';

async function describirError(e: unknown): Promise<string> {
  if (e instanceof SinAccesoCamara || e instanceof VideoNoArranca) return e.message;
  if (e instanceof DOMException) {
    if (e.name === 'NotAllowedError') {
      if (/system/i.test(e.message)) {
        return 'El sistema operativo no le deja usar la cámara al navegador (Windows: Configuración → Privacidad → Cámara; macOS: Ajustes → Privacidad → Cámara).';
      }
      const permiso = await estadoPermiso();
      if (permiso === 'denied') return `La cámara está bloqueada para este sitio. ${COMO_PERMITIR}`;
      if (/dismiss/i.test(e.message) || permiso === 'prompt') {
        return `Se cerró el aviso de permiso sin aceptar. Si el navegador ya no pregunta: ${COMO_PERMITIR}`;
      }
      return `Se negó el permiso de cámara. ${COMO_PERMITIR}`;
    }
    if (e.name === 'NotFoundError') return 'No se encontró ninguna cámara.';
    if (e.name === 'NotReadableError') return 'La cámara está en uso por otro programa (cerralo y reintentá).';
    if (e.name === 'OverconstrainedError') return 'La cámara no admite la resolución pedida (640×480).';
    return `${e.name}: ${e.message}`;
  }
  const mensaje = e instanceof Error ? e.message : String(e);
  if (/fetch/i.test(mensaje)) return `No se pudo descargar el modelo de detección (${mensaje}).`;
  return mensaje;
}

/** Filtro One Euro de un punto (x e y por separado), con los parámetros del panel leídos en cada detección. */
class FiltroXY {
  private x = new FiltroUnoEuro();
  private y = new FiltroUnoEuro();

  filtrar(p: NormPos, t: number): NormPos {
    for (const f of [this.x, this.y]) {
      f.corteMin = CONFIG.filtroCorteMin;
      f.beta = CONFIG.filtroBeta;
    }
    return { x: this.x.filtrar(p.x, t), y: this.y.filtrar(p.y, t) };
  }

  reiniciar() {
    this.x.reiniciar();
    this.y.reiniciar();
  }
}
