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
    setInterval(() => this.actualizar(), CADA_MS);
  }

  private actualizar() {
    this.div.style.display = CONFIG.mostrarRendimiento ? 'block' : 'none';
    if (!CONFIG.mostrarRendimiento) return;
    const partes = [`FPS ${Math.round(this.game.loop.actualFps)}`];
    const camara = this.obtenerInput()?.estadisticasCamara;
    if (camara) partes.push(`detección ${camara.ms.toFixed(1)} ms · ${camara.porSegundo}/s`);
    partes.push(`${this.game.canvas.width}×${this.game.canvas.height}`, `modo ${perfilActual()}`);
    this.div.textContent = partes.join(' · ');
  }
}
