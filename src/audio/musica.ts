// Partitura de la banda sonora (sin Tone.js, para poder probarla).
// Tecno industrial en Mi menor, en ciclos de 8 compases de 16 pasos (semicorcheas).
// Raíces por compás: E E E E · C C D B (el bajo, el drone y la línea acid las siguen).
//
// La partida tiene un "progreso global" de 0 a 1 (nivel actual + avance dentro del nivel, ver progresoGlobal):
// - el tempo sube con ese progreso, de bpmInicial a bpmFinal (cada nivel arranca más rápido que el anterior);
// - las capas se suman por nivel, para que se note el cambio: nivel 1 tranquilo, 2 más intenso, 3 al máximo.

export const PASOS_POR_COMPAS = 16;
export const COMPASES = 8;
export const PASOS_CICLO = PASOS_POR_COMPAS * COMPASES;

export type Modo = 'silencio' | 'menu' | 'juego' | 'pausa' | 'resultado';
export type Capa = 'bombo' | 'rumble' | 'hats' | 'hats16' | 'palmas' | 'metal' | 'drone' | 'acid' | 'stab' | 'ruido';

/** Desde qué progreso global entra cada capa en el juego (con 3 niveles: 1/3 ≈ nivel 2, 2/3 ≈ nivel 3). */
export const ENTRADA_CAPAS: Record<Capa, number> = {
  bombo: 0,
  rumble: 0,
  hats: 0,
  drone: 0,
  metal: 0.2,
  palmas: 1 / 3,
  hats16: 1 / 3,
  acid: 1 / 3,
  stab: 2 / 3,
  ruido: 2 / 3,
};

/** Raíz de cada compás del ciclo. */
const RAICES = ['E', 'E', 'E', 'E', 'C', 'C', 'D', 'B'];

/** Patrones de 16 pasos. */
const BOMBO = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
const PALMAS = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
const HATS = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0];
/** Rolling bass: suena en las tres semicorcheas que no son del bombo; el número es la octava extra. */
const RUMBLE = [-1, 0, 0, 1, -1, 0, 0, 0, -1, 0, 1, 0, -1, 0, 0, 1];
/** Golpes metálicos sincopados (1 = fuerte, 0.5 = suave). */
const METAL = [0, 0, 0, 1, 0, 0, 0.5, 0, 0, 1, 0, 0, 0, 0, 0.5, 0];
/** Línea acid: semitonos sobre la raíz (null = silencio) y acentos. */
const ACID: (number | null)[] = [0, 0, 12, 0, 3, null, 0, 7, 0, 12, 10, 0, null, 3, 0, 5];
const ACID_ACENTO = [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0];
/** Stabs (acorde de quinta) en contratiempos. */
const STAB = [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];

/** Qué capas suenan. En el juego (y en la pausa) dependen del progreso global. */
export function capasActivas(modo: Modo, progreso: number): Set<Capa> {
  switch (modo) {
    case 'silencio':
      return new Set();
    case 'menu':
      return new Set(['drone', 'rumble', 'hats']);
    case 'resultado':
      return new Set(['drone', 'metal']);
    case 'pausa':
    case 'juego':
      return new Set((Object.keys(ENTRADA_CAPAS) as Capa[]).filter((c) => progreso >= ENTRADA_CAPAS[c]));
  }
}

export interface Golpes {
  bombo: boolean;
  palmas: boolean;
  hats: boolean;
  /** Semicorchea de hi-hat (capa hats16); `hatAcento` marca las fuertes. */
  hat16: boolean;
  hatAcento: boolean;
  /** Nota del rolling bass, o null. */
  rumble: string | null;
  /** Fuerza del golpe metálico (0 = no suena). */
  metal: number;
  /** Acorde del drone (al empezar cada compás), o null. */
  drone: string[] | null;
  /** Nota de la línea acid, o null; `acidAcento` abre más el filtro. */
  acid: string | null;
  acidAcento: boolean;
  /** Acorde del stab, o null. */
  stab: string[] | null;
  /** El barrido de ruido arranca en el último compás del ciclo. */
  ruido: boolean;
}

