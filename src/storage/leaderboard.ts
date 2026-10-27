// Ranking local (top 10) en localStorage.
// Orden: más puntaje primero. Si empatan, el que llegó a un nivel más alto (ganar cuenta como el más alto);
// si siguen empatados, el que lo logró antes.

export const CLAVE_RANKING = 'orbe.leaderboard';
/** Cuántas partidas guarda el ranking. */
export const LARGO_RANKING = 10;

export interface Partida {
  /** Nombre del dúo. */
  equipo: string;
  puntaje: number;
  /** Nivel al que llegaron (1 = el primero). */
  nivel: number;
  /** Si terminaron todos los niveles. */
  gano: boolean;
  /** Cuándo terminó (ms desde 1970). Desempata y sirve para identificar la partida. */
  fecha: number;
}

/** Negativo si `a` va antes que `b`. */
export function compararPartidas(a: Partida, b: Partida) {
  return b.puntaje - a.puntaje || Number(b.gano) - Number(a.gano) || b.nivel - a.nivel || a.fecha - b.fecha;
}

/** Agrega una partida y devuelve el ranking nuevo (ordenado, máximo LARGO_RANKING) y su puesto (1…), o null si no entró. */
export function insertarPartida(ranking: Partida[], partida: Partida): { ranking: Partida[]; puesto: number | null } {
  const nuevo = [...ranking, partida].sort(compararPartidas).slice(0, LARGO_RANKING);
  const i = nuevo.indexOf(partida);
  return { ranking: nuevo, puesto: i < 0 ? null : i + 1 };
}

export function leerRanking(): Partida[] {
  try {
    const datos: unknown = JSON.parse(localStorage.getItem(CLAVE_RANKING) ?? '[]');
    if (!Array.isArray(datos)) return [];
    return datos.filter(esPartida).sort(compararPartidas).slice(0, LARGO_RANKING);
  } catch {
    // Sin localStorage o con datos rotos: ranking vacío.
    return [];
  }
}

/** Guarda la partida en el ranking. Devuelve el puesto (1…) o null si no entró en el top. */
export function guardarPartida(partida: Partida): number | null {
  const { ranking, puesto } = insertarPartida(leerRanking(), partida);
  try {
    localStorage.setItem(CLAVE_RANKING, JSON.stringify(ranking));
  } catch {
    // Sin localStorage: el ranking dura hasta cerrar el juego (no se guarda).
  }
  return puesto;
}

/** Borra todo el ranking (Ajustes → Restablecer ranking). */
export function borrarRanking() {
  try {
    localStorage.removeItem(CLAVE_RANKING);
  } catch {
    // Sin localStorage no hay ranking que borrar.
  }
}

function esPartida(p: unknown): p is Partida {
  const x = p as Partida;
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof x.equipo === 'string' &&
    typeof x.puntaje === 'number' &&
    typeof x.nivel === 'number' &&
    typeof x.gano === 'boolean' &&
    typeof x.fecha === 'number'
  );
}
