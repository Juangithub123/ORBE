import { PoseLandmarker } from '@mediapipe/tasks-vision';
import { CameraInput, RUTA_MODELOS, cargarFileset } from './CameraInput';
import { crearConFallback } from './HandsInput';
import type { NormPos } from './PlayerInput';

// Modo Pose: dos personas. El punto de cada jugador se elige en Ajustes:
// - 'torso' (por defecto): promedio de hombros (11, 12) y caderas (23, 24). Estable, "mueve el cuerpo".
// - 'muneca': la muñeca más alta (15 o 16). Más rango vertical.

const HOMBROS_Y_CADERAS = [11, 12, 23, 24];
const MUNECAS = [15, 16];

export class PoseInput extends CameraInput {
  private detector: PoseLandmarker | null = null;

  protected async crearDetector() {
    const fileset = await cargarFileset();
    this.detector = await crearConFallback((delegate) =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${RUTA_MODELOS}pose_landmarker_lite.task`, delegate },
        runningMode: 'VIDEO',
        numPoses: 2,
      }),
    );
  }

  protected detectar(video: HTMLVideoElement, ts: number) {
    const r = this.detector!.detectForVideo(video, ts);
    const puntos: NormPos[][] = r.landmarks.map((persona) => persona.map((p) => ({ x: p.x, y: p.y })));
    const jugadores = puntos.map((persona) => (this.ajustes.puntoPose === 'muneca' ? munecaMasAlta(persona) : centroTorso(persona)));
    return { jugadores, puntos };
  }

  protected cerrarDetector() {
    this.detector?.close();
    this.detector = null;
  }
}

function centroTorso(persona: NormPos[]): NormPos {
  let x = 0;
  let y = 0;
  for (const i of HOMBROS_Y_CADERAS) {
    x += persona[i].x;
    y += persona[i].y;
  }
  return { x: x / HOMBROS_Y_CADERAS.length, y: y / HOMBROS_Y_CADERAS.length };
}

function munecaMasAlta(persona: NormPos[]): NormPos {
  const [a, b] = MUNECAS.map((i) => persona[i]);
  return a.y <= b.y ? a : b;
}
