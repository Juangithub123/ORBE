// ============================================================================
// PANEL DE CONTROL DE ORBE
// Equivale al componente game_control de la versión TouchDesigner.
// Todos los números ajustables del juego viven acá. Cambiá un valor, guardá,
// y el navegador se recarga solo (con `npm run dev`).
// Los valores son un punto de partida: se ajustan en las pruebas de juego.
// ============================================================================

export const CONFIG = {
  // --- Pantalla ------------------------------------------------------------
  /** Resolución lógica del juego. Se escala a la ventana manteniendo proporción. */
  ancho: 1280,
  alto: 720,

  // --- Orbe ----------------------------------------------------------------
  /** Radio del orbe (px) cuando los jugadores están lejos. */
  radioMin: 25,
  /** Radio del orbe (px) cuando los jugadores están cerca. */
  radioMax: 90,
  /** Distancia entre jugadores (px de pantalla) que cuenta como "cerca". Menos que esto = radio máximo. */
  distCerca: 150,
  /** Distancia entre jugadores (px de pantalla) que cuenta como "lejos". Más que esto = radio mínimo. */
  distLejos: 700,
  /** Radio mínimo del orbe para romper una piedra_fragil. */
  radioRomper: 60,
  /** Cantidad de copias anteriores que forman la estela del orbe. */
  estelaCopias: 7,

  // --- Entrada -------------------------------------------------------------
  /** Suavizado de la posición por frame (0 = no se mueve, 1 = sin suavizado). Como el Filter CHOP de TD. */
  suavizado: 0.25,
  /** Espeja la cámara: los jugadores se ven como en un espejo. */
  espejar: true,
  /** Tiempo (ms) sin detectar a un jugador antes de considerarlo ausente. */
  presenciaPerdidaMs: 400,
  /** Tiempo (ms) con los dos detectados antes de considerarlos presentes otra vez. */
  presenciaVueltaMs: 600,
  /** Velocidad de cada jugador en modo teclado (px/s). */
  velTeclado: 500,

  // --- Avance --------------------------------------------------------------
  /** Velocidad inicial del scroll (px/s). Cada nivel puede cambiarla con la propiedad velScrollInicial. */
  velScrollInicial: 110,
  /** Aumento de la velocidad del scroll por segundo (px/s²). */
  aceleracion: 3,
  /** Velocidad máxima del scroll (px/s). */
  velScrollMax: 320,

  // --- Daño ----------------------------------------------------------------
  /** Vidas por partida. No se recargan entre niveles. */
  vidasIniciales: 10,
  /** Tiempo (ms) sin recibir daño después de un golpe. */
  invulnerableMs: 1000,
  /** Duración (ms) del tinte rojo al recibir un golpe. */
  flashGolpeMs: 300,
  /** Duración (ms) del temblor de cámara al recibir un golpe. */
  shakeMs: 150,
  /** Intensidad del temblor de cámara. */
  shakeIntensidad: 0.01,

  // --- Monedas -------------------------------------------------------------
  /** Radio de cada moneda (px). */
  radioMoneda: 16,
  /** Puntos por moneda. */
  valorMoneda: 10,
  /** Puntos por romper una roca frágil (0 = no suma, como dice el GDD). */
  puntosRocaRota: 0,

  // --- Estados -------------------------------------------------------------
  /** Duración de la cuenta regresiva (s). */
  cuentaRegresivaS: 3,
  /** Tiempo (ms) que hay que mantener el orbe sobre un botón, o mantenerse cerca, para activarlo. */
  holdMs: 1500,
  /** Duración (ms) de la pantalla entre niveles. */
  transicionNivelMs: 2500,

  // --- Nombre del dúo ------------------------------------------------------
  /** Largo máximo del nombre del dúo. */
  nombreMaxLetras: 8,
  /** Cada cuánto (ms) cae una letra nueva. */
  letrasCadaMs: 600,
  /** Velocidad de caída de las letras (px/s). */
  letrasVelocidad: 160,
  /** Probabilidad de que cada objeto especial (⌫, BORRAR, OK) caiga en lugar de una letra. */
  probEspecial: 0.08,
  /** Pausa (ms) después de atrapar algo, para no atrapar dos cosas seguidas. */
  cooldownAtrapeMs: 400,

  // --- Brillo (bloom) --------------------------------------------------------
  /** Brillo mínimo (0 a 1) a partir del cual algo "brilla". Más alto = brillan menos cosas. */
  bloomUmbral: 0.55,
  /** Qué tan lejos se expande el brillo. */
  bloomRadio: 4,
  /** Cuánto brillo se suma a la imagen (0 = nada, 1 = mucho). */
  bloomIntensidad: 0.4,

  // --- Audio ---------------------------------------------------------------
  /** Volumen general inicial (0 a 1). Después se guarda en Ajustes. */
  volumenGeneral: 0.8,
  /** Volumen de la música (0 a 1), dentro del volumen general. */
  volumenMusica: 0.55,
  /** Volumen de los efectos (0 a 1), dentro del volumen general. */
  volumenEfectos: 0.9,
  /** Tempo de la música (pulsos por minuto). */
  bpm: 118,
  /** Tiempo (ms) entre monedas para que cuenten como racha (cada una suena más aguda). */
  rachaMonedaMs: 1200,

  // --- Depuración ----------------------------------------------------------
  /** Muestra hitboxes, FPS y estado de la entrada. */
  debug: false,
};

export type Config = typeof CONFIG;
