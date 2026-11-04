// Perfil de rendimiento: "liviano" para celulares y tablets, "completo" para computadoras.
// Se elige en la pantalla de inicio (con una recomendación según el dispositivo) y se guarda en Ajustes.
// La lógica del juego no cambia: solo cuánto se dibuja, cuántas veces por segundo se detecta y qué tan
// pesado es el modelo de pose y el audio.

export type Perfil = 'liviano' | 'completo';

export interface OpcionesPerfil {
  /** Escala máxima de la resolución automática (1 = 1280×720, 2 = 2560×1440). */
  escalaMax: number;
  /** Brillo (bloom) en el juego: son varias pasadas sobre toda la pantalla, lo más caro de dibujar. */
  bloom: boolean;
  /** Detecciones por segundo como máximo (0 = una por cada imagen nueva de la cámara). */
  deteccionHz: number;
  /** Modelo de pose: el "full" es más preciso (sobre todo de lejos) y más pesado que el "lite". */
  modeloPose: string;
  /** Ancho interno de la cámara superpuesta al juego (el alto es 9/16). */
  anchoVistaSuperpuesta: number;
  /** Duración de las reverbs de la música (s): las largas cuestan más. */
  reverbGrande: number;
  reverbCorta: number;
  /** Partículas por cada pedazo de roca rota. */
  chispas: number;
}

export const PERFILES: Record<Perfil, OpcionesPerfil> = {
  liviano: {
    escalaMax: 1,
    bloom: false,
    deteccionHz: 20,
    modeloPose: 'pose_landmarker_lite.task',
    anchoVistaSuperpuesta: 480,
    reverbGrande: 2.5,
    reverbCorta: 0.8,
    chispas: 4,
  },
  completo: {
    escalaMax: 2,
    bloom: true,
    deteccionHz: 0,
    modeloPose: 'pose_landmarker_full.task',
    anchoVistaSuperpuesta: 960,
    reverbGrande: 6,
    reverbCorta: 1.4,
    chispas: 8,
  },
};

let actual: Perfil = 'completo';

export const perfilActual = () => actual;
export const perfil = () => PERFILES[actual];

export function elegirPerfil(p: Perfil) {
  actual = p;
}

export interface DatosDispositivo {
  userAgent: string;
  maxTouchPoints: number;
  /** Núcleos de CPU (navigator.hardwareConcurrency). */
  nucleos?: number;
  /** GB de memoria (navigator.deviceMemory, solo Chrome). */
  memoriaGb?: number;
}

/** Perfil recomendado: liviano en celulares, tablets (Android, iPhone, iPad) y equipos con poca CPU o memoria. */
export function perfilRecomendado(d: DatosDispositivo): Perfil {
  const movil = /Android|iPhone|iPad|iPod|Mobile/i.test(d.userAgent);
  // iPadOS se presenta como Mac, y Chrome en tablets Android grandes pide la "versión de escritorio"
  // (se presenta como Linux): se las reconoce por la pantalla táctil. Las notebooks táctiles con Windows no entran.
  const tabletDisfrazada = /Macintosh|Linux|X11/i.test(d.userAgent) && d.maxTouchPoints > 1;
  const pocaCpu = d.nucleos !== undefined && d.nucleos <= 4;
  const pocaMemoria = d.memoriaGb !== undefined && d.memoriaGb <= 4;
  return movil || tabletDisfrazada || pocaCpu || pocaMemoria ? 'liviano' : 'completo';
}

/** 'auto' (lo que no se eligió todavía) se resuelve con la recomendación para este dispositivo. */
export function resolverPerfil(p: Perfil | 'auto'): Perfil {
  return p === 'auto' ? perfilRecomendado(datosDeEsteDispositivo()) : p;
}

export function datosDeEsteDispositivo(): DatosDispositivo {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return { userAgent: nav.userAgent, maxTouchPoints: nav.maxTouchPoints ?? 0, nucleos: nav.hardwareConcurrency, memoriaGb: nav.deviceMemory };
}
