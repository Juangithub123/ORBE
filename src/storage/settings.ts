import { CONFIG } from '../config';
import type { ModoEntrada } from '../input/PlayerInput';
import type { Resolucion } from '../pantalla';
import type { Perfil } from '../perfil';
import type { PuntoKinect } from '../input/kinect';

// Ajustes del dispositivo, guardados en localStorage.
// Si localStorage falla (modo privado, permisos), se usan los valores por defecto.

export interface Zona {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Cámara durante el juego: nada, miniatura en una esquina o superpuesta a toda la pantalla. */
export type CamaraEnJuego = 'no' | 'miniatura' | 'superpuesta';

export interface Ajustes {
  modoEntrada: ModoEntrada;
  /** Cámara elegida (deviceId; '' = la predeterminada) y su nombre, para mostrarlo antes de listar las cámaras. */
  camaraId: string;
  camaraNombre: string;
  /** Punto de cada jugador en modo Pose. */
  puntoPose: 'torso' | 'muneca';
  espejar: boolean;
  zonaManos: Zona;
  zonaPose: Zona;
  /** Kinect: punto de cada jugador, zona de juego y servidor de TouchDesigner ('' = esta computadora, puerto kinectPuerto). */
  puntoKinect: PuntoKinect;
  zonaKinect: Zona;
  kinectServidor: string;
  camaraEnJuego: CamaraEnJuego;
  volumen: number;
  /** Resolución de dibujo (no cambia la lógica, que siempre es de 1280×720). */
  resolucion: Resolucion;
  /** Perfil de rendimiento elegido en la pantalla de inicio ('auto' = todavía no se eligió). */
  perfil: Perfil | 'auto';
  /** Si el juego arranca en pantalla completa (si no, en ventana). Solo se activa desde Ajustes. */
  pantallaCompleta: boolean;
}

const CLAVE = 'orbe.ajustes';

export const AJUSTES_POR_DEFECTO: Ajustes = {
  modoEntrada: 'teclado',
  camaraId: '',
  camaraNombre: '',
  puntoPose: 'torso',
  espejar: CONFIG.espejar,
  zonaManos: { x0: 0.1, x1: 0.9, y0: 0.1, y1: 0.9 },
  zonaPose: { x0: 0.15, x1: 0.85, y0: 0.3, y1: 0.7 },
  puntoKinect: 'columna',
  zonaKinect: { x0: 0.15, x1: 0.85, y0: 0.3, y1: 0.7 },
  kinectServidor: '',
  camaraEnJuego: 'superpuesta',
  volumen: CONFIG.volumenGeneral,
  resolucion: 'auto',
  pantallaCompleta: false,
  perfil: 'auto',
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
