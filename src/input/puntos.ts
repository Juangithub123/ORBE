import type { NormPos } from './PlayerInput';

// Qué punto del cuerpo representa a cada jugador (sin MediaPipe, para poder probarlo).
// Índices de los landmarks de MediaPipe: mano (21 puntos) y pose (33 puntos).

/** Punto con la visibilidad que da MediaPipe en la pose (0 a 1: qué tan probable es que esté en cuadro). */
export interface PuntoVisible extends NormPos {
  visibility?: number;
}

/** Muñeca y nudillos (base) del índice, del medio y del meñique. */
const PALMA = [0, 5, 9, 17];
const MUNECA_MANO = 0;
const HOMBROS = [11, 12];
const CADERAS = [23, 24];
const MUNECAS_POSE = [15, 16];
/** Por debajo de esta visibilidad, un punto de la pose se considera fuera de cuadro o tapado. */
export const VISIBLE = 0.5;

/** Centro de la palma: más estable que la muñeca sola, que se mueve con cada giro de la mano. */
export function centroPalma(mano: NormPos[]): NormPos {
  return promedio(PALMA.map((i) => mano[i]));
}

export function munecaMano(mano: NormPos[]): NormPos {
  return mano[MUNECA_MANO];
}

/**
 * Centro del torso: hombros y caderas pesados por su visibilidad. Si las caderas no se ven (pasa seguido
 * cerca de la cámara de una tablet), MediaPipe igual las ubica, pero inventadas: se usan solo los hombros.
 */
export function centroTorso(persona: PuntoVisible[]): NormPos {
  const caderasVisibles = CADERAS.every((i) => (persona[i].visibility ?? 1) >= VISIBLE);
  const indices = caderasVisibles ? [...HOMBROS, ...CADERAS] : HOMBROS;
  return promedioPesado(indices.map((i) => persona[i]));
}

/** La muñeca más alta entre las que se ven; si no se ve ninguna, el centro del torso. */
export function munecaMasAlta(persona: PuntoVisible[]): NormPos {
  const visibles = MUNECAS_POSE.map((i) => persona[i]).filter((p) => (p.visibility ?? 1) >= VISIBLE);
  if (visibles.length === 0) return centroTorso(persona);
  return visibles.reduce((a, b) => (b.y < a.y ? b : a));
}

function promedio(puntos: NormPos[]): NormPos {
  let x = 0;
  let y = 0;
  for (const p of puntos) {
    x += p.x;
    y += p.y;
  }
  return { x: x / puntos.length, y: y / puntos.length };
}

/** Promedio pesado por visibilidad (mínimo 0,05, para que nunca quede en cero). */
function promedioPesado(puntos: PuntoVisible[]): NormPos {
  let x = 0;
  let y = 0;
  let peso = 0;
  for (const p of puntos) {
    const w = Math.max(0.05, p.visibility ?? 1);
    x += p.x * w;
    y += p.y * w;
    peso += w;
  }
  return { x: x / peso, y: y / peso };
}
