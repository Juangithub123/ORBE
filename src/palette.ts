// Colores de la estética de la versión TouchDesigner (ver docs/referencias/).
// Cada color está como número (para Phaser) y como texto CSS (para textos).

export const PALETA = {
  fondo: 0x000000,

  /** Roca sólida (piedra): relleno rosa claro con halo rosa/rojo. */
  piedra: 0xffb8ba,
  piedraHalo: 0xff6e78,

  /** Roca frágil (piedra_fragil): naranja, para distinguirla de la sólida. */
  fragil: 0xffb070,
  fragilHalo: 0xff8a30,

  /** Meta (final): franja verde claro con halo verde. */
  meta: 0xa8ffc0,
  metaHalo: 0x4cff7a,

  /** Monedas: amarillo claro con halo. */
  moneda: 0xffff80,
  monedaHalo: 0xffff40,

  /** Orbe: blanco con halo fuerte. */
  orbe: 0xffffff,

  /** Anillos de los jugadores: grises huecos. */
  marcador: 0xb4b4b4,

  /** Tinte del golpe. */
  golpe: 0xff3030,
};

export const CSS = {
  blanco: '#ffffff',
  gris: '#9a9a9a',
  piedra: '#ffb8ba',
  fragil: '#ffb070',
  meta: '#a8ffc0',
  moneda: '#ffff80',
};
