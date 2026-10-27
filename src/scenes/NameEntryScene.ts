import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { CSS, PALETA } from '../palette';
import { circuloTocaCirculo } from '../game/collisions';
import { NOMBRE_POR_DEFECTO, atrapar, elegirCayendo, type TipoCayendo } from '../game/nombre';
import { OrbView } from '../game/OrbView';
import { crearRun } from '../game/RunState';
import { ESTILOS } from '../ui/text';
import { ESCENAS, clicable, getInput, mostrarCamara, setRun } from './shared';

// Nombre del dúo: caen letras y los jugadores las atrapan con el orbe (reglas en game/nombre.ts).
// ⌫ borra una letra, BORRAR borra todo y OK confirma; al llegar al máximo de letras también se confirma.
// Si falta un jugador no se atrapa nada (el orbe quieto no "escribe" solo).
// Atajos: escribir con el teclado (solo con cámara: en modo teclado, WASD mueve el orbe), Backspace, Enter;
// "Listo" con un clic (en una tablet); Esc vuelve al menú.

const LETRA_TECLADO = /^[A-ZÑ]$/;
/** Radio de cada objeto que cae. */
const RADIO = 34;
/** Las letras aparecen debajo del nombre (no tapan lo escrito). */
const Y_APARECE = 215;
/** Pausa antes de empezar el nivel, para ver el nombre completo. */
const ANTES_DE_JUGAR_MS = 700;

const ESPECIALES: Record<Exclude<TipoCayendo, 'letra'>, { texto: string; color: number; css: string; tamano: string }> = {
  borrar: { texto: '⌫', color: PALETA.fragil, css: CSS.fragil, tamano: '30px' },
  borrarTodo: { texto: 'BORRAR', color: PALETA.piedraHalo, css: CSS.piedra, tamano: '15px' },
  ok: { texto: 'OK', color: PALETA.meta, css: CSS.meta, tamano: '26px' },
};

interface Cayendo {
  tipo: TipoCayendo;
  letra: string;
  obj: Phaser.GameObjects.Container;
}

export class NameEntryScene extends Phaser.Scene {
  private nombre = '';
  private texto!: Phaser.GameObjects.Text;
  private avisoFalta!: Phaser.GameObjects.Text;
  private orbe!: OrbView;
  private cayendo: Cayendo[] = [];
  private proximaMs = 0;
  private pausaAtrapeHasta = 0;
  private confirmado = false;

  constructor() {
    super(ESCENAS.nombre);
  }

