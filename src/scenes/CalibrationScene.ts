import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { PALETA } from '../palette';
import { OrbView } from '../game/OrbView';
import type { Vec2 } from '../game/orb';
import type { Zona } from '../storage/settings';
import { ESTILOS } from '../ui/text';
import { ESCENAS, clicable, getInput, mostrarCamara } from './shared';
import { audio } from '../audio/AudioEngine';

// Asistente de calibración de la zona de juego (4 pasos).
// Mientras dura, la entrada usa toda la imagen de la cámara. En cada paso los jugadores llevan
// el orbe lo más lejos que puedan hacia una esquina y se quedan quietos QUIETO_MS.
// Con los 4 puntos se calcula el rectángulo de juego del modo actual (Pose o Manos).
// Es más chico que la imagen completa: así un movimiento corto alcanza para cruzar la pantalla.

const QUIETO_MS = 2000;
/** Cuánto se puede mover el centro (en fracción de la imagen) y seguir contando como "quieto". */
const TOLERANCIA = 0.03;
/** Tamaño mínimo aceptable de la zona (fracción de la imagen). */
const ZONA_MIN = 0.1;

const PASOS = [
  { nombre: 'arriba a la izquierda', izq: true, arriba: true },
  { nombre: 'arriba a la derecha', izq: false, arriba: true },
  { nombre: 'abajo a la derecha', izq: false, arriba: false },
  { nombre: 'abajo a la izquierda', izq: true, arriba: false },
];

export class CalibrationScene extends Phaser.Scene {
  private orbe!: OrbView;
  private g!: Phaser.GameObjects.Graphics;
  private instruccion!: Phaser.GameObjects.Text;
  private paso = 0;
  private puntos: Vec2[] = [];
  private ancla: Vec2 | null = null;
  private quieto = 0;
  private terminado = false;

  constructor() {
    super(ESCENAS.calibracion);
  }

  create() {
    mostrarCamara(this, true);
    const input = getInput(this);
    input.calibrando = true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (input.calibrando = false));

    this.paso = 0;
    this.puntos = [];
    this.ancla = null;
    this.quieto = 0;
    this.terminado = false;

    const cx = CONFIG.ancho / 2;
    this.add.text(cx, 70, 'Calibrar zona de juego', { ...ESTILOS.titulo, fontSize: '56px' }).setOrigin(0.5);
    this.instruccion = this.add.text(cx, CONFIG.alto / 2, '', { ...ESTILOS.subtitulo, align: 'center' }).setOrigin(0.5);
    clicable(this.add.text(cx, CONFIG.alto - 28, '[Esc] o clic acá: cancelar', ESTILOS.ayuda).setOrigin(0.5), () =>
      this.scene.start(ESCENAS.ajustes),
    );
    this.g = this.add.graphics().setDepth(12);
    this.input.keyboard!.on('keydown-ESC', () => this.scene.start(ESCENAS.ajustes));

    this.orbe = new OrbView(this, input);
  }

  update(_t: number, delta: number) {
    this.orbe.update(delta);
    if (this.terminado) return;
    const input = getInput(this);
    const paso = PASOS[this.paso];

    if (input.count < 2 || input.crudos.length < 2) {
      this.instruccion.setText(`Paso ${this.paso + 1} de 4\nFalta un jugador: párense los dos frente a la cámara`);
      this.reiniciarQuieto();
      this.dibujar(paso);
      return;
    }

    // Centro del orbe en coordenadas de la cámara (0..1), sin zona de juego.
    const [a, b] = input.crudos;
    const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const enCuadrante = (c.x < 0.5) === paso.izq && (c.y < 0.5) === paso.arriba;

    if (!enCuadrante) {
      this.reiniciarQuieto();
    } else if (!this.ancla || Math.hypot(c.x - this.ancla.x, c.y - this.ancla.y) > TOLERANCIA) {
      this.ancla = c;
      this.quieto = 0;
    } else {
      this.quieto += delta;
      if (this.quieto >= QUIETO_MS) {
        this.registrar(this.ancla);
        // El texto de "¡Listo!" o del paso siguiente lo pone registrar / el próximo frame.
        return;
      }
    }

    this.instruccion.setText(
      `Paso ${this.paso + 1} de 4\nLleven el orbe lo más ${paso.nombre} que puedan\ny quédense quietos`,
    );
    this.dibujar(paso);
  }

  private reiniciarQuieto() {
    this.ancla = null;
    this.quieto = 0;
  }

  private registrar(punto: Vec2) {
    this.puntos.push(punto);
    this.reiniciarQuieto();
    audio.confirmar();
    this.paso++;
    if (this.paso < PASOS.length) return;

    const [ai, ad, bd, bi] = this.puntos;
    const zona: Zona = {
      x0: (ai.x + bi.x) / 2,
      x1: (ad.x + bd.x) / 2,
      y0: (ai.y + ad.y) / 2,
      y1: (bi.y + bd.y) / 2,
    };
    this.terminado = true;
    if (zona.x1 - zona.x0 < ZONA_MIN || zona.y1 - zona.y0 < ZONA_MIN / 2) {
      this.instruccion.setText('La zona quedó muy chica.\nProbemos de nuevo, moviéndose más.');
      this.time.delayedCall(2200, () => this.scene.restart());
      return;
    }
    const input = getInput(this);
    input.aplicarAjustes(input.modo === 'pose' ? { zonaPose: zona } : { zonaManos: zona });
    this.instruccion.setText('¡Listo! Zona guardada.');
    this.g.clear();
    this.time.delayedCall(1500, () => this.scene.start(ESCENAS.ajustes));
  }

  /** Marca la esquina objetivo y el anillo de "quieto" alrededor del orbe. */
  private dibujar(paso: (typeof PASOS)[number]) {
    const g = this.g;
    g.clear();
    if (this.terminado) return;
    const tx = paso.izq ? 90 : CONFIG.ancho - 90;
    const ty = paso.arriba ? 90 : CONFIG.alto - 90;
    g.lineStyle(3, PALETA.meta, 0.9);
    g.strokeCircle(tx, ty, 40);
    g.fillStyle(PALETA.meta, 0.25);
    g.fillCircle(tx, ty, 40);

    const progreso = this.quieto / QUIETO_MS;
    if (progreso > 0) {
      const { x, y } = this.orbe.mundo;
      const r = this.orbe.radio + 18;
      g.lineStyle(6, PALETA.meta, 1);
      g.beginPath();
      g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + progreso * Math.PI * 2, false);
      g.strokePath();
    }
  }
}
