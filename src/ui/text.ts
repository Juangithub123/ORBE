import type * as Phaser from 'phaser';
import { CSS } from '../palette';

// Estilos de texto. Tipografía de sistema en negrita, como en la versión TD.

export const FUENTE = 'Verdana, Tahoma, sans-serif';

type Estilo = Phaser.Types.GameObjects.Text.TextStyle;

export const ESTILOS = {
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
