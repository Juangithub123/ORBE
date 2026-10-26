import type { Vec2 } from '../game/orb';

// Datos de un nivel ya interpretado, listos para el juego.
// Coordenadas de mundo = coordenadas de Tiled (y crece hacia abajo, el nivel empieza abajo).

export type TipoRoca = 'piedra' | 'piedra_fragil';

export interface Roca {
  id: number;
  tipo: TipoRoca;
  /** Polígono en coordenadas de mundo (rectángulos y elipses ya convertidos). */
  puntos: Vec2[];
  /** Umbral propio para romper esta roca (solo piedra_fragil). */
  radioMin?: number;
  /** Rango vertical y horizontal, calculado una sola vez para filtrar rocas lejanas. */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface Moneda {
  id: number;
  x: number;
  y: number;
}

export interface LevelData {
  altoMapa: number;
  anchoMapa: number;
  nombre: string;
  velScrollInicial?: number;
  rocas: Roca[];
  monedas: Moneda[];
  meta: {
    /** y del borde inferior del rectángulo final: se gana cuando el centro del orbe la cruza. */
    y: number;
    /** y del borde superior (solo para dibujar la franja). */
    yArriba: number;
  };
}
