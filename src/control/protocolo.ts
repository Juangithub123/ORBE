// Mensajes entre el juego y la ventana de control (una segunda ventana para el operador, ver VentanaControl.ts).
// Van por un BroadcastChannel: funciona entre ventanas del mismo origen, en la web (ventana emergente) y en
// la versión de escritorio (segunda ventana de Electron). Sin Phaser ni DOM, para poder probarlo.

import type { Ajustes, Zona } from '../storage/settings';
import type { ModoEntrada } from '../input/PlayerInput';
import type { NormPos } from '../input/PlayerInput';

export const CANAL = 'orbe-control';

/** Cada cuánto el juego manda su estado (ms) y cada cuántos estados manda una imagen de la cámara. */
export const ESTADO_CADA_MS = 100;
export const IMAGEN_CADA = 2;
/** Si la ventana de control no saluda en este tiempo, el juego deja de mandarle cosas (no gasta nada). */
export const CONTROL_VIVO_MS = 3000;

/** Ajustes que se pueden cambiar desde la ventana de control. */
export const AJUSTES_CONTROLABLES = [
  'modoEntrada',
  'espejar',
  'puntoPose',
  'puntoKinect',
  'zonaManos',
  'zonaPose',
  'zonaKinect',
  'camaraEnJuego',
  'modoNombre',
  'volumen',
] as const satisfies readonly (keyof Ajustes)[];

export type MensajeControl =
  /** Saludo periódico: la ventana sigue abierta (y si quiere la imagen de la cámara). */
  | { tipo: 'hola'; imagen: boolean }
  | { tipo: 'parametro'; clave: string; valor: number | boolean }
  | { tipo: 'restablecerParametros' }
  | { tipo: 'ajustes'; cambios: Partial<Ajustes> }
  /** Nombre del dúo escrito por el operador; con `confirmar`, se juega con ese nombre. */
  | { tipo: 'nombre'; nombre: string; confirmar: boolean }
  | { tipo: 'reintentar' };

export interface VistaRemota {
  puntos: NormPos[][];
  conexiones: { start: number; end: number }[];
  jugadores: NormPos[];
  /** Ancho / alto de la imagen de la cámara (el Kinect da 4:3). */
  aspecto: number;
}

export interface EstadoJuego {
  tipo: 'estado';
  /** Pantalla en la que está el juego (clave de la escena). */
  escena: string;
  modo: ModoEntrada | null;
  estadoEntrada: string;
  /** Error de la entrada o progreso de la carga, para mostrarlo tal cual. */
  mensajeEntrada: string;
  personas: number;
  ajustes: Ajustes;
  /** Parámetros que difieren de config.ts. */
  parametros: Record<string, number | boolean>;
  /** Lo que está escrito en la pantalla del nombre (null si el juego está en otra pantalla). */
  nombre: string | null;
  maxLetras: number;
  vista: VistaRemota | null;
  /** Imagen chica de la cámara (JPEG en data URL), solo si la ventana de control la pidió. */
  imagen?: string;
}

/** Deja solo los ajustes controlables y con el tipo correcto (lo que llega por el canal no se toma a ciegas). */
export function filtrarAjustes(cambios: Record<string, unknown>): Partial<Ajustes> {
  const r: Record<string, unknown> = {};
  for (const clave of AJUSTES_CONTROLABLES) {
    if (!(clave in cambios)) continue;
    const v = cambios[clave];
    if (clave.startsWith('zona')) {
      if (esZona(v)) r[clave] = limitarZona(v);
    } else if (clave === 'espejar') {
      if (typeof v === 'boolean') r[clave] = v;
    } else if (clave === 'volumen') {
      if (typeof v === 'number' && Number.isFinite(v)) r[clave] = Math.min(1, Math.max(0, v));
    } else if (typeof v === 'string') {
      r[clave] = v;
    }
  }
  return r as Partial<Ajustes>;
}

function esZona(v: unknown): v is Zona {
  if (!v || typeof v !== 'object') return false;
  const z = v as Record<string, unknown>;
  return ['x0', 'x1', 'y0', 'y1'].every((k) => typeof z[k] === 'number' && Number.isFinite(z[k]));
}

/** Tamaño mínimo de la zona (fracción de la imagen), para que no quede del revés ni de ancho cero. */
export const ZONA_MINIMA = 0.05;

