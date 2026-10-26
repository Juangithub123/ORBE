import type { Vec2 } from './orb';

// Colisiones como funciones puras (testeadas en tests/collisions.test.ts).

/** ¿El punto está dentro del polígono? (ray casting; sirve para polígonos cóncavos). */
export function puntoEnPoligono(p: Vec2, poli: Vec2[]): boolean {
  let dentro = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const a = poli[i];
    const b = poli[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

/** Distancia al cuadrado del punto p al segmento ab. */
export function dist2PuntoSegmento(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const largo2 = abx * abx + aby * aby;
  let t = largo2 > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / largo2 : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = p.x - (a.x + abx * t);
  const dy = p.y - (a.y + aby * t);
  return dx * dx + dy * dy;
}

/** Círculo contra polígono: el centro está dentro, o algún lado queda más cerca que el radio. */
export function circuloTocaPoligono(c: Vec2, r: number, poli: Vec2[]): boolean {
  if (puntoEnPoligono(c, poli)) return true;
  const r2 = r * r;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    if (dist2PuntoSegmento(c, poli[j], poli[i]) < r2) return true;
  }
  return false;
}

/** Círculo contra círculo. */
export function circuloTocaCirculo(a: Vec2, ra: number, b: Vec2, rb: number): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = ra + rb;
  return dx * dx + dy * dy < r * r;
}
