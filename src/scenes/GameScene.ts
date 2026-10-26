import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { PALETA } from '../palette';
import { circuloTocaCirculo, circuloTocaPoligono } from '../game/collisions';
import { OrbView } from '../game/OrbView';
import { crearRun, type RunState } from '../game/RunState';
import type { LevelData, Moneda, Roca } from '../level/types';
import { DebugOverlay } from '../ui/DebugOverlay';
import { Hud } from '../ui/Hud';
import { ESTILOS } from '../ui/text';
import { ESCENAS, getInput, getNivel, getNiveles, getRun, setRun } from './shared';

// Un nivel del juego: scroll hacia arriba con aceleración, rocas, monedas, meta y vidas.
// Fase 3: cuenta regresiva y pausa por ausencia.

type Estado = 'cuenta' | 'jugando' | 'pausa' | 'completo' | 'perdido';

interface RocaViva {
  datos: Roca;
  g: Phaser.GameObjects.Graphics | null; // solo las frágiles tienen su propio Graphics (para poder borrarlas)
  rota: boolean;
}

interface MonedaViva {
  datos: Moneda;
  vista: Phaser.GameObjects.Arc;
}

// Tinte rojo del golpe: todo pasa a rojo según su brillo (como la captura td_golpe_tinte_rojo).
const MATRIZ_GOLPE = [
  0.6, 0.6, 0.3, 0, 0,
  0.1, 0.15, 0.05, 0, 0,
  0.1, 0.15, 0.05, 0, 0,
  0, 0, 0, 1, 0,
];

export class GameScene extends Phaser.Scene {
  private run!: RunState;
  private nivel!: LevelData;
  private orbe!: OrbView;
  private hud!: Hud;
  private debug!: DebugOverlay;
  private estado: Estado = 'jugando';

  private rocas: RocaViva[] = [];
  /** Rocas que el orbe está tocando en este frame. */
  private tocando = new Set<RocaViva>();
  private monedas: MonedaViva[] = [];
  private chispas!: Phaser.GameObjects.Particles.ParticleEmitter;
  private tinte!: Phaser.Filters.ColorMatrix;

  private tiempoJugando = 0;
  private vel = 0;
  private invulnerableHasta = 0;
  private invulnerableTotal = false;
  private textoInvulnerable!: Phaser.GameObjects.Text;

  constructor() {
    super(ESCENAS.juego);
  }

