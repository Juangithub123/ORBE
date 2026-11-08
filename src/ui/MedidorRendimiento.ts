import type * as Phaser from 'phaser';
import { CONFIG } from '../config';
import type { InputManager } from '../input/InputManager';
import { perfilActual } from '../perfil';
import { FUENTE } from './text';

// Medidor de rendimiento (panel ⚙ → mostrarRendimiento, o F3): cuadros por segundo, cuánto tarda cada
// detección de MediaPipe y cuántas hay por segundo, resolución de dibujo y modo. Sirve para comparar el
// modo liviano y el completo en cada dispositivo. Es HTML arriba a la izquierda, dentro de #app.

/** Cada cuánto se actualiza el texto. */
const CADA_MS = 500;

export class MedidorRendimiento {
  private div: HTMLDivElement;

  constructor(
    private game: Phaser.Game,
    private obtenerInput: () => InputManager | undefined,
  ) {
    this.div = document.createElement('div');
    Object.assign(this.div.style, {
      position: 'fixed',
      left: '8px',
      top: '8px',
      zIndex: '25',
      padding: '3px 8px',
      borderRadius: '4px',
      background: 'rgba(0,0,0,0.7)',
      color: '#00ff88',
      font: `12px ${FUENTE}`,
      pointerEvents: 'none',
      display: 'none',
    });
    (document.getElementById('app') ?? document.body).appendChild(this.div);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        CONFIG.mostrarRendimiento = !CONFIG.mostrarRendimiento;
        this.actualizar();
      }
    });
    // Se cuentan los pasos reales del juego: game.loop.actualFps cuenta todos los cuadros de la pantalla,
    // también los que se saltean por el tope fpsMax (con 30 de tope en una pantalla de 60 Hz, decía 60).
    game.events.on('step', () => this.pasos++);
    setInterval(() => this.actualizar(), CADA_MS);
  }

  private pasos = 0;
  private ultimaMedicion = performance.now();
  private fps = 0;

  private actualizar() {
    const ahora = performance.now();
    this.fps = (this.pasos * 1000) / Math.max(1, ahora - this.ultimaMedicion);
    this.pasos = 0;
    this.ultimaMedicion = ahora;
    this.div.style.display = CONFIG.mostrarRendimiento ? 'block' : 'none';
    if (!CONFIG.mostrarRendimiento) return;
    const partes = [`FPS ${Math.round(this.fps)} (tope ${CONFIG.fpsMax})`];
    const camara = this.obtenerInput()?.estadisticasCamara;
    if (camara) partes.push(`detección ${camara.ms.toFixed(1)} ms · ${camara.porSegundo}/s`);
    partes.push(`${this.game.canvas.width}×${this.game.canvas.height}`, `modo ${perfilActual()}`);
    this.div.textContent = partes.join(' · ');
  }
}