/** Qué toca cada instrumento en el paso `paso` del ciclo. */
export function golpes(paso: number): Golpes {
  const p = ((paso % PASOS_CICLO) + PASOS_CICLO) % PASOS_CICLO;
  const compas = Math.floor(p / PASOS_POR_COMPAS);
  const i = p % PASOS_POR_COMPAS;
  const raiz = RAICES[compas];
  const octavaRumble = RUMBLE[i];
  const semitonoAcid = ACID[i];
  return {
    bombo: BOMBO[i] === 1,
    palmas: PALMAS[i] === 1,
    hats: HATS[i] === 1,
    hat16: true,
    hatAcento: HATS[i] === 1,
    rumble: octavaRumble < 0 ? null : nota(raiz, 1 + octavaRumble),
    metal: METAL[i],
    drone: i === 0 ? [nota(raiz, 2), transponer(nota(raiz, 2), 7), nota(raiz, 3)] : null,
    acid: semitonoAcid === null ? null : transponer(nota(raiz, 2), semitonoAcid),
    acidAcento: ACID_ACENTO[i] === 1,
    stab: STAB[i] ? [nota(raiz, 3), transponer(nota(raiz, 3), 7), nota(raiz, 4)] : null,
    ruido: compas === COMPASES - 1 && i === 0,
  };
}

// --- Tempo, progreso e intensidad ---------------------------------------------

/** Progreso global de la partida (0 a 1): nivel actual (desde 0) más el avance dentro de ese nivel. */
export function progresoGlobal(nivel: number, niveles: number, avanceNivel: number) {
  if (niveles <= 0) return 0;
  const avance = Math.min(1, Math.max(0, avanceNivel));
  return Math.min(1, Math.max(0, (nivel + avance) / niveles));
}

/** Tempo según el momento: fijo en los menús; en el juego sube con el progreso. */
export function bpmPara(modo: Modo, progreso: number, bpm: { menu: number; inicial: number; final: number }) {
  if (modo !== 'juego' && modo !== 'pausa') return bpm.menu;
  return bpm.inicial + (bpm.final - bpm.inicial) * Math.min(1, Math.max(0, progreso));
}

/** Apertura del filtro de la línea acid (Hz): se abre a lo largo de los niveles 2 y 3. */
export function corteAcid(progreso: number) {
  const t = Math.min(1, Math.max(0, (progreso - 1 / 3) / (2 / 3)));
  return 250 * Math.pow(14, t);
}

/**
 * Brillo de la música (frecuencia de corte del filtro general, Hz): oscura en el nivel 1 y abierta del todo
 * al llegar al nivel 3. Así el cambio de intensidad entre niveles se nota también en el timbre.
 */
export function brilloMusica(progreso: number) {
  const t = Math.min(1, Math.max(0, progreso / (2 / 3)));
  return 1800 * Math.pow(10, t);
}

/** Ganancia extra de la música (dB) según el progreso: el nivel 1 suena más bajo que el 3. */
export function gananciaPorProgreso(progreso: number) {
  return -5 + 5 * Math.min(1, Math.max(0, progreso));
}

/** Saturación del bombo (0 a 1): aparece en el nivel 3. */
export function saturacionBombo(progreso: number) {
  return Math.min(1, Math.max(0, (progreso - 2 / 3) * 3));
}

// --- Notas ----------------------------------------------------------------------

const NOMBRES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** "E" en la octava 2 → "E2". */
export function nota(raiz: string, octava: number) {
  return `${raiz}${octava}`;
}

/** Sube (o baja) una nota en semitonos: transponer("E2", 7) → "B2". */
export function transponer(n: string, semitonos: number) {
  const m = n.match(/^([A-G]#?)(-?\d)$/);
  if (!m) throw new Error(`Nota inválida: ${n}`);
  const midi = (Number(m[2]) + 1) * 12 + NOMBRES.indexOf(m[1]) + semitonos;
  return `${NOMBRES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Notas de la moneda: pentatónica de Mi menor, que sube con la racha (monedas seguidas). */
const NOTAS_MONEDA = ['E5', 'G5', 'A5', 'B5', 'D6', 'E6', 'G6', 'A6', 'B6'];

export function notaMoneda(racha: number) {
  return NOTAS_MONEDA[Math.min(NOTAS_MONEDA.length - 1, Math.max(0, racha))];
}

/** Volumen de 0 a 1 → decibeles (0 = silencio). Curva cuadrática, que se siente más pareja al oído. */
export function volumenADb(v: number) {
  if (v <= 0.001) return -Infinity;
  return 20 * Math.log10(v * v);
}