  create() {
    this.run = getRun(this)!;
    this.nivel = getNivel(this, this.run.nivel);
    this.estado = 'jugando';
    this.tiempoJugando = 0;
    this.invulnerableHasta = 0;
    this.tocando = new Set();
    this.vel = this.velInicial;

    const cam = this.cameras.main;
    cam.setScroll(0, this.nivel.altoMapa - CONFIG.alto);

    // Brillo general, como en TD (todo lo claro brilla).
    Phaser.Actions.AddEffectBloom(cam, {
      threshold: CONFIG.bloomUmbral,
      blurRadius: CONFIG.bloomRadio,
      blurSteps: 4,
      blurQuality: 1,
      blendAmount: CONFIG.bloomIntensidad,
    });
    this.tinte = cam.filters.external.addColorMatrix();
    this.tinte.colorMatrix.set(MATRIZ_GOLPE);
    this.tinte.active = false;

    this.dibujarMeta();
    this.crearRocas();
    this.crearMonedas();

    this.chispas = this.add.particles(0, 0, 'chispa', {
      speed: { min: 60, max: 280 },
      lifespan: { min: 300, max: 750 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    });
    this.chispas.setDepth(20);

    this.orbe = new OrbView(this, getInput(this));
    this.hud = new Hud(this);
    this.debug = new DebugOverlay(this, getInput(this));
    this.textoInvulnerable = this.add
      .text(CONFIG.ancho - 24, 52, 'INVULNERABLE', ESTILOS.hudVidas)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(this.invulnerableTotal);

    const kb = this.input.keyboard!;
    kb.addCapture('F1');
    kb.on('keydown-F1', () => this.debug.alternar());
    kb.on('keydown-N', () => this.completar());
    kb.on('keydown-G', () => {
      this.invulnerableTotal = !this.invulnerableTotal;
      this.textoInvulnerable.setVisible(this.invulnerableTotal);
    });
    // 1 reinicia la partida con el mismo dúo, como en TD.
    kb.on('keydown-ONE', () => {
      setRun(this, crearRun(this.run.equipo));
      this.scene.restart();
    });
  }

  private get velInicial() {
    return this.nivel.velScrollInicial ?? CONFIG.velScrollInicial;
  }

  update(time: number, delta: number) {
    const dt = delta / 1000;
    const cam = this.cameras.main;

    if (this.estado === 'jugando') {
      this.tiempoJugando += dt;
      this.vel = Math.min(CONFIG.velScrollMax, this.velInicial + CONFIG.aceleracion * this.tiempoJugando);
      cam.scrollY = Math.max(0, cam.scrollY - this.vel * dt);
    }

    this.orbe.parpadeo = time < this.invulnerableHasta;
    this.orbe.update(delta);

    if (this.estado === 'jugando') {
      this.chocarRocas(time);
      this.juntarMonedas();
      if (this.orbe.mundo.y <= this.nivel.meta.y) this.completar();
    }

    this.hud.update(this.run);
    this.debug.update({
      orbeMundo: this.orbe.mundo,
      radio: this.orbe.radio,
      vel: this.estado === 'jugando' ? this.vel : 0,
      estado: this.estado,
      invulnerableTotal: this.invulnerableTotal,
      rocas: this.debug.visible ? this.rocasEnPantalla() : [],
    });
  }

  // --- Construcción del nivel ------------------------------------------------

  private dibujarMeta() {
    const { y, yArriba } = this.nivel.meta;
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(PALETA.metaHalo, 0.35);
    g.fillRect(0, yArriba - 10, CONFIG.ancho, y - yArriba + 20);
    g.fillStyle(PALETA.meta, 1);
    g.fillRect(0, yArriba, CONFIG.ancho, y - yArriba);
  }

  private crearRocas() {
    const solidas = this.add.graphics().setDepth(2);
    this.rocas = this.nivel.rocas.map((datos) => {
      if (datos.tipo === 'piedra') {
        this.dibujarRoca(solidas, datos);
        return { datos, g: null, rota: false };
      }
      const g = this.add.graphics().setDepth(2);
      this.dibujarRoca(g, datos);
      return { datos, g, rota: false };
    });
  }

  private dibujarRoca(g: Phaser.GameObjects.Graphics, r: Roca) {
    const fragil = r.tipo === 'piedra_fragil';
    // Halo: un contorno ancho y transparente del color del halo.
    g.lineStyle(10, fragil ? PALETA.fragilHalo : PALETA.piedraHalo, 0.35);
    g.strokePoints(r.puntos as Phaser.Math.Vector2[], true, true);
    g.fillStyle(fragil ? PALETA.fragil : PALETA.piedra, 1);
    g.fillPoints(r.puntos as Phaser.Math.Vector2[], true, true);
    if (fragil) {
      // Contorno brillante para distinguirla de la sólida.
      g.lineStyle(3, 0xffffff, 0.8);
      g.strokePoints(r.puntos as Phaser.Math.Vector2[], true, true);
    }
  }

  private crearMonedas() {
    this.monedas = this.nivel.monedas.map((datos) => ({
      datos,
      vista: this.add.circle(datos.x, datos.y, CONFIG.radioMoneda, PALETA.moneda).setDepth(3),
    }));
  }

  // --- Colisiones ------------------------------------------------------------

  /** Rocas que están cerca del orbe (filtradas por su rango, sin recorrer los polígonos). */
  private rocasCerca(): RocaViva[] {
    const c = this.orbe.mundo;
    const r = this.orbe.radio;
    return this.rocas.filter(
      (rv) => !rv.rota && rv.datos.minY <= c.y + r && rv.datos.maxY >= c.y - r && rv.datos.minX <= c.x + r && rv.datos.maxX >= c.x - r,
    );
  }

  /**
   * El orbe atraviesa las rocas (no lo frenan). Para que un choque quite una sola vida,
   * una roca daña solo al entrar en contacto: mientras el orbe siga adentro, no vuelve a dañar.
   */
  private rocasEnPantalla(): Roca[] {
    const arriba = this.cameras.main.scrollY;
    const abajo = arriba + CONFIG.alto;
    return this.rocas.filter((rv) => !rv.rota && rv.datos.maxY >= arriba && rv.datos.minY <= abajo).map((rv) => rv.datos);
  }

  private chocarRocas(time: number) {
    const c = this.orbe.mundo;
    const r = this.orbe.radio;
    const ahora = new Set<RocaViva>();
    for (const rv of this.rocasCerca()) {
      if (!circuloTocaPoligono(c, r, rv.datos.puntos)) continue;
      const umbral = rv.datos.radioMin ?? CONFIG.radioRomper;
      if (rv.datos.tipo === 'piedra_fragil' && r >= umbral) {
        this.romper(rv);
        continue;
      }
      ahora.add(rv);
      const nueva = !this.tocando.has(rv);
      if (nueva && time >= this.invulnerableHasta && !this.invulnerableTotal) this.danio(time);
    }
    this.tocando = ahora;
  }

  private romper(rv: RocaViva) {
    rv.rota = true;
    rv.g?.destroy();
    rv.g = null;
    this.run.puntaje += CONFIG.puntosRocaRota;
    // Estallido: chispas desde varios puntos de la roca.
    const { minX, maxX, minY, maxY } = rv.datos;
    const cantidad = Math.min(14, Math.max(4, Math.round(((maxX - minX) * (maxY - minY)) / 6000)));
    this.chispas.setParticleTint(PALETA.fragil);
    for (let i = 0; i < cantidad; i++) {
      this.chispas.explode(8, Phaser.Math.Between(minX, maxX), Phaser.Math.Between(minY, maxY));
    }
    // Fase 6: sonido de roca rota.
  }

  private danio(time: number) {
    this.run.vidas = Math.max(0, this.run.vidas - 1);
    this.invulnerableHasta = time + CONFIG.invulnerableMs;
    this.cameras.main.shake(CONFIG.shakeMs, CONFIG.shakeIntensidad);
    this.tinte.active = true;
    this.time.delayedCall(CONFIG.flashGolpeMs, () => (this.tinte.active = false));
    // Fase 6: sonido de golpe.
    if (this.run.vidas === 0) this.perder();
  }

  private juntarMonedas() {
    const c = this.orbe.mundo;
    const r = this.orbe.radio;
    this.monedas = this.monedas.filter((m) => {
      if (!circuloTocaCirculo(c, r, m.datos, CONFIG.radioMoneda)) return true;
      this.run.puntaje += CONFIG.valorMoneda;
      this.destello(m.vista);
      // Fase 6: sonido de moneda (más agudo en racha).
      return false;
    });
  }

  private destello(vista: Phaser.GameObjects.Arc) {
    this.tweens.add({
      targets: vista,
      scale: 2.4,
      alpha: 0,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => vista.destroy(),
    });
  }

  // --- Salidas -----------------------------------------------------------------

  private perder() {
    this.estado = 'perdido';
    this.time.delayedCall(600, () => this.scene.start(ESCENAS.resultado, { gano: false }));
  }

  private completar() {
    if (this.estado !== 'jugando') return;
    this.estado = 'completo';
    // Fase 6: acorde de llegada.
    if (this.run.nivel + 1 < getNiveles(this).length) {
      this.run.nivel += 1;
      this.scene.start(ESCENAS.transicion);
    } else {
      this.scene.start(ESCENAS.resultado, { gano: true });
    }
  }
}
