import type * as ToneT from 'tone';
import { CONFIG } from '../config';
import { PASOS_CICLO, capasActivas, golpes, notaMoneda, volumenADb, type Capa, type Modo } from './musica';

// Música y efectos, sintetizados en vivo con Tone.js (no hay archivos de audio).
// - La partitura (acordes, patrones, qué capas suenan) está en musica.ts.
// - Tone.js se carga recién al primer clic o tecla (el navegador exige un gesto para sonar).
//   Hasta entonces, y si algo falla, todos los métodos no hacen nada: el audio nunca traba el juego.
// - Mezcla: música → filtro (se cierra en la pausa) → limitador ← efectos.

type Tone = typeof ToneT;

/** Frecuencia del filtro de la música: abierto y en la pausa ("la música baja y se filtra"). */
const FILTRO_ABIERTO = 18000;
const FILTRO_PAUSA = 450;
/** Ganancia de la música sobre volumenMusica (dB): los instrumentos están mezclados bajos, para dejar lugar. */
const GANANCIA_MUSICA_DB = 10;
/** Cuánto baja la música en la pausa (dB). */
const BAJA_PAUSA_DB = -10;

interface Instrumentos {
  musica: ToneT.Volume;
  efectos: ToneT.Volume;
  filtro: ToneT.Filter;
  bombo: ToneT.MembraneSynth;
  palmas: ToneT.NoiseSynth;
  hats: ToneT.MetalSynth;
  bajo: ToneT.MonoSynth;
  colchon: ToneT.PolySynth;
  arpegio: ToneT.Synth;
  melodia: ToneT.Synth;
  // Efectos de sonido
  bip: ToneT.Synth;
  campana: ToneT.PolySynth<ToneT.FMSynth>;
  acorde: ToneT.PolySynth;
  golpeGrave: ToneT.MembraneSynth;
  ruido: ToneT.NoiseSynth;
  ruidoFiltro: ToneT.Filter;
  metal: ToneT.MetalSynth;
}

export class AudioEngine {
  private T: Tone | null = null;
  private inst: Instrumentos | null = null;
  private cargando: Promise<void> | null = null;
  private modo: Modo = 'silencio';
  private intensidad = 0;
  private paso = 0;
  private volumen = -1;
  private bpm = 0;
  private volumenMusica = -1;
  private volumenEfectos = -1;
  /** Último instante usado por un efecto: cada uno arranca un poco después (Tone rechaza dos notas en el mismo instante). */
  private ultimoEfecto = 0;
  /** Último instante en que tocó cada capa de la música (para no repetir un instante; ver tocarPaso). */
  private ultimoPaso = new Map<Capa, number>();

  /** Arranca el audio. Hay que llamarlo dentro de un clic o una tecla. Se puede llamar varias veces. */
  iniciar() {
    if (this.cargando) return this.cargando;
    let ctx: AudioContext;
    try {
      // El AudioContext se crea y se activa acá mismo, durante el gesto; Tone.js se carga después.
      ctx = new AudioContext({ latencyHint: 'interactive' });
      void ctx.resume();
    } catch (e) {
      console.warn('ORBE: este navegador no tiene Web Audio', e);
      this.cargando = Promise.resolve();
      return this.cargando;
    }
    this.cargando = import('tone')
      .then(async (T) => {
        T.setContext(ctx);
        await T.start();
        await this.prepararCon(T);
      })
      .catch((e) => console.warn('ORBE: no se pudo iniciar el audio', e));
    return this.cargando;
  }

  /**
   * Crea los instrumentos en el contexto actual de Tone y arranca la música.
   * Sirve también para renderizar sin tiempo real (Tone.Offline), por ejemplo para escuchar una muestra.
   */
  async prepararCon(T: Tone) {
    const { instrumentos, listo } = armar(T);
    await listo;
    this.inst = instrumentos;
    this.T = T;
    const transporte = T.getTransport();
    transporte.bpm.value = CONFIG.bpm;
    this.bpm = CONFIG.bpm;
    new T.Loop((tiempo) => this.tocarPaso(tiempo), '16n').start(0);
    transporte.start('+0.1');
    this.aplicarModo();
  }