/** Zona dentro de la imagen (0 a 1), ordenada y con un tamaño mínimo. */
export function limitarZona(z: Zona): Zona {
  const lim = (n: number) => Math.min(1, Math.max(0, n));
  let [x0, x1] = [lim(Math.min(z.x0, z.x1)), lim(Math.max(z.x0, z.x1))];
  let [y0, y1] = [lim(Math.min(z.y0, z.y1)), lim(Math.max(z.y0, z.y1))];
  if (x1 - x0 < ZONA_MINIMA) [x0, x1] = x0 + ZONA_MINIMA <= 1 ? [x0, x0 + ZONA_MINIMA] : [1 - ZONA_MINIMA, 1];
  if (y1 - y0 < ZONA_MINIMA) [y0, y1] = y0 + ZONA_MINIMA <= 1 ? [y0, y0 + ZONA_MINIMA] : [1 - ZONA_MINIMA, 1];
  return { x0, x1, y0, y1 };
}

/** Qué ajuste guarda la zona de juego de cada entrada (el teclado no tiene). */
export function claveZona(modo: ModoEntrada | null): 'zonaManos' | 'zonaPose' | 'zonaKinect' | null {
  if (modo === 'manos') return 'zonaManos';
  if (modo === 'pose') return 'zonaPose';
  if (modo === 'kinect') return 'zonaKinect';
  return null;
}

/** Nombre escrito por el operador: mayúsculas, solo letras (los acentos se sacan, la Ñ queda) y hasta `max` letras. */
export function limpiarNombre(texto: string, max: number) {
  return texto
    .toUpperCase()
    .replace(/Ñ/g, '\u0000')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0000/g, 'Ñ')
    .replace(/[^A-ZÑ]/g, '')
    .slice(0, Math.max(0, max));
}

/** Qué se agarra de la zona al arrastrar: el centro (mover), un borde o una esquina. */
export type Agarre = 'mover' | 'x0' | 'x1' | 'y0' | 'y1' | 'x0y0' | 'x1y0' | 'x0y1' | 'x1y1';

/** Qué parte de la zona está en (x, y) (todo de 0 a 1), con una tolerancia para los bordes. Null: afuera. */
export function agarreEn(z: Zona, x: number, y: number, tolerancia: number): Agarre | null {
  const cerca = (a: number, b: number) => Math.abs(a - b) <= tolerancia;
  const dentroX = x >= z.x0 - tolerancia && x <= z.x1 + tolerancia;
  const dentroY = y >= z.y0 - tolerancia && y <= z.y1 + tolerancia;
  if (!dentroX || !dentroY) return null;
  const bx = cerca(x, z.x0) ? 'x0' : cerca(x, z.x1) ? 'x1' : '';
  const by = cerca(y, z.y0) ? 'y0' : cerca(y, z.y1) ? 'y1' : '';
  if (bx && by) return `${bx}${by}` as Agarre;
  if (bx) return bx as Agarre;
  if (by) return by as Agarre;
  return 'mover';
}

/** Zona después de arrastrar `agarre` desde la zona `inicio` en (dx, dy) (fracciones de la imagen). */
export function arrastrarZona(inicio: Zona, agarre: Agarre, dx: number, dy: number): Zona {
  if (agarre === 'mover') {
    // Se mueve entera, sin salirse de la imagen ni cambiar de tamaño.
    const mx = Math.min(1 - inicio.x1, Math.max(-inicio.x0, dx));
    const my = Math.min(1 - inicio.y1, Math.max(-inicio.y0, dy));
    return { x0: inicio.x0 + mx, x1: inicio.x1 + mx, y0: inicio.y0 + my, y1: inicio.y1 + my };
  }
  const z = { ...inicio };
  if (agarre.includes('x0')) z.x0 = Math.min(inicio.x0 + dx, inicio.x1 - ZONA_MINIMA);
  if (agarre.includes('x1')) z.x1 = Math.max(inicio.x1 + dx, inicio.x0 + ZONA_MINIMA);
  if (agarre.includes('y0')) z.y0 = Math.min(inicio.y0 + dy, inicio.y1 - ZONA_MINIMA);
  if (agarre.includes('y1')) z.y1 = Math.max(inicio.y1 + dy, inicio.y0 + ZONA_MINIMA);
  return limitarZona(z);
}
