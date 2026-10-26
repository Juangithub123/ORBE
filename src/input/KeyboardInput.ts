import { CONFIG } from '../config';
import type { NormPos, PlayerInput } from './PlayerInput';

// Modo teclado (para depurar sin cámara): WASD mueve a P1 y las flechas a P2.
// Reporta 2 jugadores, salvo que se apriete P: simula que falta uno (para probar la pausa).
// Escucha el teclado directo en la ventana, sin depender de Phaser.

const TECLAS_P1 = { arriba: 'KeyW', abajo: 'KeyS', izq: 'KeyA', der: 'KeyD' };
const TECLAS_P2 = { arriba: 'ArrowUp', abajo: 'ArrowDown', izq: 'ArrowLeft', der: 'ArrowRight' };

export class KeyboardInput implements PlayerInput {
  private apretadas = new Set<string>();
  private p1: NormPos = { x: 0.35, y: 0.75 };
  private p2: NormPos = { x: 0.65, y: 0.75 };
  private ultimo = 0;
  /** Con P se alterna: simula que P2 salió de la cámara. */
  private simularAusencia = false;

  private onDown = (e: KeyboardEvent) => {
    this.apretadas.add(e.code);
    if (e.code.startsWith('Arrow')) e.preventDefault();
    if (e.code === 'KeyP' && !e.repeat) this.simularAusencia = !this.simularAusencia;
  };
  private onUp = (e: KeyboardEvent) => this.apretadas.delete(e.code);
  private onBlur = () => this.apretadas.clear();

  async start() {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
    this.ultimo = performance.now();
  }

  stop() {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
    this.apretadas.clear();
  }

  read() {
    const ahora = performance.now();
    const dt = Math.min(0.1, (ahora - this.ultimo) / 1000);
    this.ultimo = ahora;
    this.mover(this.p1, TECLAS_P1, dt);
    this.mover(this.p2, TECLAS_P2, dt);
    return { players: this.simularAusencia ? [{ ...this.p1 }] : [{ ...this.p1 }, { ...this.p2 }] };
  }

  private mover(p: NormPos, teclas: typeof TECLAS_P1, dt: number) {
    const vx = CONFIG.velTeclado / CONFIG.ancho;
    const vy = CONFIG.velTeclado / CONFIG.alto;
    if (this.apretadas.has(teclas.izq)) p.x -= vx * dt;
    if (this.apretadas.has(teclas.der)) p.x += vx * dt;
    if (this.apretadas.has(teclas.arriba)) p.y -= vy * dt;
    if (this.apretadas.has(teclas.abajo)) p.y += vy * dt;
    p.x = Math.min(1, Math.max(0, p.x));
    p.y = Math.min(1, Math.max(0, p.y));
  }
}