  /** Lo llama el juego una vez por frame: aplica el volumen de Ajustes y los parámetros de audio del panel. */
  sincronizar(volumenGeneral: number) {
    const T = this.T;
    const inst = this.inst;
    if (!T || !inst) return;
    if (volumenGeneral !== this.volumen) {
      this.volumen = volumenGeneral;
      T.getDestination().volume.rampTo(volumenADb(volumenGeneral), 0.1);
    }
    if (CONFIG.bpm !== this.bpm) {
      this.bpm = CONFIG.bpm;
      T.getTransport().bpm.rampTo(Math.max(40, CONFIG.bpm), 0.5);
    }
    if (CONFIG.volumenMusica !== this.volumenMusica) {
      this.volumenMusica = CONFIG.volumenMusica;
      this.aplicarModo();
    }
    if (CONFIG.volumenEfectos !== this.volumenEfectos) {
      this.volumenEfectos = CONFIG.volumenEfectos;
      inst.efectos.volume.rampTo(volumenADb(CONFIG.volumenEfectos), 0.1);
    }
  }

  /** Momento del juego: cambia qué capas suenan y, en la pausa, baja y filtra la música. */
  cambiarModo(modo: Modo) {
    if (modo === this.modo) return;
    this.modo = modo;
    if (modo !== 'juego' && modo !== 'pausa') this.intensidad = 0;
    this.aplicarModo();
  }

  /** Intensidad del juego (0 a 1): agrega capas a la música. */
  cambiarIntensidad(intensidad: number) {
    this.intensidad = intensidad;
  }

  private aplicarModo() {
    const inst = this.inst;
    if (!inst) return;
    const pausa = this.modo === 'pausa';
    inst.filtro.frequency.rampTo(pausa ? FILTRO_PAUSA : FILTRO_ABIERTO, 0.4);
    inst.musica.volume.rampTo(volumenADb(CONFIG.volumenMusica) + GANANCIA_MUSICA_DB + (pausa ? BAJA_PAUSA_DB : 0), 0.4);
  }

  private tocarPaso(t: number) {
    const inst = this.inst;
    if (!inst) return;
    const capas = capasActivas(this.modo, this.intensidad);
    const g = golpes(this.paso);
    this.paso = (this.paso + 1) % PASOS_CICLO;
    const suena = (c: Capa) => capas.has(c);
    // Si la página se traba, Tone puede pedir dos pasos en el mismo instante y los instrumentos de una
    // voz lo rechazan con un error: esa nota se saltea. Un error en una nota tampoco corta la música.
    const tocar = (capa: Capa, f: () => void) => {
      if (t <= (this.ultimoPaso.get(capa) ?? -1)) return;
      this.ultimoPaso.set(capa, t);
      try {
        f();
      } catch (e) {
        console.warn('ORBE: se salteó una nota', capa, e);
      }
    };

    if (suena('bombo') && g.bombo) tocar('bombo', () => inst.bombo.triggerAttackRelease('A0', '8n', t));
    if (suena('palmas') && g.palmas) tocar('palmas', () => inst.palmas.triggerAttackRelease('16n', t));
    if (suena('hatsRapidos') ? g.hatsRapidos || g.hats : suena('hats') && g.hats) {
      tocar('hats', () => inst.hats.triggerAttackRelease('C6', '32n', t, g.hats ? 0.9 : 0.45));
    }
    if (suena('bajo') && g.bajo) tocar('bajo', () => inst.bajo.triggerAttackRelease(g.bajo!, '16n', t));
    if (suena('colchon') && g.colchon) tocar('colchon', () => inst.colchon.triggerAttackRelease(g.colchon!, '1m', t, 0.5));
    if (suena('arpegio')) tocar('arpegio', () => inst.arpegio.triggerAttackRelease(g.arpegio, '32n', t, 0.55));
    if (suena('melodia') && g.melodia) tocar('melodia', () => inst.melodia.triggerAttackRelease(g.melodia!, '8n', t, 0.7));
  }

