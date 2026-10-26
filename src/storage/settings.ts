import { CONFIG } from '../config';
import type { ModoEntrada } from '../input/PlayerInput';
import type { Resolucion } from '../pantalla';

// Ajustes del dispositivo, guardados en localStorage.
// Si localStorage falla (modo privado, permisos), se usan los valores por defecto.

export interface Zona {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface Ajustes {
  modoEntrada: ModoEntrada;
  /** Punto de cada jugador en modo Pose. */
  puntoPose: 'torso' | 'muneca';
  espejar: boolean;
  zonaManos: Zona;
  zonaPose: Zona;
  mostrarCamaraEnJuego: boolean;
  volumen: number;
  /** Resolución de dibujo (no cambia la lógica, que siempre es de 1280×720). */
  resolucion: Resolucion;
  /** Si el juego arranca en pantalla completa (si no, en ventana). Solo se activa desde Ajustes. */
  pantallaCompleta: boolean;
}

const CLAVE = 'orbe.ajustes';

export const AJUSTES_POR_DEFECTO: Ajustes = {
  modoEntrada: 'teclado',
  puntoPose: 'torso',
  espejar: CONFIG.espejar,
  zonaManos: { x0: 0.1, x1: 0.9, y0: 0.1, y1: 0.9 },
  zonaPose: { x0: 0.15, x1: 0.85, y0: 0.3, y1: 0.7 },
  mostrarCamaraEnJuego: false,
  volumen: CONFIG.volumenGeneral,
  resolucion: 'auto',
  pantallaCompleta: false,
};

export function cargarAjustes(): Ajustes {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return structuredClone(AJUSTES_POR_DEFECTO);
    // Solo se toman las claves que existen hoy (así un ajuste viejo que cambió de nombre no queda colgado).
    const guardados = Object.entries(JSON.parse(crudo)).filter(([clave]) => clave in AJUSTES_POR_DEFECTO);
    return { ...structuredClone(AJUSTES_POR_DEFECTO), ...Object.fromEntries(guardados) };
  } catch {
    return structuredClone(AJUSTES_POR_DEFECTO);
  }
}

export function guardarAjustes(a: Ajustes) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(a));
  } catch {
    // Sin localStorage: los ajustes duran hasta cerrar el juego.
  }
}
