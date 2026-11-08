import { describe, expect, it } from 'vitest';
import { esqueletoParaDibujar, leerCuerpos, posicionEnImagen, puntoDelCuerpo } from '../src/input/kinect';

describe('leerCuerpos', () => {
  it('arma un cuerpo por jugador con las posiciones en la imagen de color', () => {
    const cuerpos = leerCuerpos({
      'p1/spine:u': 0.3,
      'p1/spine:v': 0.55,
      'p1/head:u': 0.31,
      'p1/head:v': 0.2,
      'p2/spine:u': 0.7,
      'p2/spine:v': 0.5,
      'p1/spine:tx': 0.1, // se ignora: hay posición en la imagen
    });
    expect(cuerpos.map((c) => c.id)).toEqual(['1', '2']);
    expect(cuerpos[0].articulaciones.columna).toEqual({ x: 0.3, y: 0.55 });
    expect(cuerpos[0].articulaciones.cabeza).toEqual({ x: 0.31, y: 0.2 });
  });

  it('acepta otros nombres de canales (guion bajo, color_u, nombres del Kinect v2)', () => {
    const cuerpos = leerCuerpos({ 'p1_spine_mid:color_u': 0.4, 'p1_spine_mid:color_v': 0.6, 'p1_spine_shoulder:color_u': 0.4, 'p1_spine_shoulder:color_v': 0.3 });
    expect(cuerpos[0].articulaciones.columna).toEqual({ x: 0.4, y: 0.6 });
    expect(cuerpos[0].articulaciones.hombros).toEqual({ x: 0.4, y: 0.3 });
  });

  it('entiende los nombres del Kinect CHOP de TouchDesigner (por hueso: "neck" es la cabeza)', () => {
    // Canales tal como los manda TouchDesigner con un Kinect v1 (posiciones en metros).
    const canales: Record<string, number> = { p1_id: 248, 'p1:tx': 0.35, 'p1:ty': -0.64, 'p1:tz': 2 };
    const td: Record<string, [number, number]> = {
      root: [0, -0.2], spine1: [0, -0.1], spine2: [0, 0.2], neck: [0, 0.4],
      clavicle_l: [-0.2, 0.18], upperarm_l: [-0.3, 0], forearm_l: [-0.35, -0.2], hand_l: [-0.36, -0.28],
      clavicle_r: [0.2, 0.18], upperarm_r: [0.3, 0], forearm_r: [0.35, -0.2], hand_r: [0.36, -0.28],
      pelvis_l: [-0.1, -0.25], thigh_l: [-0.12, -0.7], shin_l: [-0.12, -1.1], foot_l: [-0.12, -1.15],
      pelvis_r: [0.1, -0.25], thigh_r: [0.12, -0.7], shin_r: [0.12, -1.1], foot_r: [0.12, -1.15],
    };
    for (const [n, [x, y]] of Object.entries(td)) Object.assign(canales, { [`p1/${n}:tx`]: x, [`p1/${n}:ty`]: y, [`p1/${n}:tz`]: 2 });
    for (const n of Object.keys(td)) Object.assign(canales, { [`p2/${n}:tx`]: 0, [`p2/${n}:ty`]: 0, [`p2/${n}:tz`]: 0 });
    const cuerpos = leerCuerpos(canales);
    expect(cuerpos).toHaveLength(1);
    const a = cuerpos[0].articulaciones;
    expect(Object.keys(a)).toHaveLength(20);
    // De arriba abajo: cabeza, hombros, columna, cadera, rodilla, pie.
    const alturas = [a.cabeza, a.hombros, a.columna, a.cadera, a.rodillaIzq, a.pieIzq].map((p) => p.y);
    expect([...alturas].sort((x, y) => x - y)).toEqual(alturas);
    // El codo izquierdo está entre el hombro y la muñeca.
    expect(a.codoIzq.x).toBeLessThan(a.hombroIzq.x);
    expect(a.codoIzq.x).toBeGreaterThan(a.munecaIzq.x);
  });

  it('un jugador sin seguir (todo en cero) no cuenta', () => {
    expect(leerCuerpos({ 'p1/spine:u': 0, 'p1/spine:v': 0, 'p2/spine:u': 0.5, 'p2/spine:v': 0.5 })).toHaveLength(1);
  });

  it('ignora canales que no son articulaciones', () => {
    expect(leerCuerpos({ 'p1/id': 3, 'p1/tracked': 1, 'algo': 2 })).toEqual([]);
  });
});

