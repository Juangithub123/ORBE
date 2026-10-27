import type * as ToneT from 'tone';
import { CONFIG } from '../config';
import {
  PASOS_CICLO,
  bpmPara,
  capasActivas,
  corteAcid,
  golpes,
  notaMoneda,
  saturacionBombo,
  volumenADb,
  type Capa,
  type Modo,
} from './musica';

// Música y efectos, sintetizados en vivo con Tone.js (no hay archivos de audio). Estilo tecno industrial.
// - La partitura (raíces, patrones, qué capas suenan en cada nivel, tempo) está en musica.ts.
// - El juego informa el progreso de la partida (cambiarProgreso): con él suben el tempo y la intensidad.
// - Tone.js se carga recién al primer clic o tecla (el navegador exige un gesto para sonar).
//   Hasta entonces, y si algo falla, todos los métodos no hacen nada: el audio nunca traba el juego.
// - Mezcla: música → filtro (se cierra en la pausa) → limitador ← efectos.

type Tone = typeof ToneT;

/** Frecuencia del filtro de la música: abierto y en la pausa ("la música baja y se filtra"). */
const FILTRO_ABIERTO = 18000;
const FILTRO_PAUSA = 400;
/** Ganancia de la música sobre volumenMusica (dB): los instrumentos están mezclados bajos, para dejar lugar. */
const GANANCIA_MUSICA_DB = 10;
/** Cuánto baja la música en la pausa (dB). */
const BAJA_PAUSA_DB = -10;
/** Cambios de tempo menores a esto no se aplican (evita rampas continuas por cambios mínimos). */
const PASO_BPM = 0.5;

interface Instrumentos {
  musica: ToneT.Volume;
  efectos: ToneT.Volume;
  filtro: ToneT.Filter;
  // Música
  bombo: ToneT.MembraneSynth;
  saturacion: ToneT.Distortion;
  rumble: ToneT.MonoSynth;
  hats: ToneT.NoiseSynth;
  palmas: ToneT.NoiseSynth;
  metal: ToneT.MetalSynth;
  drone: ToneT.PolySynth<ToneT.FMSynth>;
  acid: ToneT.MonoSynth;
  stab: ToneT.PolySynth;
  ruido: ToneT.NoiseSynth;
  ruidoFiltro: ToneT.Filter;
  // Efectos de sonido
  ping: ToneT.FMSynth;
  clic: ToneT.MembraneSynth;
  stabFx: ToneT.PolySynth;
  impacto: ToneT.MembraneSynth;
  rafaga: ToneT.NoiseSynth;
  rafagaFiltro: ToneT.Filter;
  chapa: ToneT.MetalSynth;
  zumbido: ToneT.Synth;
}

