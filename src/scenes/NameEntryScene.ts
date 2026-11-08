import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { CSS, PALETA } from '../palette';
import { circuloTocaCirculo } from '../game/collisions';
import { LETRAS, NOMBRE_POR_DEFECTO, atrapar, elegirCayendo, frenarCaida, type ModoNombre, type TipoCayendo } from '../game/nombre';
import { OrbView } from '../game/OrbView';
import { crearRun } from '../game/RunState';
import { HoldButton } from '../ui/HoldButton';
import { ESTILOS } from '../ui/text';
import { ESCENAS, clicable, getInput, mostrarCamara, setRun } from './shared';
import { audio } from '../audio/AudioEngine';
import { limpiarNombre } from '../control/protocolo';
import type { NombreControl } from '../control/PuenteJuego';

// Nombre del dúo (reglas en game/nombre.ts). Se elige en Ajustes cómo:
// - "letras que caen": caen letras y los jugadores las atrapan con el orbe. Pueden ir frenando hasta quedarse
//   quietas (letrasFrenado, letrasVelocidadMinima) mientras siguen cayendo nuevas, y las vocales pueden caer
//   más seguido (letrasPesoVocales), porque atrapar justo la letra que falta a veces frustra;
// - "teclado en pantalla": el abecedario quieto; cada tecla se activa manteniendo el orbe encima (nombreTeclaMs);
// - "sin nombre": se juega directo como DUO (para una instalación donde nadie se detiene a escribir).
// Con el botón "Cambiar modo" (orbe, clic o Tab) se pasa de letras a teclado y al revés sin perder lo escrito.
// ⌫ borra una letra, BORRAR borra todo y OK confirma; al llegar al máximo de letras también se confirma.
// Si falta un jugador no se atrapa nada (el orbe quieto no "escribe" solo).
// Desde la ventana de control el operador también puede escribir el nombre (se ve acá mientras lo escribe)
// y confirmarlo; si lo escribió antes de llegar a esta pantalla, se usa al entrar.
// Atajos: escribir con el teclado (solo con cámara: en modo teclado, WASD mueve el orbe), Backspace, Enter;
// "Listo" con un clic (en una tablet); Esc vuelve al menú.

const LETRA_TECLADO = /^[A-ZÑ]$/;
/** Radio de cada objeto que cae. */
const RADIO = 34;
/** Las letras aparecen debajo del nombre (no tapan lo escrito). */
const Y_APARECE = 215;
/** Pausa antes de empezar el nivel, para ver el nombre completo. */
const ANTES_DE_JUGAR_MS = 700;
/** Cuántos lugares se prueban al soltar una letra, para no ponerla encima de otra. */
const INTENTOS_LUGAR = 8;
/** Cada letra frena un poco distinto (entre estos factores), así se quedan quietas a distintas alturas. */
const FRENADO_MIN = 0.6;
const FRENADO_MAX = 1.6;

// Teclado en pantalla: tres filas de diez teclas.
const TECLAS: (string | Exclude<TipoCayendo, 'letra'>)[] = [...LETRAS, 'borrar', 'borrarTodo', 'ok'];
const POR_FILA = 10;
const ANCHO_TECLA = 108;
const ALTO_TECLA = 96;
const SEPARACION_TECLA = 12;
const Y_PRIMERA_FILA = 300;

const ESPECIALES: Record<Exclude<TipoCayendo, 'letra'>, { texto: string; color: number; css: string; tamano: string }> = {
  borrar: { texto: '⌫', color: PALETA.fragil, css: CSS.fragil, tamano: '30px' },
  borrarTodo: { texto: 'BORRAR', color: PALETA.piedraHalo, css: CSS.piedra, tamano: '15px' },
  ok: { texto: 'OK', color: PALETA.meta, css: CSS.meta, tamano: '26px' },
};

const ES_ESPECIAL = (t: string): t is Exclude<TipoCayendo, 'letra'> => t in ESPECIALES;

interface Cayendo {
  tipo: TipoCayendo;
  letra: string;
  obj: Phaser.GameObjects.Container;
  /** Velocidad actual (px/s) y cuánto frena esta letra (factor sobre letrasFrenado). */
  v: number;
  factorFrenado: number;
  /** Desde cuándo está quieta (ms del juego), o null si se mueve. */
  quietaDesde: number | null;
}

