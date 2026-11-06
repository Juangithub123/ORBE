// Versión de escritorio (Electron): el puente que expone electron/preload.cjs como window.orbeEscritorio.
// En la web no existe y `escritorio` es null.

export interface PuenteEscritorio {
  /** Modo kiosco: pantalla completa fija, sin cursor, el juego arranca solo. */
  kiosco: boolean;
  version: string;
  /** 'win32', 'darwin' o 'linux'. */
  plataforma: string;
  estaEnPantallaCompleta(): boolean;
  /** Pone la ventana en pantalla completa o en ventana, y lo recuerda para la próxima vez. */
  ponerPantallaCompleta(completa: boolean): void;
  salir(): void;
}

export const escritorio: PuenteEscritorio | null =
  typeof window === 'undefined' ? null : ((window as Window & { orbeEscritorio?: PuenteEscritorio }).orbeEscritorio ?? null);