  // --- Efectos de sonido ------------------------------------------------------

  /** Bip de la cuenta regresiva (agudo = arranca). */
  bip(agudo = false) {
    this.con((inst, ahora) => inst.bip.triggerAttackRelease(agudo ? 880 : 440, agudo ? '8n' : '16n', ahora));
  }

  /** Moneda: cada una de una racha suena más aguda. */
  moneda(racha: number) {
    this.con((inst, ahora) => inst.campana.triggerAttackRelease(notaMoneda(racha), '16n', ahora, 0.8));
  }

  golpe() {
    this.con((inst, ahora) => {
      inst.golpeGrave.triggerAttackRelease('E1', '8n', ahora);
      inst.ruidoFiltro.frequency.setValueAtTime(900, ahora);
      inst.ruidoFiltro.frequency.exponentialRampToValueAtTime(120, ahora + 0.25);
      inst.ruido.triggerAttackRelease('8n', ahora, 0.9);
    });
  }

  rocaRota() {
    this.con((inst, ahora) => {
      inst.ruidoFiltro.frequency.setValueAtTime(5000, ahora);
      inst.ruidoFiltro.frequency.exponentialRampToValueAtTime(400, ahora + 0.3);
      inst.ruido.triggerAttackRelease('8n', ahora, 0.7);
      inst.metal.triggerAttackRelease('G3', '16n', ahora, 0.6);
    });
  }

  /** Llegada a la meta: arpegio mayor rápido. */
  llegada() {
    this.arpegioRapido(['A4', 'C#5', 'E5', 'A5', 'C#6', 'E6'], 0.06);
  }

  /** Botón activado: acorde corto. */
  boton() {
    this.con((inst, ahora) => inst.acorde.triggerAttackRelease(['E5', 'A5'], '16n', ahora, 0.6));
  }

  /** Confirmación (por ejemplo, zona calibrada). */
  confirmar() {
    this.arpegioRapido(['A4', 'E5', 'A5'], 0.07);
  }

  /** Letra atrapada en el nombre del dúo. */
  letra(tipo: 'letra' | 'borrar' | 'borrarTodo' | 'ok') {
    this.con((inst, ahora) => {
      if (tipo === 'letra') inst.bip.triggerAttackRelease('E6', '32n', ahora);
      else if (tipo === 'ok') inst.acorde.triggerAttackRelease(['A4', 'C#5', 'E5'], '8n', ahora, 0.7);
      else {
        inst.bip.triggerAttackRelease(tipo === 'borrar' ? 'A4' : 'E4', '32n', ahora);
        inst.bip.triggerAttackRelease(tipo === 'borrar' ? 'E4' : 'A3', '16n', ahora + 0.07);
      }
    });
  }

  /** Fin de la partida: fanfarria al ganar, descenso al perder. */
  fin(gano: boolean) {
    if (gano) this.arpegioRapido(['A4', 'C#5', 'E5', 'A5', 'E5', 'A5', 'C#6', 'E6', 'A6'], 0.09);
    else this.arpegioRapido(['A4', 'G4', 'E4', 'C4', 'A3'], 0.16, '8n');
  }

  private arpegioRapido(notas: string[], separacion: number, duracion = '16n') {
    this.con((inst, ahora) => notas.forEach((n, i) => inst.acorde.triggerAttackRelease(n, duracion, ahora + i * separacion, 0.6)));
  }

  /** Corre `f` solo si el audio ya está listo (si no, el sonido simplemente no suena). */
  private con(f: (inst: Instrumentos, ahora: number) => void) {
    if (!this.T || !this.inst) return;
    try {
      // El reloj es el del propio bus de efectos (no el global de Tone): así también anda al renderizar offline.
      this.ultimoEfecto = Math.max(this.inst.efectos.now() + 0.01, this.ultimoEfecto + 0.002);
      f(this.inst, this.ultimoEfecto);
    } catch (e) {
      console.warn('ORBE: falló un sonido', e);
    }
  }
}