export class NameEntryScene extends Phaser.Scene {
  private nombre = '';
  private modo: ModoNombre = 'caen';
  private texto!: Phaser.GameObjects.Text;
  private avisoFalta!: Phaser.GameObjects.Text;
  private orbe!: OrbView;
  private cayendo: Cayendo[] = [];
  private botones: HoldButton[] = [];
  private proximaMs = 0;
  private pausaAtrapeHasta = 0;
  private confirmado = false;
  /** Último nombre de la ventana de control ya aplicado. */
  private versionControl = 0;

  constructor() {
    super(ESCENAS.nombre);
  }

  /** `nombre` y `versionControl`: lo escrito antes de cambiar de modo (no se vuelve a pisar con el del operador). */
  create(datos?: { nombre?: string; versionControl?: number }) {
    mostrarCamara(this, false);
    const input = getInput(this);
    this.modo = input.config.modoNombre;
    this.nombre = datos?.nombre ?? '';
    this.cayendo = [];
    this.botones = [];
    this.proximaMs = 0;
    this.pausaAtrapeHasta = 0;
    this.confirmado = false;

    const control = this.registry.get('nombreControl') as NombreControl | null | undefined;
    if (this.modo === 'sin') {
      setRun(this, crearRun(control?.nombre || NOMBRE_POR_DEFECTO));
      this.registry.set('nombreControl', null);
      this.scene.start(ESCENAS.juego);
      return;
    }

    const cx = CONFIG.ancho / 2;
    this.add.text(cx, 48, '¿Cómo se llama el dúo?', { ...ESTILOS.subtitulo, fontStyle: 'bold' }).setOrigin(0.5);
    this.texto = this.add.text(cx, 130, '', { ...ESTILOS.titulo, fontSize: '84px' }).setOrigin(0.5).setDepth(20);
    clicable(this.add.text(CONFIG.ancho - 40, 130, '[ Listo ]', { ...ESTILOS.boton, fontSize: '26px' }).setOrigin(1, 0.5), () => {
      if (this.nombre.length === 0) this.nombre = NOMBRE_POR_DEFECTO;
      this.confirmar();
    });
    const bModo = new HoldButton(this, 160, 130, 250, 56, '', () => this.cambiarModo(), { tamano: '20px' });
    bModo.setTexto(this.modo === 'caen' ? 'Cambiar a teclado  [Tab]' : 'Cambiar a letras  [Tab]');
    this.botones.push(bModo);
    this.add.rectangle(cx, Y_APARECE - RADIO - 12, CONFIG.ancho - 80, 2, PALETA.marcador, 0.4);

    if (this.modo === 'teclado') this.crearTeclado();

    const teclas = this.modoTeclado
      ? 'WASD y flechas mueven el orbe · [Backspace] borra · [Enter] confirma · [Esc] volver al menú'
      : 'También se puede escribir con el teclado · [Backspace] · [Enter] · [Esc] volver al menú';
    const reglas =
      this.modo === 'caen'
        ? `Atrapen las letras con el orbe · ⌫ borra una · BORRAR borra todo · OK confirma (máx. ${CONFIG.nombreMaxLetras})`
        : `Mantengan el orbe sobre cada letra · ⌫ borra una · BORRAR borra todo · OK confirma (máx. ${CONFIG.nombreMaxLetras})`;
    this.add
      .text(cx, CONFIG.alto - 12, `${reglas}\n${teclas}`, { ...ESTILOS.ayuda, fontSize: '18px', align: 'center' })
      .setOrigin(0.5, 1);
    this.avisoFalta = this.add
      .text(cx, CONFIG.alto / 2, 'Párense los dos frente a la cámara', ESTILOS.subtitulo)
      .setOrigin(0.5)
      .setDepth(30)
      .setVisible(false);

    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.tecla(e));
    this.orbe = new OrbView(this, input);
    this.versionControl = datos?.versionControl ?? 0;
    this.aplicarControl();
  }

  /** Lo escrito en la pantalla (para la ventana de control). */
  get nombreActual() {
    return this.nombre;
  }

  /** Si el operador escribió (o confirmó) un nombre desde la ventana de control, se usa. */
  private aplicarControl() {
    const control = this.registry.get('nombreControl') as NombreControl | null | undefined;
    if (!control || control.version === this.versionControl || this.confirmado) return;
    this.versionControl = control.version;
    this.nombre = limpiarNombre(control.nombre, CONFIG.nombreMaxLetras);
    if (control.confirmar) {
      if (this.nombre.length === 0) this.nombre = NOMBRE_POR_DEFECTO;
      this.confirmar();
    }
  }

  update(time: number, delta: number) {
    if (this.modo === 'sin') return;
    this.aplicarControl();
    const input = getInput(this);
    this.orbe.update(delta);
    this.avisoFalta.setVisible(input.count < 2);
    if (!this.confirmado) for (const b of this.botones) b.update(input, delta);
    if (this.modo === 'caen') this.actualizarLetras(time, delta);

    const cursor = Math.floor(time / 500) % 2 === 0 && this.nombre.length < CONFIG.nombreMaxLetras && !this.confirmado ? '_' : ' ';
    this.texto.setText(this.nombre + cursor);
  }

  /** Letras que caen: aparecen, caen (frenando si corresponde) y se atrapan con el orbe. */
  private actualizarLetras(time: number, delta: number) {
    const input = getInput(this);
    const dt = delta / 1000;

    // Aparecen objetos nuevos cada letrasCadaMs.
    this.proximaMs -= delta;
    if (this.proximaMs <= 0 && !this.confirmado) {
      this.proximaMs = CONFIG.letrasCadaMs;
      this.soltar();
    }

    // Caen y, si tocan el orbe (con los dos presentes y fuera de la pausa entre atrapes), se atrapan.
    const puedeAtrapar = input.count === 2 && !this.confirmado;
    for (const c of [...this.cayendo]) {
      c.v = frenarCaida(c.v, dt, CONFIG.letrasFrenado * c.factorFrenado, CONFIG.letrasVelocidadMinima);
      c.obj.y += c.v * dt;
      if (c.v <= 0) c.quietaDesde ??= time;
      if (c.obj.y > CONFIG.alto + RADIO) {
        this.quitar(c);
      } else if (puedeAtrapar && time >= this.pausaAtrapeHasta && circuloTocaCirculo(this.orbe.mundo, this.orbe.radio, c.obj, RADIO)) {
        this.pausaAtrapeHasta = time + CONFIG.cooldownAtrapeMs;
        this.atrapar(c);
      } else if (c.quietaDesde !== null && time - c.quietaDesde > CONFIG.letrasQuietasMs) {
        this.desvanecer(c);
      }
    }
  }

  private soltar() {
    const { tipo, letra } = elegirCayendo(Math.random(), Math.random(), CONFIG.probEspecial, this.nombre.length === 0, CONFIG.letrasPesoVocales);
    const especial = tipo === 'letra' ? null : ESPECIALES[tipo];
    const x = this.lugarLibre();
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
    const factorFrenado = Phaser.Math.FloatBetween(FRENADO_MIN, FRENADO_MAX);
    this.cayendo.push({ tipo, letra, obj, v: CONFIG.letrasVelocidad, factorFrenado, quietaDesde: null });

    // Demasiadas en pantalla (con letras quietas se juntan): se va la más vieja de las quietas, o la más vieja.
    if (this.cayendo.length > Math.max(1, CONFIG.letrasMaximas)) {
      this.desvanecer(this.cayendo.find((c) => c.quietaDesde !== null) ?? this.cayendo[0]);
    }
  }

  /** Lugar (x) para una letra nueva: entre varios al azar, el más alejado de las letras de arriba y de las quietas. */
  private lugarLibre() {
    const cerca = this.cayendo.filter((c) => c.quietaDesde !== null || c.obj.y < Y_APARECE + RADIO * 4);
    let mejor = 0;
    let mejorDistancia = -1;
    for (let i = 0; i < INTENTOS_LUGAR; i++) {
      const x = Phaser.Math.Between(RADIO + 30, CONFIG.ancho - RADIO - 30);
      const distancia = Math.min(Infinity, ...cerca.map((c) => Math.abs(c.obj.x - x)));
      if (distancia > mejorDistancia) {
        mejor = x;
        mejorDistancia = distancia;
      }
      if (distancia > RADIO * 3) break;
    }
    return mejor;
  }

  /** Teclado en pantalla: cada tecla es un botón que se activa manteniendo el orbe (o con un clic). */
  private crearTeclado() {
    const anchoFila = POR_FILA * ANCHO_TECLA + (POR_FILA - 1) * SEPARACION_TECLA;
    const x0 = (CONFIG.ancho - anchoFila) / 2 + ANCHO_TECLA / 2;
    TECLAS.forEach((t, i) => {
      const fila = Math.floor(i / POR_FILA);
      const columna = i % POR_FILA;
      const x = x0 + columna * (ANCHO_TECLA + SEPARACION_TECLA);
      const y = Y_PRIMERA_FILA + fila * (ALTO_TECLA + SEPARACION_TECLA);
      const especial = ES_ESPECIAL(t) ? ESPECIALES[t] : null;
      const b = new HoldButton(this, x, y, ANCHO_TECLA, ALTO_TECLA, '', () => this.escribir(especial ? (t as TipoCayendo) : 'letra', especial ? '' : t), {
        holdMs: CONFIG.nombreTeclaMs,
        tamano: especial ? (t === 'borrarTodo' ? '20px' : '30px') : '38px',
      });
      b.setTexto(especial?.texto ?? t);
      this.botones.push(b);
    });
  }

  /** Aplica una letra o un especial (desde el teclado en pantalla o el teclado de verdad). */
  private escribir(tipo: TipoCayendo, letra: string) {
    if (this.confirmado) return;
    const r = atrapar(this.nombre, tipo, letra, CONFIG.nombreMaxLetras);
    this.nombre = r.nombre;
    audio.letra(tipo);
    if (r.confirmar) this.confirmar();
  }

  private atrapar(c: Cayendo) {
    this.escribir(c.tipo, c.letra);
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
  }

  private quitar(c: Cayendo) {
    this.cayendo = this.cayendo.filter((x) => x !== c);
    c.obj.destroy();
  }

  /** Se va de a poco (una letra quieta que nadie atrapó, o la que sobra). */
  private desvanecer(c: Cayendo) {
    this.cayendo = this.cayendo.filter((x) => x !== c);
    this.tweens.add({ targets: c.obj, alpha: 0, scale: 0.6, duration: 400, onComplete: () => c.obj.destroy() });
  }

  /** Pasa de letras que caen a teclado en pantalla (o al revés), sin perder lo escrito. */
  private cambiarModo() {
    if (this.confirmado) return;
    getInput(this).aplicarAjustes({ modoNombre: this.modo === 'caen' ? 'teclado' : 'caen' });
    this.scene.restart({ nombre: this.nombre, versionControl: this.versionControl });
  }

  private tecla(e: KeyboardEvent) {
    if (this.confirmado) return;
    if (e.key === 'Escape') return this.scene.start(ESCENAS.menu);
    if (e.key === 'Enter') return this.nombre.length > 0 && this.confirmar();
    if (e.key === 'Tab') {
      e.preventDefault();
      return this.cambiarModo();
    }
    if (e.key === 'Backspace') {
      this.nombre = this.nombre.slice(0, -1);
      return;
    }
    const letra = e.key.toUpperCase();
    if (!this.modoTeclado && LETRA_TECLADO.test(letra)) this.escribir('letra', letra);
  }

  /** En modo teclado las letras mueven el orbe (WASD), así que no escriben. */
  private get modoTeclado() {
    return getInput(this).modo === 'teclado';
  }

  /** Muestra el nombre completo un momento y empieza el primer nivel. */
  private confirmar() {
    if (this.nombre.length === 0 || this.confirmado) return;
    this.confirmado = true;
    // Lo que escribió el operador ya se usó: el próximo dúo empieza de cero.
    this.registry.set('nombreControl', null);
    this.texto.setText(this.nombre).setColor(CSS.meta);
    this.tweens.add({ targets: this.texto, scale: { from: 1.25, to: 1 }, duration: 300, ease: 'Back.easeOut' });
    setRun(this, crearRun(this.nombre));
    this.time.delayedCall(ANTES_DE_JUGAR_MS, () => this.scene.start(ESCENAS.juego));
  }
}