  create() {
    mostrarCamara(this, false);
    this.nombre = '';
    this.cayendo = [];
    this.proximaMs = 0;
    this.pausaAtrapeHasta = 0;
    this.confirmado = false;
    const cx = CONFIG.ancho / 2;

    this.add.text(cx, 48, '¿Cómo se llama el dúo?', { ...ESTILOS.subtitulo, fontStyle: 'bold' }).setOrigin(0.5);
    this.texto = this.add.text(cx, 130, '', { ...ESTILOS.titulo, fontSize: '84px' }).setOrigin(0.5).setDepth(20);
    clicable(this.add.text(CONFIG.ancho - 40, 130, '[ Listo ]', { ...ESTILOS.boton, fontSize: '26px' }).setOrigin(1, 0.5), () => {
      if (this.nombre.length === 0) this.nombre = NOMBRE_POR_DEFECTO;
      this.confirmar();
    });
    this.add.rectangle(cx, Y_APARECE - RADIO - 12, CONFIG.ancho - 80, 2, PALETA.marcador, 0.4);

    const teclas = this.modoTeclado
      ? 'WASD y flechas mueven el orbe · [Backspace] borra · [Enter] confirma · [Esc] volver al menú'
      : 'También se puede escribir con el teclado · [Backspace] · [Enter] · [Esc] volver al menú';
    this.add
      .text(
        cx,
        CONFIG.alto - 12,
        `Atrapen las letras con el orbe · ⌫ borra una · BORRAR borra todo · OK confirma (máx. ${CONFIG.nombreMaxLetras})\n${teclas}`,
        { ...ESTILOS.ayuda, fontSize: '18px', align: 'center' },
      )
      .setOrigin(0.5, 1);
    this.avisoFalta = this.add
      .text(cx, CONFIG.alto / 2, 'Párense los dos frente a la cámara', ESTILOS.subtitulo)
      .setOrigin(0.5)
      .setDepth(30)
      .setVisible(false);

    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.tecla(e));
    this.orbe = new OrbView(this, getInput(this));
  }

  update(time: number, delta: number) {
    const input = getInput(this);
    const dt = delta / 1000;
    this.orbe.update(delta);
    this.avisoFalta.setVisible(input.count < 2);

    // Aparecen objetos nuevos cada letrasCadaMs.
    this.proximaMs -= delta;
    if (this.proximaMs <= 0 && !this.confirmado) {
      this.proximaMs = CONFIG.letrasCadaMs;
      this.soltar();
    }

    // Caen y, si tocan el orbe (con los dos presentes y fuera de la pausa entre atrapes), se atrapan.
    const puedeAtrapar = input.count === 2 && time >= this.pausaAtrapeHasta && !this.confirmado;
    for (const c of [...this.cayendo]) {
      c.obj.y += CONFIG.letrasVelocidad * dt;
      if (c.obj.y > CONFIG.alto + RADIO) {
        this.quitar(c);
      } else if (puedeAtrapar && time >= this.pausaAtrapeHasta && circuloTocaCirculo(this.orbe.mundo, this.orbe.radio, c.obj, RADIO)) {
        this.pausaAtrapeHasta = time + CONFIG.cooldownAtrapeMs;
        this.atrapar(c);
      }
    }

    const cursor = Math.floor(time / 500) % 2 === 0 && this.nombre.length < CONFIG.nombreMaxLetras && !this.confirmado ? '_' : ' ';
    this.texto.setText(this.nombre + cursor);
  }

  private soltar() {
    const { tipo, letra } = elegirCayendo(Math.random(), Math.random(), CONFIG.probEspecial, this.nombre.length === 0);
    const especial = tipo === 'letra' ? null : ESPECIALES[tipo];
    const x = Phaser.Math.Between(RADIO + 30, CONFIG.ancho - RADIO - 30);
    const circulo = this.add.circle(0, 0, RADIO, especial?.color ?? PALETA.orbe, 0.12).setStrokeStyle(3, especial?.color ?? PALETA.orbe, 0.9);
    const texto = this.add
      .text(0, 0, especial?.texto ?? letra, {
        ...ESTILOS.boton,
        fontSize: especial?.tamano ?? '34px',
        color: especial?.css ?? CSS.blanco,
      })
      .setOrigin(0.5);
    const obj = this.add.container(x, Y_APARECE, [circulo, texto]).setDepth(8).setAlpha(0);
    this.tweens.add({ targets: obj, alpha: 1, duration: 250 });
    this.cayendo.push({ tipo, letra, obj });
  }

  private atrapar(c: Cayendo) {
    const r = atrapar(this.nombre, c.tipo, c.letra, CONFIG.nombreMaxLetras);
    this.nombre = r.nombre;
    // Fase 6: sonido de letra atrapada.
    this.cayendo = this.cayendo.filter((x) => x !== c);
    this.tweens.add({
      targets: c.obj,
      x: this.texto.x,
      y: this.texto.y,
      scale: 0.4,
      alpha: 0,
      duration: 250,
      ease: 'Quad.easeIn',
      onComplete: () => c.obj.destroy(),
    });
    if (r.confirmar) this.confirmar();
  }

  private quitar(c: Cayendo) {
    this.cayendo = this.cayendo.filter((x) => x !== c);
    c.obj.destroy();
  }

  private tecla(e: KeyboardEvent) {
    if (this.confirmado) return;
    if (e.key === 'Escape') return this.scene.start(ESCENAS.menu);
    if (e.key === 'Enter') return this.nombre.length > 0 && this.confirmar();
    if (e.key === 'Backspace') {
      this.nombre = this.nombre.slice(0, -1);
      return;
    }
    const letra = e.key.toUpperCase();
    if (!this.modoTeclado && LETRA_TECLADO.test(letra)) {
      const r = atrapar(this.nombre, 'letra', letra, CONFIG.nombreMaxLetras);
      this.nombre = r.nombre;
      if (r.confirmar) this.confirmar();
    }
  }

  /** En modo teclado las letras mueven el orbe (WASD), así que no escriben. */
  private get modoTeclado() {
    return getInput(this).modo === 'teclado';
  }

  /** Muestra el nombre completo un momento y empieza el primer nivel. */
  private confirmar() {
    if (this.nombre.length === 0 || this.confirmado) return;
    this.confirmado = true;
    this.texto.setText(this.nombre).setColor(CSS.meta);
    this.tweens.add({ targets: this.texto, scale: { from: 1.25, to: 1 }, duration: 300, ease: 'Back.easeOut' });
    setRun(this, crearRun(this.nombre));
    this.time.delayedCall(ANTES_DE_JUGAR_MS, () => this.scene.start(ESCENAS.juego));
  }
}
