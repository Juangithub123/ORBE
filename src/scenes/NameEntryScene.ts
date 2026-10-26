import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { crearRun } from '../game/RunState';
import { ESTILOS } from '../ui/text';
import { ESCENAS, setRun, mostrarCamara } from './shared';

// Nombre del dúo. En la fase 5 se escribe atrapando letras que caen con el orbe.
// Por ahora se usa el atajo de depuración: escribir con el teclado, Backspace borra, Enter confirma.

const LETRAS = /^[A-ZÑ]$/;

export class NameEntryScene extends Phaser.Scene {
  private nombre = '';
  private texto!: Phaser.GameObjects.Text;

  constructor() {
    super(ESCENAS.nombre);
  }

  create() {
    mostrarCamara(this, false);
    this.nombre = '';
    const cx = CONFIG.ancho / 2;
    this.add.text(cx, 140, 'Nombre del dúo', ESTILOS.subtitulo).setOrigin(0.5);
    this.texto = this.add.text(cx, CONFIG.alto / 2, '', ESTILOS.titulo).setOrigin(0.5);
    this.add
      .text(cx, CONFIG.alto - 60, 'Escribí con el teclado · [Backspace] borra · [Enter] confirma', ESTILOS.ayuda)
      .setOrigin(0.5);
    this.add.text(cx, CONFIG.alto - 30, '(El minijuego de letras llega en la fase 5)', ESTILOS.ayuda).setOrigin(0.5);

    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.tecla(e));
  }

  update(time: number) {
    const cursor = Math.floor(time / 500) % 2 === 0 && this.nombre.length < CONFIG.nombreMaxLetras ? '_' : ' ';
    this.texto.setText(this.nombre + cursor);
  }

  private tecla(e: KeyboardEvent) {
    if (e.key === 'Enter') return this.confirmar();
    if (e.key === 'Backspace') {
      this.nombre = this.nombre.slice(0, -1);
      return;
    }
    const letra = e.key.toUpperCase();
    if (LETRAS.test(letra) && this.nombre.length < CONFIG.nombreMaxLetras) {
      this.nombre += letra;
      if (this.nombre.length === CONFIG.nombreMaxLetras) this.confirmar();
    }
  }

  private confirmar() {
    if (this.nombre.length === 0) return;
    setRun(this, crearRun(this.nombre));
    this.scene.start(ESCENAS.juego);
  }
}
