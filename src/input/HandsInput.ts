import { HandLandmarker } from '@mediapipe/tasks-vision';
import type { Ajustes } from '../storage/settings';
import { CameraInput, type Delegado, type WasmFileset } from './CameraInput';
import type { NormPos } from './PlayerInput';

// Modo Manos: una persona, dos manos. Cada mano es un "jugador".
// Se usa el landmark 0 (muñeca), igual que en TD (h1:wrist).

const MUNECA = 0;

export class HandsInput extends CameraInput<HandLandmarker> {
  constructor(ajustes: Ajustes) {
    super(ajustes, 'hand_landmarker.task', 'manos');
  }

  protected crear(fileset: WasmFileset, modelo: Uint8Array, delegado: Delegado) {
    return HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetBuffer: modelo, delegate: delegado },
      runningMode: 'VIDEO',
      numHands: 2,
    });
  }

  protected detectar(detector: HandLandmarker, video: HTMLVideoElement, ts: number) {
    const r = detector.detectForVideo(video, ts);
    const puntos: NormPos[][] = r.landmarks.map((mano) => mano.map((p) => ({ x: p.x, y: p.y })));
    return { jugadores: puntos.map((mano) => mano[MUNECA]), puntos };
  }
}
