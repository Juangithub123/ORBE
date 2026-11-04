import { CONFIG } from '../config';
import { perfil } from '../perfil';
import type { Ajustes, Zona } from '../storage/settings';
import type { VistaCamara } from './CameraInput';
import type { NormPos } from './PlayerInput';

// Vista de la cámara con lo que detecta MediaPipe (puntos, esqueleto y el punto de cada jugador).
// Dos formas, cada una un <canvas> del DOM encima del juego (no pasa por Phaser ni por el bloom),
// dentro de #app para que también se vea en pantalla completa:
// - miniatura: en la esquina inferior derecha, con la imagen completa de la cámara;
// - superpuesta: semitransparente sobre todo el juego, alineada con la zona de juego,
//   así cada mano o persona queda justo debajo de su anillo (su resolución depende del perfil).
// Solo se redibuja cuando hay una imagen o una detección nueva (la cámara da unas 30 por segundo;
// la pantalla puede ir a 60 o 120).

export type ModoVista = 'no' | 'miniatura' | 'superpuesta';

const ANCHO_MINI = 240;
const ALTO_MINI = 180;

const COLOR_ESQUELETO = 'rgba(0,255,136,0.75)';
const COLOR_PUNTO = 'rgba(0,255,136,0.95)';

export class CameraPreview {
  private mini: HTMLCanvasElement;
  private superpuesta: HTMLCanvasElement;
  private modo: ModoVista = 'no';
  private animando = false;
  /** Qué se dibujó la última vez (imagen, detección, modo y lugar en pantalla): si no cambió, no se redibuja. */
  private ultimoDibujo = '';

  constructor(
    private obtenerVista: () => VistaCamara | null,
    private obtenerZona: () => Zona,
    private ajustes: Ajustes,
  ) {
    const contenedor = document.getElementById('app') ?? document.body;
    this.mini = crearCanvas(ANCHO_MINI, ALTO_MINI, {
      right: '12px',
      bottom: '12px',
      width: `${ANCHO_MINI}px`,
      height: `${ALTO_MINI}px`,
      border: '1px solid rgba(255,255,255,0.35)',
      borderRadius: '6px',
      background: '#000',
      zIndex: '10',
    });
    // Debajo de los paneles (carga, parámetros) y encima del juego.
    this.superpuesta = crearCanvas(960, 540, { zIndex: '5' });
    contenedor.append(this.superpuesta, this.mini);
  }

  /** Cambia la vista: 'no', 'miniatura' o 'superpuesta' (también acepta true/false = miniatura/no). */
  mostrar(modo: ModoVista | boolean) {
    this.modo = modo === true ? 'miniatura' : modo === false ? 'no' : modo;
    this.actualizar();
  }

  /** Se llama cuando cambia la fuente de entrada (puede aparecer o desaparecer la cámara). */
  actualizar() {
    const hayCamara = this.obtenerVista() !== null;
    this.mini.style.display = hayCamara && this.modo === 'miniatura' ? 'block' : 'none';
    this.superpuesta.style.display = hayCamara && this.modo === 'superpuesta' ? 'block' : 'none';
    if (hayCamara && this.modo !== 'no' && !this.animando) {
      this.animando = true;
      requestAnimationFrame(() => this.dibujar());
    }
  }

  private dibujar() {
    const vista = this.obtenerVista();
    if (this.modo === 'no' || !vista) {
      this.animando = false;
      this.actualizar();
      return;
    }
    const lugar = this.modo === 'superpuesta' ? this.alinearConJuego() : '';
    const clave = `${this.modo}|${vista.video.currentTime}|${vista.t}|${lugar}|${this.ajustes.espejar}`;
    if (clave !== this.ultimoDibujo) {
      this.ultimoDibujo = clave;
      if (this.modo === 'miniatura') this.dibujarMiniatura(vista);
      else this.dibujarSuperpuesta(vista);
    }
    requestAnimationFrame(() => this.dibujar());
  }

  /** Imagen completa de la cámara (espejada si corresponde). */
  private dibujarMiniatura(vista: VistaCamara) {
    const ctx = this.mini.getContext('2d')!;
    const espejar = this.ajustes.espejar;
    ctx.clearRect(0, 0, ANCHO_MINI, ALTO_MINI);
    ctx.save();
    if (espejar) {
      ctx.translate(ANCHO_MINI, 0);
      ctx.scale(-1, 1);
    }
    ctx.globalAlpha = 0.85;
    ctx.drawImage(vista.video, 0, 0, ANCHO_MINI, ALTO_MINI);
    ctx.restore();
    const aPantalla = (p: NormPos) => ({ x: (espejar ? 1 - p.x : p.x) * ANCHO_MINI, y: p.y * ALTO_MINI });
    dibujarDeteccion(ctx, vista, aPantalla, 1.5, 7);
  }

