import { CONFIG } from '../config';
import type { Ajustes } from '../storage/settings';
import type { VistaCamara } from './CameraInput';
import { esqueletoParaDibujar, leerCuerpos, puntoDelCuerpo, type Cuerpo } from './kinect';
import type { PlayerInput } from './PlayerInput';

// Modo Kinect: dos personas, seguidas por un Kinect v1 en TouchDesigner, que manda los esqueletos por
// WebSocket (el proyecto de TouchDesigner y cómo armarlo están en kinect/README.md).
// El punto de cada jugador se elige en Ajustes (por defecto, la columna: abajo del pecho) y se ajusta en
// altura desde el panel (kinectAjusteAltura). Si se corta la conexión, se reintenta sola.

/** Tiempo para conectarse a TouchDesigner al elegir la entrada. */
const CONEXION_MS = 4000;
/** Cada cuánto se reintenta si se corta la conexión. */
const REINTENTO_MS = 2000;

/** No se pudo conectar con TouchDesigner. */
export class SinKinect extends Error {
  constructor(direccion: string) {
    super(`No se pudo conectar con TouchDesigner en ${direccion}: ¿está abierto el proyecto del Kinect?`);
  }
}

export class KinectInput implements PlayerInput {
  private socket: WebSocket | null = null;
  private activo = false;
  private cuerpos: Cuerpo[] = [];
  private tDeteccion = 0;
  private reintento: ReturnType<typeof setTimeout> | null = null;
  private mensajes: number[] = [];

  constructor(private ajustes: Ajustes) {}

  /** ws://servidor:puerto (por defecto, TouchDesigner en esta misma computadora). */
  get direccion() {
    return `ws://${this.ajustes.kinectServidor || `localhost:${CONFIG.kinectPuerto}`}`;
  }

  start(): Promise<void> {
    this.activo = true;
    return new Promise((resolver, rechazar) => {
      const limite = setTimeout(() => rechazar(new SinKinect(this.direccion)), CONEXION_MS);
      this.conectar(() => {
        clearTimeout(limite);
        resolver();
      });
    });
  }

  stop() {
    this.activo = false;
    if (this.reintento) clearTimeout(this.reintento);
    this.reintento = null;
    this.socket?.close();
    this.socket = null;
    this.cuerpos = [];
  }

  read() {
    const espejar = this.ajustes.espejar;
    const players = this.cuerpos
      .map((c) => puntoDelCuerpo(c, this.ajustes.puntoKinect, CONFIG.kinectAjusteAltura / 100))
      .filter((p) => p !== null)
      .map((p) => ({ x: espejar ? 1 - p.x : p.x, y: p.y }));
    return { players, t: this.tDeteccion };
  }

  /** Para la vista "cámara sobre el juego": solo los esqueletos (no hay imagen). */
  get vista(): VistaCamara | null {
    if (!this.socket) return null;
    const { puntos, conexiones } = esqueletoParaDibujar(this.cuerpos);
    const jugadores = this.cuerpos.map((c) => puntoDelCuerpo(c, this.ajustes.puntoKinect, CONFIG.kinectAjusteAltura / 100)).filter((p) => p !== null);
    return { video: null, puntos, jugadores, conexiones, t: this.tDeteccion };
  }

  /** Para el medidor de rendimiento: mensajes de TouchDesigner por segundo. */
  get estadisticas() {
    const ahora = performance.now();
    this.mensajes = this.mensajes.filter((t) => ahora - t < 1000);
    return { ms: 0, porSegundo: this.mensajes.length };
  }

  private conectar(alAbrir?: () => void) {
    if (!this.activo) return;
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.direccion);
    } catch (e) {
      console.warn('ORBE: dirección del Kinect inválida', this.direccion, e);
      return;
    }
    this.socket = socket;
    socket.onopen = () => alAbrir?.();
    socket.onmessage = (evento) => this.recibir(evento.data);
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.cuerpos = [];
      if (this.activo) this.reintento = setTimeout(() => this.conectar(), REINTENTO_MS);
    };
  }

  private recibir(datos: unknown) {
    if (typeof datos !== 'string') return;
    try {
      const mensaje = JSON.parse(datos) as { canales?: Record<string, number> };
      if (!mensaje.canales) return;
      this.cuerpos = leerCuerpos(mensaje.canales);
      this.tDeteccion = performance.now();
      this.mensajes.push(this.tDeteccion);
      if (this.mensajes.length > 120) this.mensajes.splice(0, 60);
    } catch (e) {
      console.warn('ORBE: mensaje del Kinect inválido', e);
    }
  }
}
