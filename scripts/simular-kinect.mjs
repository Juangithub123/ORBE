// Simulador del Kinect: hace de TouchDesigner (servidor WebSocket en el puerto 9980) y manda dos esqueletos
// que se mueven, con el mismo formato que kinect/enviar_esqueletos.py. Sirve para probar el modo Kinect del
// juego sin el sensor: `npm run kinect:simular` y en el juego, Ajustes → Entrada: Kinect (o ?entrada=kinect).
// Opcional: `npm run kinect:simular -- 9981` para otro puerto.

import { WebSocketServer } from 'ws';

const puerto = Number(process.argv[2] ?? 9980);
const servidor = new WebSocketServer({ port: puerto });
console.log(`Simulador del Kinect en ws://localhost:${puerto} (Ctrl+C para cortar)`);
servidor.on('connection', () => console.log('Se conectó el juego'));

/** Articulaciones del Kinect v1 (como las nombra el Kinect CHOP) y su posición relativa al centro del cuerpo. */
const ESQUELETO = {
  head: [0, -0.25],
  shoulder_c: [0, -0.16],
  spine: [0, -0.05],
  hip_c: [0, 0.04],
  shoulder_l: [-0.06, -0.15],
  elbow_l: [-0.1, -0.07],
  wrist_l: [-0.12, 0],
  hand_l: [-0.13, 0.02],
  shoulder_r: [0.06, -0.15],
  elbow_r: [0.1, -0.07],
  wrist_r: [0.12, 0],
  hand_r: [0.13, 0.02],
  hip_l: [-0.04, 0.05],
  knee_l: [-0.05, 0.16],
  ankle_l: [-0.05, 0.27],
  foot_l: [-0.06, 0.29],
  hip_r: [0.04, 0.05],
  knee_r: [0.05, 0.16],
  ankle_r: [0.05, 0.27],
  foot_r: [0.06, 0.29],
};

setInterval(() => {
  const t = Date.now() / 1000;
  const canales = {};
  // Dos personas que se acercan y se alejan, y suben y bajan un poco.
  const cuerpos = [
    [0.5 - 0.15 - 0.1 * Math.sin(t * 0.7), 0.55 + 0.05 * Math.sin(t * 1.3)],
    [0.5 + 0.15 + 0.1 * Math.sin(t * 0.7), 0.55 + 0.05 * Math.cos(t * 1.1)],
  ];
  cuerpos.forEach(([cx, cy], i) => {
    for (const [articulacion, [dx, dy]] of Object.entries(ESQUELETO)) {
      canales[`p${i + 1}/${articulacion}:u`] = +(cx + dx).toFixed(4);
      canales[`p${i + 1}/${articulacion}:v`] = +(cy + dy).toFixed(4);
    }
  });
  const mensaje = JSON.stringify({ canales });
  for (const cliente of servidor.clients) cliente.send(mensaje);
}, 1000 / 30);
