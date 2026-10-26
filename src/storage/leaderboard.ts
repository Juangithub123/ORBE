// Ranking local (top 10) en localStorage.
// La fase 5 agrega el guardado de partidas, el orden y los desempates.

export const CLAVE_RANKING = 'orbe.leaderboard';

/** Borra todo el ranking (Ajustes → Restablecer ranking). */
export function borrarRanking() {
  try {
    localStorage.removeItem(CLAVE_RANKING);
  } catch {
    // Sin localStorage no hay ranking que borrar.
  }
}
