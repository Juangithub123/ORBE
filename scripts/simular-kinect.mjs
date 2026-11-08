// Simulador del Kinect: hace de TouchDesigner (servidor WebSocket en el puerto 9980) y manda dos esqueletos
// que se mueven, con el mismo formato que kinect/enviar_esqueletos.py. Sirve para probar el modo Kinect del
// juego sin el sensor: `npm run kinect:simular` y en el juego, Ajustes → Entrada: Kinect (o ?entrada=kinect).
// Opcional: `npm run kinect:simular -- 9981` para otro puerto.
//
// Los canales son los que manda de verdad el Kinect CHOP de TouchDesigner con un Kinect v1: articulaciones
// nombradas por hueso ("neck" es la cabeza, "clavicle_l" el hombro…) y posiciones en metros (tx, ty, tz),
// más los canales p1_id y p1:tx/ty/tz, y los jugadores 3 a 6 en cero.

import { WebSocketServer } from 'ws';

const puerto = Number(process.argv[2] ?? 9980);
const servidor = new WebSocketServer({ port: puerto });
console.log(`Simulador del Kinect en ws://localhost:${puerto} (Ctrl+C para cortar)`);
servidor.on('connection', () => console.log('Se conectó el juego'));

/** Articulaciones (nombres del Kinect CHOP) y su posición en metros respecto de la cadera, de pie. */
const ESQUELETO = {
  root: [0, 0],
  spine1: [0, 0.08],
  spine2: [0, 0.45],
  neck: [0, 0.65],
  clavicle_l: [-0.18, 0.42],
  upperarm_l: [-0.28, 0.15],
  forearm_l: [-0.32, -0.08],
  hand_l: [-0.33, -0.16],
  clavicle_r: [0.18, 0.42],
  upperarm_r: [0.28, 0.15],
  forearm_r: [0.32, -0.08],
  hand_r: [0.33, -0.16],
  pelvis_l: [-0.1, -0.06],
  thigh_l: [-0.12, -0.5],
  shin_l: [-0.12, -0.9],
  foot_l: [-0.13, -0.97],
  pelvis_r: [0.1, -0.06],
  thigh_r: [0.12, -0.5],
  shin_r: [0.12, -0.9],
  foot_r: [0.13, -0.97],
};

const redondear = (n) => Math.round(n * 1e4) / 1e4;

setInterval(() => {
  const t = Date.now() / 1000;
  const canales = {};
  // Dos personas a unos 2,2 m que se acercan y se alejan, y suben y bajan un poco (la cadera, en metros).
  const cuerpos = [
    [-0.45 - 0.3 * Math.sin(t * 0.7), -0.1 + 0.08 * Math.sin(t * 1.3), 2.2],
    [0.45 + 0.3 * Math.sin(t * 0.7), -0.1 + 0.08 * Math.cos(t * 1.1), 2.3],
  ];
  for (let i = 0; i < 6; i++) {
    const p = `p${i + 1}`;
    const cuerpo = cuerpos[i];
    canales[`${p}_id`] = cuerpo ? 100 + i : 0;
    canales[`${p}:tx`] = cuerpo ? redondear(cuerpo[0]) : 0;
    canales[`${p}:ty`] = cuerpo ? redondear(cuerpo[1]) : 0;
    canales[`${p}:tz`] = cuerpo ? cuerpo[2] : 0;
    if (i >= 2) continue; // el Kinect v1 da el esqueleto completo de dos personas como máximo
    for (const [articulacion, [dx, dy]] of Object.entries(ESQUELETO)) {
      canales[`${p}/${articulacion}:tx`] = redondear(cuerpo[0] + dx);
      canales[`${p}/${articulacion}:ty`] = redondear(cuerpo[1] + dy);
      canales[`${p}/${articulacion}:tz`] = cuerpo[2];
    }
  }
  const mensaje = JSON.stringify({ canales });
  for (const cliente of servidor.clients) cliente.send(mensaje);
}, 1000 / 30);
