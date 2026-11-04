// Interfaz común de todas las fuentes de entrada (teclado, Manos, Pose y, a futuro, Kinect).

export interface NormPos {
  /** 0..1, hacia la derecha. */
  x: number;
  /** 0..1, hacia abajo. */
  y: number;
}

export interface PlayerInput {
  start(): Promise<void>;
  stop(): void;
  /**
   * Posiciones normalizadas, ya espejadas si corresponde. 0, 1 o 2 jugadores detectados.
   * `t` (solo con cámara): momento de la detección (ms, performance.now); cambia con cada detección nueva.
   */
  read(): { players: NormPos[]; t?: number };
}

export type ModoEntrada = 'teclado' | 'manos' | 'pose';