export class AudioEngine {
  private T: Tone | null = null;
  private inst: Instrumentos | null = null;
  private cargando: Promise<void> | null = null;
  private modo: Modo = 'silencio';
  /** Progreso global de la partida (0 a 1): sube el tempo y suma capas. */
  private progreso = 0;
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
    this.bpm = this.bpmObjetivo();
    transporte.bpm.value = this.bpm;
    new T.Loop((tiempo) => this.tocarPaso(tiempo), '16n').start(0);
    transporte.start('+0.1');
    this.aplicarModo();
  }

  /** Lo llama el juego una vez por frame: volumen de Ajustes, tempo y parámetros de audio del panel. */
  sincronizar(volumenGeneral: number) {
    const T = this.T;
    const inst = this.inst;
    if (!T || !inst) return;
    if (volumenGeneral !== this.volumen) {
      this.volumen = volumenGeneral;
      T.getDestination().volume.rampTo(volumenADb(volumenGeneral), 0.1);
    }
    const bpm = this.bpmObjetivo();
    if (Math.abs(bpm - this.bpm) >= PASO_BPM) {
      this.bpm = bpm;
      T.getTransport().bpm.rampTo(Math.max(40, bpm), 1);
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
    this.aplicarModo();
  }

  /** Progreso global de la partida (0 a 1, ver progresoGlobal en musica.ts): sube el tempo y la intensidad. */
  cambiarProgreso(progreso: number) {
    this.progreso = progreso;
    const inst = this.inst;
    if (!inst) return;
    inst.saturacion.wet.value = saturacionBombo(progreso) * 0.7;
  }

  private bpmObjetivo() {
    return bpmPara(this.modo, this.progreso, { menu: CONFIG.bpmMenu, inicial: CONFIG.bpmInicial, final: CONFIG.bpmFinal });
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
    const capas = capasActivas(this.modo, this.progreso);
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

    if (suena('bombo') && g.bombo) tocar('bombo', () => inst.bombo.triggerAttackRelease('E1', '8n', t));
    if (suena('rumble') && g.rumble) tocar('rumble', () => inst.rumble.triggerAttackRelease(g.rumble!, '32n', t, 0.8));
    if (suena('hats16') ? g.hat16 : suena('hats') && g.hats) {
      tocar('hats', () => inst.hats.triggerAttackRelease('32n', t, g.hatAcento ? 0.9 : 0.35));
    }
    if (suena('palmas') && g.palmas) tocar('palmas', () => inst.palmas.triggerAttackRelease('16n', t));
    if (suena('metal') && g.metal > 0) tocar('metal', () => inst.metal.triggerAttackRelease('C3', '16n', t, g.metal));
    if (suena('drone') && g.drone) tocar('drone', () => inst.drone.triggerAttackRelease(g.drone!, '1m', t, 0.5));
    if (suena('acid') && g.acid) {
      tocar('acid', () => {
        inst.acid.filterEnvelope.baseFrequency = corteAcid(this.progreso) * (g.acidAcento ? 1.6 : 1);
        inst.acid.triggerAttackRelease(g.acid!, '16n', t, g.acidAcento ? 1 : 0.6);
      });
    }
    if (suena('stab') && g.stab) tocar('stab', () => inst.stab.triggerAttackRelease(g.stab!, '32n', t, 0.7));
    if (suena('ruido') && g.ruido) {
      tocar('ruido', () => {
        // Barrido de ruido de un compás, que abre el filtro hasta el ciclo siguiente.
        const compas = (60 / Math.max(40, this.bpm)) * 4;
        inst.ruidoFiltro.frequency.setValueAtTime(300, t);
        inst.ruidoFiltro.frequency.exponentialRampToValueAtTime(7000, t + compas);
        inst.ruido.triggerAttackRelease(compas, t, 0.6);
      });
    }
  }

  // --- Efectos de sonido ------------------------------------------------------

  /** Bip de la cuenta regresiva: ping metálico; el de arranque, un golpe con stab. */
  bip(agudo = false) {
    this.con((inst, ahora) => {
      if (!agudo) return inst.ping.triggerAttackRelease('E5', '16n', ahora, 0.8);
      inst.impacto.triggerAttackRelease('E1', '8n', ahora);
      inst.stabFx.triggerAttackRelease(['E4', 'B4', 'E5'], '16n', ahora, 0.8);
    });
  }

  /** Moneda: ping de metal; cada una de una racha suena más aguda. */
  moneda(racha: number) {
    this.con((inst, ahora) => inst.ping.triggerAttackRelease(notaMoneda(racha), '32n', ahora, 0.9));
  }

  /** Golpe: impacto grave saturado con ráfaga de ruido. */
  golpe() {
    this.con((inst, ahora) => {
      inst.impacto.triggerAttackRelease('A0', '4n', ahora);
      inst.rafagaFiltro.frequency.setValueAtTime(2500, ahora);
      inst.rafagaFiltro.frequency.exponentialRampToValueAtTime(150, ahora + 0.35);
      inst.rafaga.triggerAttackRelease('8n', ahora, 1);
    });
  }

  /** Roca rota: chapa y vidrio, con ruido que baja. */
  rocaRota() {
    this.con((inst, ahora) => {
      inst.chapa.triggerAttackRelease('A3', '8n', ahora, 0.9);
      inst.rafagaFiltro.frequency.setValueAtTime(9000, ahora);
      inst.rafagaFiltro.frequency.exponentialRampToValueAtTime(600, ahora + 0.3);
      inst.rafaga.triggerAttackRelease('16n', ahora, 0.7);
    });
  }

  /** Llegada a la meta: subida de ruido y stab. */
  llegada() {
    this.con((inst, ahora) => {
      inst.rafagaFiltro.frequency.setValueAtTime(300, ahora);
      inst.rafagaFiltro.frequency.exponentialRampToValueAtTime(9000, ahora + 0.6);
      inst.rafaga.triggerAttackRelease(0.6, ahora, 0.6);
      inst.impacto.triggerAttackRelease('E1', '4n', ahora + 0.6);
      inst.stabFx.triggerAttackRelease(['E4', 'B4', 'E5', 'G5'], '8n', ahora + 0.6, 0.9);
    });
  }

  /** Botón activado: clic mecánico con un tic metálico. */
  boton() {
    this.con((inst, ahora) => {
      inst.clic.triggerAttackRelease('G3', '32n', ahora);
      inst.ping.triggerAttackRelease('B5', '64n', ahora + 0.03, 0.5);
    });
  }

  /** Confirmación (por ejemplo, zona calibrada): dos pings. */
  confirmar() {
    this.con((inst, ahora) => {
      inst.ping.triggerAttackRelease('E5', '32n', ahora, 0.8);
      inst.ping.triggerAttackRelease('B5', '32n', ahora + 0.09, 0.8);
    });
  }

  /** Letra atrapada en el nombre del dúo. */
  letra(tipo: 'letra' | 'borrar' | 'borrarTodo' | 'ok') {
    this.con((inst, ahora) => {
      if (tipo === 'letra') {
        inst.clic.triggerAttackRelease('C4', '32n', ahora);
        inst.ping.triggerAttackRelease('E6', '64n', ahora, 0.5);
      } else if (tipo === 'ok') {
        inst.impacto.triggerAttackRelease('E1', '8n', ahora);
        inst.stabFx.triggerAttackRelease(['E4', 'B4', 'E5'], '8n', ahora, 0.9);
      } else {
        // Zumbido que baja de tono (BORRAR baja más y más lento).
        const largo = tipo === 'borrar' ? 0.15 : 0.4;
        inst.zumbido.triggerAttack(tipo === 'borrar' ? 'E4' : 'E5', ahora, 0.7);
        inst.zumbido.frequency.exponentialRampToValueAtTime(tipo === 'borrar' ? 160 : 60, ahora + largo);
        inst.zumbido.triggerRelease(ahora + largo);
      }
    });
  }

  /** Fin de la partida: stabs que suben al ganar; "apagado" que baja de tono al perder. */
  fin(gano: boolean) {
    this.con((inst, ahora) => {
      if (gano) {
        const acordes = [['E3', 'B3', 'E4'], ['G3', 'D4', 'G4'], ['A3', 'E4', 'A4'], ['E4', 'B4', 'E5']];
        acordes.forEach((a, i) => {
          inst.impacto.triggerAttackRelease('E1', '8n', ahora + i * 0.22);
          inst.stabFx.triggerAttackRelease(a, i === acordes.length - 1 ? '2n' : '16n', ahora + i * 0.22, 0.9);
        });
        inst.chapa.triggerAttackRelease('E4', '2n', ahora + 0.66, 0.6);
      } else {
        inst.zumbido.triggerAttack('E3', ahora, 0.9);
        inst.zumbido.frequency.exponentialRampToValueAtTime(30, ahora + 1.4);
        inst.zumbido.triggerRelease(ahora + 1.4);
        inst.impacto.triggerAttackRelease('A0', '2n', ahora + 1.3);
      }
    });
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

/** Crea los instrumentos y la mezcla. `listo` se cumple cuando las reverbs terminaron de generarse. */
function armar(T: Tone): { instrumentos: Instrumentos; listo: Promise<unknown> } {
  const limitador = new T.Limiter(-1).toDestination();
  const filtro = new T.Filter(FILTRO_ABIERTO, 'lowpass').connect(limitador);
  const musica = new T.Volume(volumenADb(CONFIG.volumenMusica) + GANANCIA_MUSICA_DB).connect(filtro);
  const efectos = new T.Volume(volumenADb(CONFIG.volumenEfectos)).connect(limitador);

  // Espacios: una sala grande y oscura (drone, ruido) y una corta y metálica (claps, stabs).
  const salaGrande = new T.Reverb({ decay: 6, wet: 0.45 }).connect(musica);
  const salaCorta = new T.Reverb({ decay: 1.4, wet: 0.3 }).connect(musica);
  const eco = new T.FeedbackDelay({ delayTime: '8n.', feedback: 0.35, wet: 0.25 }).connect(musica);

  // Bombo: grave y largo; en el nivel 3 pasa por una saturación (wet según el progreso).
  const saturacion = new T.Distortion({ distortion: 0.8, wet: 0 }).connect(musica);
  const bombo = new T.MembraneSynth({
    pitchDecay: 0.06,
    octaves: 7,
    envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.1 },
    volume: -4,
  }).connect(saturacion);

  // Rolling bass: sierra filtrada, corta, entre los bombos.
  const rumble = new T.MonoSynth({
    oscillator: { type: 'sawtooth' },
    filter: { Q: 1, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.05 },
    filterEnvelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.05, baseFrequency: 90, octaves: 2.2 },
    volume: -8,
  }).connect(musica);

  const hatsFiltro = new T.Filter(8000, 'highpass').connect(musica);
  const hats = new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 }, volume: -20 }).connect(hatsFiltro);

  // Clap industrial: ruido en banda media, saturado, con sala corta.
  const palmasSat = new T.Distortion(0.5).connect(salaCorta);
  const palmasFiltro = new T.Filter(1600, 'bandpass').connect(palmasSat);
  const palmas = new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.14, sustain: 0 }, volume: -10 }).connect(palmasFiltro);

  const metal = new T.MetalSynth({
    envelope: { attack: 0.001, decay: 0.12, release: 0.05 },
    harmonicity: 8.5,
    modulationIndex: 20,
    resonance: 3200,
    octaves: 1.2,
    volume: -26,
  }).connect(eco);

  // Drone oscuro (FM grave, ataque lento) en la sala grande.
  const drone = new T.PolySynth(T.FMSynth, {
    harmonicity: 0.5,
    modulationIndex: 4,
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 1.2, decay: 0.5, sustain: 0.8, release: 2.5 },
    modulationEnvelope: { attack: 2, decay: 1, sustain: 0.6, release: 2 },
    volume: -24,
  }).connect(salaGrande);

  // Línea acid: sierra con filtro muy resonante (la apertura sube con el progreso).
  const acidSat = new T.Distortion(0.35).connect(eco);
  const acid = new T.MonoSynth({
    oscillator: { type: 'sawtooth' },
    filter: { Q: 14, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.002, decay: 0.15, sustain: 0.2, release: 0.05 },
    filterEnvelope: { attack: 0.002, decay: 0.14, sustain: 0.1, release: 0.05, baseFrequency: 250, octaves: 3 },
    volume: -16,
  }).connect(acidSat);

  const stabSat = new T.Distortion(0.6).connect(salaCorta);
  const stab = new T.PolySynth(T.Synth, {
    oscillator: { type: 'square' },
    envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.08 },
    volume: -20,
  }).connect(stabSat);

  const ruidoFiltro = new T.Filter({ frequency: 300, type: 'bandpass', Q: 2 }).connect(salaGrande);
  const ruido = new T.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 1.5, decay: 0.1, sustain: 1, release: 0.3 }, volume: -18 }).connect(ruidoFiltro);

  // --- Efectos --------------------------------------------------------------
  const ecoFx = new T.FeedbackDelay({ delayTime: 0.09, feedback: 0.25, wet: 0.2 }).connect(efectos);
  const ping = new T.FMSynth({
    harmonicity: 5.07,
    modulationIndex: 18,
    envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.08 },
    modulationEnvelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
    volume: -12,
  }).connect(ecoFx);

  const clic = new T.MembraneSynth({ pitchDecay: 0.01, octaves: 3, envelope: { attack: 0.001, decay: 0.05, sustain: 0 }, volume: -10 }).connect(efectos);

  const fxSat = new T.Distortion(0.7).connect(efectos);
  const stabFx = new T.PolySynth(T.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.002, decay: 0.2, sustain: 0.1, release: 0.3 },
    volume: -16,
  }).connect(fxSat);

  const impacto = new T.MembraneSynth({
    pitchDecay: 0.1,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.2 },
    volume: -4,
  }).connect(fxSat);

  const rafagaFiltro = new T.Filter(2500, 'lowpass').connect(fxSat);
  const rafaga = new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 0.3, sustain: 0.2, release: 0.15 }, volume: -12 }).connect(rafagaFiltro);

  const chapa = new T.MetalSynth({
    envelope: { attack: 0.001, decay: 0.5, release: 0.3 },
    harmonicity: 3.7,
    modulationIndex: 28,
    resonance: 2200,
    octaves: 2,
    volume: -18,
  }).connect(ecoFx);

  const zumbido = new T.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.8, release: 0.15 }, volume: -16 }).connect(fxSat);

  return {
    instrumentos: {
      musica, efectos, filtro,
      bombo, saturacion, rumble, hats, palmas, metal, drone, acid, stab, ruido, ruidoFiltro,
      ping, clic, stabFx, impacto, rafaga, rafagaFiltro, chapa, zumbido,
    },
    listo: Promise.all([salaGrande.ready, salaCorta.ready]),
  };
}

/** Único motor de audio del juego. */
export const audio = new AudioEngine();
