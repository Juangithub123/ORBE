import { HandLandmarker } from '@mediapipe/tasks-vision';
import { CameraInput, RUTA_MODELOS, cargarFileset } from './CameraInput';
import type { NormPos } from './PlayerInput';

// Modo Manos: una persona, dos manos. Cada mano es un "jugador".
// Se usa el landmark 0 (muñeca), igual que en TD (h1:wrist).

const MUNECA = 0;

export class HandsInput extends CameraInput {
  private detector: HandLandmarker | null = null;

  protected async crearDetector() {
    const fileset = await cargarFileset();
    this.detector = await crearConFallback((delegate) =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${RUTA_MODELOS}hand_landmarker.task`, delegate },
        runningMode: 'VIDEO',
        numHands: 2,
      }),
    );
  }

  protected detectar(video: HTMLVideoElement, ts: number) {
    const r = this.detector!.detectForVideo(video, ts);
    const puntos: NormPos[][] = r.landmarks.map((mano) => mano.map((p) => ({ x: p.x, y: p.y })));
    return { jugadores: puntos.map((mano) => mano[MUNECA]), puntos };
  }

  protected cerrarDetector() {
    this.detector?.close();
    this.detector = null;
  }
}

/** Intenta con la GPU y, si no anda, con la CPU. */
export async function crearConFallback<T>(crear: (delegate: 'GPU' | 'CPU') => Promise<T>): Promise<T> {
  try {
    return await crear('GPU');
  } catch (e) {
    console.warn('ORBE: MediaPipe no pudo usar la GPU, se usa la CPU', e);
    return crear('CPU');
  }
}
