import type { Vec2 } from '../game/orb';
import type { LevelData, Moneda, Roca, TipoRoca } from './types';

// .tmj de Tiled → LevelData. Port a TypeScript de level_lib v2 (TouchDesigner).
// - Rectángulos, polígonos y elipses (elipse → polígono de 32 segmentos).
// - Respeta la rotación de los objetos y el desplazamiento (offset) de las capas.
// - Ignora polilíneas y textos.
// - La clase del objeto se lee de `type` (o `class` en versiones nuevas de Tiled).

interface TiledProp {
  name: string;
  type?: string;
  value: unknown;
}

interface TiledObject {
  id: number;
  type?: string;
  class?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  point?: boolean;
  ellipse?: boolean;
  polygon?: Vec2[];
  polyline?: Vec2[];
  text?: unknown;
  visible?: boolean;
  properties?: TiledProp[];
}

interface TiledLayer {
  type: string;
  visible?: boolean;
  offsetx?: number;
  offsety?: number;
  objects?: TiledObject[];
  layers?: TiledLayer[];
}

export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  properties?: TiledProp[];
}

const SEGMENTOS_ELIPSE = 32;

export function parseTiled(mapa: TiledMap, nombrePorDefecto = ''): LevelData {
  const altoMapa = mapa.height * mapa.tileheight;
  const anchoMapa = mapa.width * mapa.tilewidth;
  const propsMapa = leerProps(mapa.properties);

  const rocas: Roca[] = [];
  const monedas: Moneda[] = [];
  let metaY: number | null = null;
  let metaArriba = 0;

  for (const { obj, dx, dy } of recorrerObjetos(mapa.layers)) {
    if (obj.visible === false || obj.polyline || obj.text) continue;
    const clase = obj.type || obj.class || '';
    const puntos = obtenerPuntos(obj, dx, dy);

    switch (clase) {
      case 'piedra':
      case 'piedra_fragil': {
        if (puntos.length < 3) continue;
        const props = leerProps(obj.properties);
        const roca: Roca = { id: obj.id, tipo: clase as TipoRoca, puntos, ...limites(puntos) };
        // radioMin = 0 (el valor por defecto en Tiled) significa "usar CONFIG.radioRomper".
        if (clase === 'piedra_fragil' && typeof props.radioMin === 'number' && props.radioMin > 0) roca.radioMin = props.radioMin;
        rocas.push(roca);
        break;
      }
      case 'punto': {
        // Un punto es la moneda; si alguien dibujó la moneda como forma, se usa su centro.
        const l = limites(puntos);
        monedas.push({ id: obj.id, x: (l.minX + l.maxX) / 2, y: (l.minY + l.maxY) / 2 });
        break;
      }
      case 'final': {
        const l = limites(puntos);
        // Si hay más de un final, cuenta el que se alcanza primero (el más bajo).
        if (metaY === null || l.maxY > metaY) {
          metaY = l.maxY;
          metaArriba = l.minY;
        }
        break;
      }
    }
  }

  return {
    altoMapa,
    anchoMapa,
    nombre: typeof propsMapa.nombre === 'string' && propsMapa.nombre ? propsMapa.nombre : nombrePorDefecto,
    // velScrollInicial = 0 (el valor por defecto en Tiled) significa "usar CONFIG.velScrollInicial".
    velScrollInicial: typeof propsMapa.velScrollInicial === 'number' && propsMapa.velScrollInicial > 0 ? propsMapa.velScrollInicial : undefined,
    rocas,
    monedas,
    meta: { y: metaY ?? 0, yArriba: metaArriba },
  };
}

function* recorrerObjetos(capas: TiledLayer[], dx = 0, dy = 0): Generator<{ obj: TiledObject; dx: number; dy: number }> {
  for (const capa of capas) {
    if (capa.visible === false) continue;
    const ox = dx + (capa.offsetx ?? 0);
    const oy = dy + (capa.offsety ?? 0);
    if (capa.type === 'objectgroup') {
      for (const obj of capa.objects ?? []) yield { obj, dx: ox, dy: oy };
    } else if (capa.type === 'group') {
      yield* recorrerObjetos(capa.layers ?? [], ox, oy);
    }
  }
}

/** Puntos del objeto en coordenadas de mundo, con rotación (Tiled rota en sentido horario alrededor de x,y). */
function obtenerPuntos(obj: TiledObject, dx: number, dy: number): Vec2[] {
  const w = obj.width ?? 0;
  const h = obj.height ?? 0;
  let locales: Vec2[];

  if (obj.point) {
    locales = [{ x: 0, y: 0 }];
  } else if (obj.polygon) {
    locales = obj.polygon;
  } else if (obj.ellipse) {
    locales = [];
    for (let i = 0; i < SEGMENTOS_ELIPSE; i++) {
      const a = (i / SEGMENTOS_ELIPSE) * Math.PI * 2;
      locales.push({ x: w / 2 + (Math.cos(a) * w) / 2, y: h / 2 + (Math.sin(a) * h) / 2 });
    }
  } else {
    locales = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ];
  }

  const rad = ((obj.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return locales.map((p) => ({
    x: obj.x + dx + p.x * cos - p.y * sin,
    y: obj.y + dy + p.x * sin + p.y * cos,
  }));
}

function limites(puntos: Vec2[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of puntos) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY };
}

function leerProps(props?: TiledProp[]): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const p of props ?? []) salida[p.name] = p.value;
  return salida;
}
