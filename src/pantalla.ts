import type * as Phaser from 'phaser';
import { CONFIG } from './config';

// Resolución de dibujo.
// La lógica del juego trabaja siempre en CONFIG.ancho × CONFIG.alto (1280×720): niveles, colisiones, entrada.
// Con más resolución, el canvas es más grande y la cámara de cada escena hace zoom desde la esquina
// de arriba a la izquierda. Las coordenadas no cambian, pero textos y gráficos se dibujan más nítidos.

/** Alto en píxeles (720, 1080…) o 'auto' (según la pantalla del equipo). */
export type Resolucion = 'auto' | 720 | 1080 | 1440 | 2160;
export const RESOLUCIONES: Resolucion[] = ['auto', 720, 1080, 1440, 2160];

/** Escala máxima: 4K (2160 / 720). */
const ESCALA_MAX = 3;

let escala = 1;

/** Cuántos píxeles reales hay por píxel lógico. */
export const escalaActual = () => escala;

/** Escala para una pantalla de ancho × alto píxeles físicos: la que la llena, en pasos de 0,25. */
export function escalaAuto(anchoPx: number, altoPx: number) {
  const e = Math.min(anchoPx / CONFIG.ancho, altoPx / CONFIG.alto);
  return Math.min(ESCALA_MAX, Math.max(1, Math.round(e * 4) / 4));
}

export function calcularEscala(r: Resolucion) {
  if (r !== 'auto') return r / CONFIG.alto;
  const dpr = window.devicePixelRatio || 1;
  return escalaAuto(screen.width * dpr, screen.height * dpr);
}

/** Tamaño real del canvas para la escala actual. */
export function tamanoCanvas() {
  return { width: Math.round(CONFIG.ancho * escala), height: Math.round(CONFIG.alto * escala) };
}

/** Elige la escala antes de crear el juego. */
export function iniciarResolucion(r: Resolucion) {
  escala = calcularEscala(r);
}

/** Cambia la resolución con el juego andando. Los textos ya creados se ven nítidos al volver a crear la escena. */
export function cambiarResolucion(game: Phaser.Game, r: Resolucion) {
  escala = calcularEscala(r);
  const { width, height } = tamanoCanvas();
  game.scale.setGameSize(width, height);
  for (const s of game.scene.getScenes(true)) aplicarZoom(s);
}

// Ojo: camera.worldView de Phaser no tiene en cuenta el origen (queda corrido); el juego no lo usa.
// La conversión pantalla → mundo (getWorldPoint, la que usan los clics) sí da bien.
function aplicarZoom(scene: Phaser.Scene) {
  scene.cameras.main.setOrigin(0, 0).setZoom(escala);
}

/** Cada escena, al crearse, aplica el zoom a su cámara. Se llama una vez, con el juego ya creado. */
export function engancharEscenas(game: Phaser.Game) {
  // 'ready' y 'create' son Phaser.Core.Events.READY y Phaser.Scenes.Events.CREATE
  // (con el texto, este módulo no carga Phaser y se puede probar en los tests).
  game.events.once('ready', () => {
    for (const s of game.scene.scenes) {
      s.events.on('create', () => aplicarZoom(s));
      if (s.cameras?.main) aplicarZoom(s);
    }
  });
}

/** Etiqueta para Ajustes. */
export function nombreResolucion(r: Resolucion) {
  if (r !== 'auto') return `${Math.round((CONFIG.ancho * r) / CONFIG.alto)}×${r}`;
  const { width, height } = tamanoCanvas();
  return `automática (${width}×${height})`;
}