describe('posicionEnImagen', () => {
  it('normaliza píxeles de 640×480', () => {
    expect(posicionEnImagen({ u: 320, v: 240 })).toEqual({ x: 0.5, y: 0.5 });
  });

  it('proyecta posiciones en metros: al frente queda en el centro; a la derecha y arriba, a la derecha y arriba', () => {
    expect(posicionEnImagen({ tx: 0, ty: 0, tz: 2 })).toEqual({ x: 0.5, y: 0.5 });
    const p = posicionEnImagen({ tx: 0.5, ty: 0.3, tz: 2 })!;
    expect(p.x).toBeGreaterThan(0.5);
    expect(p.y).toBeLessThan(0.5);
  });

  it('sin datos útiles devuelve null', () => {
    expect(posicionEnImagen({ tx: 0, ty: 0, tz: 0 })).toBeNull();
    expect(posicionEnImagen({})).toBeNull();
  });
});

describe('puntoDelCuerpo', () => {
  const cuerpo = {
    id: '1',
    articulaciones: {
      cabeza: { x: 0.5, y: 0.1 },
      hombros: { x: 0.5, y: 0.25 },
      columna: { x: 0.5, y: 0.4 },
      cadera: { x: 0.5, y: 0.55 },
      manoIzq: { x: 0.3, y: 0.2 },
      manoDer: { x: 0.7, y: 0.5 },
    },
  };

  it('por defecto, la columna (abajo del pecho)', () => {
    expect(puntoDelCuerpo(cuerpo, 'columna')).toEqual({ x: 0.5, y: 0.4 });
  });

  it('el ajuste de altura corre el punto en fracción del torso', () => {
    // Torso de 0,3 (de 0,25 a 0,55): +0,1 baja 0,03.
    expect(puntoDelCuerpo(cuerpo, 'columna', 0.1)!.y).toBeCloseTo(0.43);
    expect(puntoDelCuerpo(cuerpo, 'columna', -0.1)!.y).toBeCloseTo(0.37);
  });

  it('mano: la más alta', () => {
    expect(puntoDelCuerpo(cuerpo, 'mano')).toEqual({ x: 0.3, y: 0.2 });
  });

  it('si falta la articulación pedida, usa la más cercana del torso', () => {
    expect(puntoDelCuerpo({ id: '1', articulaciones: { hombros: { x: 0.5, y: 0.3 } } }, 'columna')).toEqual({ x: 0.5, y: 0.3 });
    expect(puntoDelCuerpo({ id: '1', articulaciones: {} }, 'columna')).toBeNull();
  });
});

describe('esqueletoParaDibujar', () => {
  it('da los puntos en un orden fijo y los huesos como índices', () => {
    const { puntos, conexiones } = esqueletoParaDibujar(leerCuerpos({ 'p1/spine:u': 0.3, 'p1/spine:v': 0.5 }));
    expect(puntos).toHaveLength(1);
    expect(conexiones.length).toBeGreaterThan(10);
    expect(puntos[0].some((p) => p.x === 0.3 && p.y === 0.5)).toBe(true);
  });

  it('las articulaciones que faltan quedan sobre la más cercana (sin huesos que crucen la pantalla)', () => {
    const { puntos, conexiones } = esqueletoParaDibujar([
      { id: '1', articulaciones: { hombros: { x: 0.5, y: 0.3 }, hombroIzq: { x: 0.4, y: 0.32 }, cabeza: { x: 0.5, y: 0.15 } } },
    ]);
    for (const p of puntos[0]) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
    }
    // Ningún hueso es más largo que la distancia entre las articulaciones que sí están.
    for (const { start, end } of conexiones) {
      const [a, b] = [puntos[0][start], puntos[0][end]];
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.2);
    }
  });
});