/** Crea los instrumentos y la mezcla. `listo` se cumple cuando la reverb terminó de generarse. */
function armar(T: Tone): { instrumentos: Instrumentos; listo: Promise<unknown> } {
  const limitador = new T.Limiter(-1).toDestination();
  const filtro = new T.Filter(FILTRO_ABIERTO, 'lowpass').connect(limitador);
  const musica = new T.Volume(volumenADb(CONFIG.volumenMusica) + GANANCIA_MUSICA_DB).connect(filtro);
  const efectos = new T.Volume(volumenADb(CONFIG.volumenEfectos)).connect(limitador);

  const reverb = new T.Reverb({ decay: 3.5, wet: 0.35 }).connect(musica);
  const delay = new T.PingPongDelay({ delayTime: '8n.', feedback: 0.35, wet: 0.3 }).connect(musica);
  const chorus = new T.Chorus({ frequency: 0.6, delayTime: 3.5, depth: 0.7, wet: 0.5 }).start().connect(reverb);

  const bombo = new T.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.1 },
    volume: -6,
  }).connect(musica);

  const palmasFiltro = new T.Filter(1400, 'highpass').connect(reverb);
  const palmas = new T.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.16, sustain: 0 },
    volume: -14,
  }).connect(palmasFiltro);

  const hats = new T.MetalSynth({
    envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 7000,
    octaves: 1.5,
    volume: -28,
  }).connect(musica);

  const bajo = new T.MonoSynth({
    oscillator: { type: 'sawtooth' },
    filter: { Q: 2, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.005, decay: 0.15, sustain: 0.3, release: 0.08 },
    filterEnvelope: { attack: 0.005, decay: 0.12, sustain: 0.2, release: 0.1, baseFrequency: 120, octaves: 3.2 },
    volume: -10,
  }).connect(musica);

  const colchon = new T.PolySynth(T.Synth, {
    oscillator: { type: 'fatsawtooth', count: 3, spread: 30 },
    envelope: { attack: 0.6, decay: 0.4, sustain: 0.7, release: 1.6 },
    volume: -17,
  }).connect(chorus);

  const arpegio = new T.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.002, decay: 0.09, sustain: 0.05, release: 0.08 },
    volume: -19,
  }).connect(delay);

  const melodia = new T.Synth({
    oscillator: { type: 'fatsawtooth', count: 2, spread: 12 },
    envelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.4 },
    volume: -15,
  }).connect(delay);
  melodia.connect(reverb);

  const bip = new T.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.002, decay: 0.08, sustain: 0.2, release: 0.05 },
    volume: -14,
  }).connect(efectos);

  const campana = new T.PolySynth(T.FMSynth, {
    harmonicity: 3,
    modulationIndex: 8,
    envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.2 },
    modulationEnvelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
    volume: -12,
  }).connect(efectos);

  const acorde = new T.PolySynth(T.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.2, release: 0.3 },
    volume: -10,
  }).connect(efectos);

  const golpeGrave = new T.MembraneSynth({ pitchDecay: 0.08, octaves: 4, volume: -4 }).connect(efectos);
  const distorsion = new T.Distortion(0.6).connect(efectos);
  const ruidoFiltro = new T.Filter(900, 'lowpass').connect(distorsion);
  const ruido = new T.NoiseSynth({
    noise: { type: 'brown' },
    envelope: { attack: 0.001, decay: 0.25, sustain: 0 },
    volume: -6,
  }).connect(ruidoFiltro);
  const metal = new T.MetalSynth({
    envelope: { attack: 0.001, decay: 0.2, release: 0.1 },
    harmonicity: 3.1,
    modulationIndex: 16,
    resonance: 2500,
    volume: -22,
  }).connect(efectos);

  return {
    instrumentos: { musica, efectos, filtro, bombo, palmas, hats, bajo, colchon, arpegio, melodia, bip, campana, acorde, golpeGrave, ruido, ruidoFiltro, metal },
    listo: reverb.ready,
  };
}

/** Único motor de audio del juego. */
export const audio = new AudioEngine();