  /** La zona de juego ocupa todo el juego: la imagen se estira y se corre para que coincida con los anillos. */
  private dibujarSuperpuesta(vista: VistaCamara) {
    const canvas = this.superpuesta;
    // La resolución interna depende del perfil (se elige después de crear este canvas).
    const anchoDeseado = perfil().anchoVistaSuperpuesta;
    if (canvas.width !== anchoDeseado) {
      canvas.width = anchoDeseado;
      canvas.height = Math.round((anchoDeseado * 9) / 16);
    }
    const { width: lienzoAncho, height: lienzoAlto } = canvas;
    const ctx = canvas.getContext('2d')!;
    const espejar = this.ajustes.espejar;
    const z = this.obtenerZona();
    const dx = Math.max(0.01, z.x1 - z.x0);
    const dy = Math.max(0.01, z.y1 - z.y0);
    // Rectángulo que ocupa la imagen completa de la cámara, en píxeles de este canvas.
    const ancho = lienzoAncho / dx;
    const alto = lienzoAlto / dy;
    const x = (-z.x0 / dx) * lienzoAncho;
    const y = (-z.y0 / dy) * lienzoAlto;

    ctx.clearRect(0, 0, lienzoAncho, lienzoAlto);
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, CONFIG.opacidadCamara));
    if (espejar) {
      // La zona está en coordenadas ya espejadas: se dibuja la imagen dada vuelta en el mismo rectángulo.
      ctx.translate(x + ancho, y);
      ctx.scale(-1, 1);
      ctx.drawImage(vista.video, 0, 0, ancho, alto);
    } else {
      ctx.drawImage(vista.video, x, y, ancho, alto);
    }
    ctx.restore();

    const aPantalla = (p: NormPos) => {
      const mx = espejar ? 1 - p.x : p.x;
      return { x: ((mx - z.x0) / dx) * lienzoAncho, y: ((p.y - z.y0) / dy) * lienzoAlto };
    };
    // Grosor y radios pensados para 960 de ancho; se ajustan a la resolución del perfil.
    const escala = lienzoAncho / 960;
    dibujarDeteccion(ctx, vista, aPantalla, 3 * escala, 14 * escala);
  }

  /**
   * Pone la vista superpuesta exactamente sobre el canvas del juego (Phaser lo centra y deja bordes).
   * Devuelve el lugar, para saber si cambió (por ejemplo, al girar la tablet).
   */
  private alinearConJuego() {
    const juego = document.querySelector<HTMLCanvasElement>('#app canvas:not(.orbe-camara)');
    if (!juego) return '';
    const r = juego.getBoundingClientRect();
    const s = this.superpuesta.style;
    const px = (n: number) => `${Math.round(n)}px`;
    if (s.left !== px(r.left)) s.left = px(r.left);
    if (s.top !== px(r.top)) s.top = px(r.top);
    if (s.width !== px(r.width)) s.width = px(r.width);
    if (s.height !== px(r.height)) s.height = px(r.height);
    return `${s.left},${s.top},${s.width},${s.height}`;
  }
}

/** Esqueleto, puntos y el punto de cada jugador (anillo blanco). */
function dibujarDeteccion(
  ctx: CanvasRenderingContext2D,
  vista: VistaCamara,
  aPantalla: (p: NormPos) => { x: number; y: number },
  grosor: number,
  radioJugador: number,
) {
  ctx.lineWidth = grosor;
  ctx.strokeStyle = COLOR_ESQUELETO;
  ctx.fillStyle = COLOR_PUNTO;
  for (const grupo of vista.puntos) {
    const pts = grupo.map(aPantalla);
    ctx.beginPath();
    for (const { start, end } of vista.conexiones) {
      const a = pts[start];
      const b = pts[end];
      if (!a || !b) continue;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    for (const p of pts) ctx.fillRect(p.x - grosor, p.y - grosor, grosor * 2, grosor * 2);
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = grosor + 0.5;
  for (const j of vista.jugadores) {
    const p = aPantalla(j);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radioJugador, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function crearCanvas(ancho: number, alto: number, estilo: Partial<CSSStyleDeclaration>) {
  const canvas = document.createElement('canvas');
  canvas.className = 'orbe-camara';
  canvas.width = ancho;
  canvas.height = alto;
  Object.assign(canvas.style, { position: 'fixed', display: 'none', pointerEvents: 'none', ...estilo });
  return canvas;
}
