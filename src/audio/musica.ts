// Partitura de la banda sonora (sin Tone.js, para poder probarla).
// Electrónica tipo synthwave en La menor, en ciclos de 8 compases de 16 pasos (semicorcheas):
//   A: Am – F – C – G   ·   B: F – G – Em – Am
// Capas: bombo, palmas, hi-hats, bajo en octavas, colchón de acordes, arpegio y melodía.
// Qué capas suenan depende del momento (menú, juego, pausa, resultado) y, en el juego, de la intensidad
// (sube con la velocidad del scroll).

export const PASOS_POR_COMPAS = 16;
export const COMPASES = 8;
export const PASOS_CICLO = PASOS_POR_COMPAS * COMPASES;

export type Modo = 'silencio' | 'menu' | 'juego' | 'pausa' | 'resultado';
export type Capa = 'bombo' | 'palmas' | 'hats' | 'hatsRapidos' | 'bajo' | 'colchon' | 'arpegio' | 'melodia';

interface Acorde {
  /** Nota grave del bajo. */
  bajo: string;
  /** Notas del colchón (voces cerradas, sin saltos grandes entre acordes). */
  colchon: string[];
  /** Notas del arpegio, de grave a agudo. */
  arpegio: string[];
}

const AM: Acorde = { bajo: 'A1', colchon: ['A3', 'C4', 'E4'], arpegio: ['A4', 'C5', 'E5', 'A5'] };
const F: Acorde = { bajo: 'F1', colchon: ['A3', 'C4', 'F4'], arpegio: ['F4', 'A4', 'C5', 'F5'] };
const C: Acorde = { bajo: 'C2', colchon: ['G3', 'C4', 'E4'], arpegio: ['G4', 'C5', 'E5', 'G5'] };
const G: Acorde = { bajo: 'G1', colchon: ['G3', 'B3', 'D4'], arpegio: ['G4', 'B4', 'D5', 'G5'] };
const EM: Acorde = { bajo: 'E1', colchon: ['G3', 'B3', 'E4'], arpegio: ['E4', 'G4', 'B4', 'E5'] };

/** Un acorde por compás. */
export const PROGRESION: Acorde[] = [AM, F, C, G, F, G, EM, AM];

/** Patrones de 16 pasos (1 = suena). */
const BOMBO = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
const PALMAS = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
const HATS = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0];
const HATS_RAPIDOS = [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1];
/** Bajo en octavas (synthwave): 0 = nota grave, 1 = una octava arriba, -1 = silencio. */
const BAJO = [0, -1, 1, -1, 0, -1, 1, 0, 0, -1, 1, -1, 0, 1, 0, 1];
/** Índices dentro del arpegio del acorde. */
const ARPEGIO = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 2, 3, 2, 1];

/** Melodía de 4 compases que se repite (una nota cada 2 pasos; null = silencio). Pentatónica de La menor. */
const MELODIA: (string | null)[] = [
  'E5', null, 'A5', null, 'G5', 'E5', null, 'D5',    'C5', null, null, 'D5', 'E5', null, null, null,
  'C5', null, 'F5', null, 'E5', 'C5', null, 'A4',    'G4', null, null, 'A4', 'C5', null, 'D5', null,
];

/** Qué capas suenan en cada momento. En el juego, `intensidad` (0 a 1) agrega capas. */
export function capasActivas(modo: Modo, intensidad: number): Set<Capa> {
  switch (modo) {
    case 'silencio':
      return new Set();
    case 'menu':
      return new Set(['colchon', 'arpegio', 'bajo', 'hats']);
    case 'resultado':
      return new Set(['colchon', 'arpegio']);
    case 'pausa':
    case 'juego': {
      const capas = new Set<Capa>(['bombo', 'bajo', 'colchon', 'arpegio', 'hats']);
      if (intensidad >= 0.25) capas.add('palmas');
      if (intensidad >= 0.5) capas.add('hatsRapidos');
      if (intensidad >= 0.65) capas.add('melodia');
      return capas;
    }
  }
}

export interface Golpes {
  bombo: boolean;
  palmas: boolean;
  hats: boolean;
  hatsRapidos: boolean;
  /** Nota del bajo en este paso, o null. */
  bajo: string | null;
  /** Acorde del colchón (solo al empezar cada compás), o null. */
  colchon: string[] | null;
  arpegio: string;
  melodia: string | null;
}

/** Qué toca cada instrumento en el paso `paso` del ciclo (0 a PASOS_CICLO - 1). */
export function golpes(paso: number): Golpes {
  const p = ((paso % PASOS_CICLO) + PASOS_CICLO) % PASOS_CICLO;
  const compas = Math.floor(p / PASOS_POR_COMPAS);
  const i = p % PASOS_POR_COMPAS;
  const acorde = PROGRESION[compas];
  const octava = BAJO[i];
  return {
    bombo: BOMBO[i] === 1,
    palmas: PALMAS[i] === 1,
    hats: HATS[i] === 1,
    hatsRapidos: HATS_RAPIDOS[i] === 1,
    bajo: octava < 0 ? null : octava === 0 ? acorde.bajo : subirOctava(acorde.bajo),
    colchon: i === 0 ? acorde.colchon : null,
    arpegio: acorde.arpegio[ARPEGIO[i]],
    melodia: p % 2 === 0 ? MELODIA[(p / 2) % MELODIA.length] : null,
  };
}

/** "A1" → "A2". */
export function subirOctava(nota: string) {
  const m = nota.match(/^([A-G]#?)(\d)$/);
  if (!m) throw new Error(`Nota inválida: ${nota}`);
  return `${m[1]}${Number(m[2]) + 1}`;
}

/** Notas de la moneda: pentatónica de La menor, que sube con la racha (monedas seguidas). */
const NOTAS_MONEDA = ['A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7', 'D7', 'E7'];

export function notaMoneda(racha: number) {
  return NOTAS_MONEDA[Math.min(NOTAS_MONEDA.length - 1, Math.max(0, racha))];
}

/** Volumen de 0 a 1 → decibeles (0 = silencio). Curva cuadrática, que se siente más pareja al oído. */
export function volumenADb(v: number) {
  if (v <= 0.001) return -Infinity;
  return 20 * Math.log10(v * v);
}

/** Intensidad del juego (0 a 1) según la velocidad del scroll. */
export function intensidadPorVelocidad(vel: number, velInicial: number, velMax: number) {
  if (velMax <= velInicial) return 1;
  return Math.min(1, Math.max(0, (vel - velInicial) / (velMax - velInicial)));
}
