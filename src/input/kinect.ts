import type { NormPos } from './PlayerInput';

// Lectura de los esqueletos del Kinect que manda TouchDesigner (sin red ni Phaser, para poder probarla).
// TouchDesigner manda por WebSocket todos los canales de su Kinect CHOP: {"canales": {"p1/spine:u": 0.51, ...}}
// (ver kinect/README.md). Los nombres cambian según la versión y las opciones del CHOP, así que se aceptan
// varias formas:
//   - jugador y articulación: "p1/spine", "p1_spine", "p1:spine"… Ojo: el Kinect CHOP de TouchDesigner
//     nombra las articulaciones por hueso ("p1/spine2", "p1/clavicle_l"; ver ARTICULACIONES_TD);
//   - posición: en la imagen de color (u, v o color_u, color_v), en la de profundidad (depth_u, depth_v) o en
//     el mundo, en metros (tx, ty, tz), que se proyecta como lo hace la cámara del Kinect v1.
// Todas las posiciones quedan normalizadas de 0 a 1, con y hacia abajo, como las de MediaPipe.

export type PuntoKinect = 'columna' | 'hombros' | 'cadera' | 'cabeza' | 'mano';

/** Articulaciones del Kinect v1 (nombre propio) y los nombres que pueden traer los canales. */
const ARTICULACIONES: Record<string, string[]> = {
  cabeza: ['head'],
  hombros: ['shoulder_c', 'shoulder_center', 'shouldercenter', 'spine_shoulder', 'spineshoulder', 'neck'],
  columna: ['spine', 'spine_mid', 'spinemid'],
  cadera: ['hip_c', 'hip_center', 'hipcenter', 'spine_base', 'spinebase'],
  hombroIzq: ['shoulder_l', 'shoulder_left', 'shoulderleft'],
  codoIzq: ['elbow_l', 'elbow_left', 'elbowleft'],
  munecaIzq: ['wrist_l', 'wrist_left', 'wristleft'],
  manoIzq: ['hand_l', 'hand_left', 'handleft'],
  hombroDer: ['shoulder_r', 'shoulder_right', 'shoulderright'],
  codoDer: ['elbow_r', 'elbow_right', 'elbowright'],
  munecaDer: ['wrist_r', 'wrist_right', 'wristright'],
  manoDer: ['hand_r', 'hand_right', 'handright'],
  caderaIzq: ['hip_l', 'hip_left', 'hipleft'],
  rodillaIzq: ['knee_l', 'knee_left', 'kneeleft'],
  tobilloIzq: ['ankle_l', 'ankle_left', 'ankleleft'],
  pieIzq: ['foot_l', 'foot_left', 'footleft'],
  caderaDer: ['hip_r', 'hip_right', 'hipright'],
  rodillaDer: ['knee_r', 'knee_right', 'kneeright'],
  tobilloDer: ['ankle_r', 'ankle_right', 'ankleright'],
  pieDer: ['foot_r', 'foot_right', 'footright'],
};

/**
 * El Kinect CHOP de TouchDesigner (Kinect v1, SDK 1.8) nombra cada articulación por el hueso que termina en
 * ella: "neck" es la cabeza (no el cuello), "spine2" el centro de los hombros, "clavicle_l" el hombro,
 * "upperarm_l" el codo, "thigh_l" la rodilla… Son las 20 del SDK, en el mismo orden. Como "neck" choca con el
 * nombre de otras versiones (donde sí es el cuello), esta tabla se usa solo si el mensaje trae nombres que
 * únicamente existen en ella (ver NOMBRES_SOLO_TD).
 */
const ARTICULACIONES_TD: Record<string, string[]> = {
  cadera: ['root'],
  columna: ['spine1'],
  hombros: ['spine2'],
  cabeza: ['neck', 'head'],
  hombroIzq: ['clavicle_l'],
  codoIzq: ['upperarm_l'],
  munecaIzq: ['forearm_l'],
  manoIzq: ['hand_l'],
  hombroDer: ['clavicle_r'],
  codoDer: ['upperarm_r'],
  munecaDer: ['forearm_r'],
  manoDer: ['hand_r'],
  caderaIzq: ['pelvis_l'],
  rodillaIzq: ['thigh_l'],
  tobilloIzq: ['shin_l'],
  pieIzq: ['foot_l'],
  caderaDer: ['pelvis_r'],
  rodillaDer: ['thigh_r'],
  tobilloDer: ['shin_r'],
  pieDer: ['foot_r'],
};
const NOMBRES_SOLO_TD = new Set(['root', 'spine1', 'spine2', 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'forearm_l', 'forearm_r', 'pelvis_l', 'pelvis_r', 'thigh_l', 'thigh_r', 'shin_l', 'shin_r']);

