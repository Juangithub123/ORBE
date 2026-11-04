import { HandLandmarker } from '@mediapipe/tasks-vision';
import { CONFIG } from '../config';
import type { Ajustes } from '../storage/settings';
import { CameraInput, type Delegado, type WasmFileset } from './CameraInput';
import type { NormPos } from './PlayerInput';
import { centroPalma, munecaMano } from './puntos';

// Modo Manos: una persona, dos manos. Cada mano es un "jugador".
// El punto es el centro de la palma (más estable); con manoCentroPalma en false, la muñeca, como en TD (h1:wrist).

export class HandsInput extends CameraInput<HandLandmarker> {
  protected readonly conexiones = HandLandmarker.HAND_CONNECTIONS;

  constructor(ajustes: Ajustes) {
    super(ajustes, 'hand_landmarker.task', 'manos');
  }

  protected crear(fileset: WasmFileset, modelo: Uint8Array, delegado: Delegado) {
    return HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetBuffer: modelo, delegate: delegado },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: CONFIG.confianzaDeteccion,
      minHandPresenceConfidence: CONFIG.confianzaSeguimiento,
      minTrackingConfidence: CONFIG.confianzaSeguimiento,
    });
  }

  protected detectar(detector: HandLandmarker, video: HTMLVideoElement, ts: number) {
    const r = detector.detectForVideo(video, ts);
    const puntos: NormPos[][] = r.landmarks.map((mano) => mano.map((p) => ({ x: p.x, y: p.y })));
    const punto = CONFIG.manoCentroPalma ? centroPalma : munecaMano;
    return { jugadores: puntos.map(punto), puntos };
  }
}
