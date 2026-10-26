// Cálculo del orbe a partir de las posiciones de los dos jugadores.
// Función pura: no depende de Phaser, así se puede testear.

export interface Vec2 {
  x: number;
  y: number;
}

export interface OrbParams {
  radioMin: number;
  radioMax: number;
  distCerca: number;
  distLejos: number;
}

export interface OrbState {
  /** Centro del orbe (promedio de los jugadores). */
  x: number;
  y: number;
  /** Radio actual. */
  radio: number;
  /** Distancia entre los jugadores. */
  dist: number;
  /** 0 = lejos, 1 = cerca. */
  cercania: number;
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function calcOrb(p1: Vec2, p2: Vec2, params: OrbParams): OrbState {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy);
  const rango = params.distLejos - params.distCerca;
  const t = rango > 0 ? clamp((dist - params.distCerca) / rango, 0, 1) : dist > params.distCerca ? 1 : 0;
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    radio: lerp(params.radioMax, params.radioMin, t),
    dist,
    cercania: 1 - t,
  };
}
