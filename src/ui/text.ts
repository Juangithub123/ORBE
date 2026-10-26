import type * as Phaser from 'phaser';
import { CSS } from '../palette';
import { escalaActual } from '../pantalla';

// Estilos de texto. Tipografía de sistema en negrita, como en la versión TD.
// Cada estilo lleva la resolución de dibujo actual (ver pantalla.ts), así el texto se ve nítido
// aunque la cámara haga zoom. Por eso son getters: se leen al crear cada texto.

export const FUENTE = 'Verdana, Tahoma, sans-serif';

type Estilo = Phaser.Types.GameObjects.Text.TextStyle;

const BASE = {
  /** "GAME OVER", "¡GANARON!", "ORBE". */
  titulo: { fontFamily: FUENTE, fontSize: '120px', fontStyle: 'bold', color: CSS.blanco } as Estilo,
  /** Subtítulos de las pantallas de resultado. */
  subtitulo: { fontFamily: FUENTE, fontSize: '34px', color: CSS.blanco } as Estilo,
  /** Texto chico de ayuda. */
  ayuda: { fontFamily: FUENTE, fontSize: '20px', color: CSS.gris } as Estilo,
  /** "Vidas: N". */
  hudVidas: { fontFamily: FUENTE, fontSize: '22px', fontStyle: 'bold', color: CSS.blanco } as Estilo,
  /** Puntaje arriba al centro. */
  hudPuntaje: { fontFamily: FUENTE, fontSize: '44px', fontStyle: 'bold', color: CSS.blanco } as Estilo,
  /** Texto de los botones. */
  boton: { fontFamily: FUENTE, fontSize: '32px', fontStyle: 'bold', color: CSS.blanco } as Estilo,
};

/** Agrega la resolución de dibujo actual a un estilo. */
export const nitido = (estilo: Estilo): Estilo => ({ ...estilo, resolution: escalaActual() });

export const ESTILOS = {
  get titulo() {
    return nitido(BASE.titulo);
  },
  get subtitulo() {
    return nitido(BASE.subtitulo);
  },
  get ayuda() {
    return nitido(BASE.ayuda);
  },
  get hudVidas() {
    return nitido(BASE.hudVidas);
  },
  get hudPuntaje() {
    return nitido(BASE.hudPuntaje);
  },
  get boton() {
    return nitido(BASE.boton);
  },
};

/** Achica un texto (sin cambiar su fuente) si es más ancho que `max` px. */
export function encajar<T extends Phaser.GameObjects.Text>(texto: T, max: number): T {
  return texto.setScale(texto.width > max ? max / texto.width : 1);
}
