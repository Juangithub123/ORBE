import type { Ajustes } from '../storage/settings';
import type { VistaCamara } from './CameraInput';

// Miniatura de la cámara en la esquina inferior derecha, con los puntos detectados.
// Es un <canvas> del DOM encima del juego (no pasa por Phaser ni por el bloom).

const ANCHO = 240;
const ALTO = 180;

export class CameraPreview {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private visible = false;
  private animando = false;

  constructor(
    private obtenerVista: () => VistaCamara | null,
    private ajustes: Ajustes,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ANCHO;
    this.canvas.height = ALTO;
    Object.assign(this.canvas.style, {
      position: 'fixed',
      right: '12px',
      bottom: '12px',
      width: `${ANCHO}px`,
      height: `${ALTO}px`,
      border: '1px solid rgba(255,255,255,0.35)',
      borderRadius: '6px',
      background: '#000',
      display: 'none',
      pointerEvents: 'none',
      zIndex: '10',
    });
    this.ctx = this.canvas.getContext('2d')!;
    document.body.appendChild(this.canvas);
  }

  mostrar(visible: boolean) {
    this.visible = visible;
    this.actualizar();
  }

  /** Se llama cuando cambia la fuente de entrada (puede aparecer o desaparecer la cámara). */
  actualizar() {
    const hayCamara = this.obtenerVista() !== null;
    this.canvas.style.display = this.visible && hayCamara ? 'block' : 'none';
    if (this.visible && hayCamara && !this.animando) {
      this.animando = true;
      requestAnimationFrame(() => this.dibujar());
    }
  }

  private dibujar() {
    const vista = this.obtenerVista();
    if (!this.visible || !vista) {
      this.animando = false;
      this.canvas.style.display = 'none';
      return;
    }
    const { ctx } = this;
    const espejar = this.ajustes.espejar;
    const px = (x: number) => (espejar ? 1 - x : x) * ANCHO;

    ctx.save();
    if (espejar) {
      ctx.translate(ANCHO, 0);
      ctx.scale(-1, 1);
    }
    ctx.globalAlpha = 0.85;
    ctx.drawImage(vista.video, 0, 0, ANCHO, ALTO);
    ctx.restore();

    ctx.fillStyle = 'rgba(0,255,136,0.8)';
    for (const grupo of vista.puntos) {
      for (const p of grupo) ctx.fillRect(px(p.x) - 1.5, p.y * ALTO - 1.5, 3, 3);
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    for (const j of vista.jugadores) {
      ctx.beginPath();
      ctx.arc(px(j.x), j.y * ALTO, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    requestAnimationFrame(() => this.dibujar());
  }
}
