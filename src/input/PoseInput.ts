import { PoseLandmarker } from '@mediapipe/tasks-vision';
import { CONFIG } from '../config';
import { perfil } from '../perfil';
import type { Ajustes } from '../storage/settings';
import { CameraInput, type Delegado, type WasmFileset } from './CameraInput';
import type { NormPos } from './PlayerInput';
import { centroTorso, munecaMasAlta } from './puntos';

// Modo Pose: dos personas. El punto de cada jugador se elige en Ajustes (ver puntos.ts):
// - 'torso' (por defecto): hombros y caderas pesados por su visibilidad; si las caderas no se ven, los hombros.
//   Estable, "mueve el cuerpo".
// - 'muneca': la muñeca más alta entre las que se ven. Más rango vertical.
// El modelo depende del perfil: "full" (más preciso, sobre todo de lejos) en el completo, "lite" en el liviano.

export class PoseInput extends CameraInput<PoseLandmarker> {
  protected readonly conexiones = PoseLandmarker.POSE_CONNECTIONS;

  constructor(ajustes: Ajustes) {
    super(ajustes, perfil().modeloPose, 'cuerpo');
  }

  protected crear(fileset: WasmFileset, modelo: Uint8Array, delegado: Delegado) {
    return PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetBuffer: modelo, delegate: delegado },
      runningMode: 'VIDEO',
      numPoses: 2,
      minPoseDetectionConfidence: CONFIG.confianzaDeteccion,
      minPosePresenceConfidence: CONFIG.confianzaSeguimiento,
      minTrackingConfidence: CONFIG.confianzaSeguimiento,
    });
  }

  protected detectar(detector: PoseLandmarker, video: HTMLVideoElement, ts: number) {
    const r = detector.detectForVideo(video, ts);
    const punto = this.ajustes.puntoPose === 'muneca' ? munecaMasAlta : centroTorso;
    const jugadores = r.landmarks.map((persona) => punto(persona));
    const puntos: NormPos[][] = r.landmarks.map((persona) => persona.map((p) => ({ x: p.x, y: p.y })));
    return { jugadores, puntos };
  }
}