/** Huesos para dibujar el esqueleto (pares de articulaciones). */
export const HUESOS: [string, string][] = [
  ['cabeza', 'hombros'], ['hombros', 'columna'], ['columna', 'cadera'],
  ['hombros', 'hombroIzq'], ['hombroIzq', 'codoIzq'], ['codoIzq', 'munecaIzq'], ['munecaIzq', 'manoIzq'],
  ['hombros', 'hombroDer'], ['hombroDer', 'codoDer'], ['codoDer', 'munecaDer'], ['munecaDer', 'manoDer'],
  ['cadera', 'caderaIzq'], ['caderaIzq', 'rodillaIzq'], ['rodillaIzq', 'tobilloIzq'], ['tobilloIzq', 'pieIzq'],
  ['cadera', 'caderaDer'], ['caderaDer', 'rodillaDer'], ['rodillaDer', 'tobilloDer'], ['tobilloDer', 'pieDer'],
];

/** Un cuerpo: sus articulaciones en coordenadas normalizadas de la imagen. */
export interface Cuerpo {
  id: string;
  articulaciones: Record<string, NormPos>;
}

const porNombre = (tabla: Record<string, string[]>) => {
  const mapa = new Map<string, string>();
  for (const [propio, nombres] of Object.entries(tabla)) for (const n of nombres) mapa.set(n, propio);
  return mapa;
};
const POR_NOMBRE = porNombre(ARTICULACIONES);
const POR_NOMBRE_TD = porNombre(ARTICULACIONES_TD);

/** Articulación "padre" de cada una (la más cercana al centro del cuerpo), según los huesos. */
const PADRE = new Map(HUESOS.map(([padre, hija]) => [hija, padre]));

/**
 * Campo de visión de la cámara de color del Kinect v1 (grados), para proyectar posiciones en metros
 * cuando el CHOP no manda posiciones en la imagen.
 */
const FOV_H = 62;
const FOV_V = 48.6;

/** Lee el mensaje de TouchDesigner y devuelve los cuerpos con al menos una articulación válida. */
export function leerCuerpos(canales: Record<string, number>): Cuerpo[] {
  // jugador → articulación → atributo → valor
  const datos = new Map<string, Map<string, Record<string, number>>>();
  const leidos: [string, string, string, number][] = [];
  let nombresTd = false;
  for (const [nombre, valor] of Object.entries(canales)) {
    if (typeof valor !== 'number' || !Number.isFinite(valor)) continue;
    const m = nombre.toLowerCase().match(/^p(\d+)[/_:](.+?)[:.](\w+)$/);
    if (!m) continue;
    const articulacion = m[2].replace(/\s+/g, '');
    if (NOMBRES_SOLO_TD.has(articulacion)) nombresTd = true;
    leidos.push([m[1], articulacion, m[3], valor]);
  }
  const tabla = nombresTd ? POR_NOMBRE_TD : POR_NOMBRE;
  for (const [jugador, articulacion, atributo, valor] of leidos) {
    const propio = tabla.get(articulacion);
    if (!propio) continue;
    let delJugador = datos.get(jugador);
    if (!delJugador) datos.set(jugador, (delJugador = new Map()));
    const atributos = delJugador.get(propio) ?? {};
    atributos[atributo] = valor;
    delJugador.set(propio, atributos);
  }

  const cuerpos: Cuerpo[] = [];
  for (const [jugador, articulaciones] of [...datos].sort(([a], [b]) => Number(a) - Number(b))) {
    const cuerpo: Cuerpo = { id: jugador, articulaciones: {} };
    for (const [nombre, a] of articulaciones) {
      const p = posicionEnImagen(a);
      if (p) cuerpo.articulaciones[nombre] = p;
    }
    if (Object.keys(cuerpo.articulaciones).length > 0) cuerpos.push(cuerpo);
  }
  return cuerpos;
}

/** Posición normalizada (0 a 1, y hacia abajo) a partir de los atributos de una articulación, o null si no está seguida. */
export function posicionEnImagen(a: Record<string, number>): NormPos | null {
  const uv = (u?: number, v?: number) => {
    if (u === undefined || v === undefined) return null;
    if (u === 0 && v === 0) return null; // sin seguir: el CHOP manda ceros
    // Si vienen en píxeles (imagen de 640×480), se normalizan.
    return u > 1.5 || v > 1.5 ? { x: u / 640, y: v / 480 } : { x: u, y: v };
  };
  const color = uv(a.u ?? a.color_u ?? a.coloru, a.v ?? a.color_v ?? a.colorv);
  if (color) return color;
  const profundidad = uv(a.depth_u ?? a.depthu, a.depth_v ?? a.depthv);
  if (profundidad) return profundidad;
  if (a.tx !== undefined && a.ty !== undefined && a.tz !== undefined && a.tz > 0.1) {
    const rad = Math.PI / 180;
    return {
      x: 0.5 + a.tx / (2 * a.tz * Math.tan((FOV_H / 2) * rad)),
      y: 0.5 - a.ty / (2 * a.tz * Math.tan((FOV_V / 2) * rad)),
    };
  }
  return null;
}

/**
 * Punto que representa al jugador. `ajusteAltura` (en fracción del largo del torso, de hombros a cadera)
 * lo corre hacia abajo (positivo) o hacia arriba (negativo). Si falta la articulación pedida, se usa la más
 * cercana disponible del torso.
 */
export function puntoDelCuerpo(cuerpo: Cuerpo, punto: PuntoKinect, ajusteAltura = 0): NormPos | null {
  const a = cuerpo.articulaciones;
  let base: NormPos | undefined;
  if (punto === 'mano') {
    const manos = [a.manoIzq ?? a.munecaIzq, a.manoDer ?? a.munecaDer].filter((p): p is NormPos => !!p);
    base = manos.length ? manos.reduce((m, p) => (p.y < m.y ? p : m)) : undefined;
  } else {
    const orden: Record<Exclude<PuntoKinect, 'mano'>, string[]> = {
      columna: ['columna', 'hombros', 'cadera', 'cabeza'],
      hombros: ['hombros', 'columna', 'cabeza', 'cadera'],
      cadera: ['cadera', 'columna', 'hombros', 'cabeza'],
      cabeza: ['cabeza', 'hombros', 'columna', 'cadera'],
    };
    base = orden[punto].map((n) => a[n]).find((p) => !!p);
  }
  if (!base) return null;
  if (ajusteAltura !== 0 && a.hombros && a.cadera) {
    const largoTorso = a.cadera.y - a.hombros.y;
    return { x: base.x, y: base.y + largoTorso * ajusteAltura };
  }
  return base;
}

/** Para la vista de la cámara: los puntos de cada cuerpo en un orden fijo y los huesos como pares de índices. */
export function esqueletoParaDibujar(cuerpos: Cuerpo[]) {
  const nombres = Object.keys(ARTICULACIONES);
  const indice = new Map(nombres.map((n, i) => [n, i]));
  // Una articulación que falta (sin seguir, o el modo sentado, que no da piernas) se pone sobre la más
  // cercana que sí está, subiendo por el esqueleto: su hueso queda de largo cero y no se ve. (Antes iban
  // fuera de la imagen, y cada hueso con un extremo faltante cruzaba la pantalla como una línea larga.)
  const puntos = cuerpos.map((c) => {
    const a = c.articulaciones;
    const cualquiera = Object.values(a)[0];
    return nombres.map((n) => {
      let actual: string | undefined = n;
      while (actual && !a[actual]) actual = PADRE.get(actual);
      return (actual && a[actual]) || cualquiera;
    });
  });
  const conexiones = HUESOS.map(([a, b]) => ({ start: indice.get(a)!, end: indice.get(b)! }));
  return { puntos, conexiones };
}
