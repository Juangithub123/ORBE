import type * as Phaser from 'phaser';
import { CONFIG } from '../config';
import type { InputManager } from '../input/InputManager';
import { ORIGINALES, cambios, guardarParametros, setParametro, type ClaveParametro } from '../storage/parametros';
import {
  CANAL,
  CONTROL_VIVO_MS,
  ESTADO_CADA_MS,
  IMAGEN_CADA,
  filtrarAjustes,
  limpiarNombre,
  type EstadoJuego,
  type MensajeControl,
} from './protocolo';

// Lado del juego de la ventana de control: escucha lo que manda el operador (parámetros, ajustes, nombre)
// y, mientras la ventana de control esté abierta, le manda el estado del juego unas 10 veces por segundo
// (con la imagen chica de la cámara si la pide). Si no hay ventana de control no manda nada.
// El nombre que escribe el operador queda en el registry ('nombreControl'): la pantalla del nombre lo lee.

/** Lo que escribió el operador para el nombre. `version` cambia con cada mensaje, para notar uno nuevo. */
export interface NombreControl {
  nombre: string;
  confirmar: boolean;
  version: number;
}

/** Ancho de la imagen que se manda (el alto sale de la proporción de la cámara). */
const ANCHO_IMAGEN = 320;

export class PuenteJuego {
  private canal: BroadcastChannel;
  private ultimoHola = -Infinity;
  private quiereImagen = false;
  private cuenta = 0;
  private lienzo: HTMLCanvasElement | null = null;
  private version = 0;

  constructor(
    private game: Phaser.Game,
    /** Avisa que cambió un parámetro (para que el panel ⚙ de esta ventana lo muestre). */
    private alCambiarParametros: () => void,
  ) {
    this.canal = new BroadcastChannel(CANAL);
    this.canal.onmessage = (e: MessageEvent<MensajeControl>) => this.recibir(e.data);
    setInterval(() => this.enviarEstado(), ESTADO_CADA_MS);
  }

  private get input() {
    return this.game.registry.get('input') as InputManager | undefined;
  }

  private recibir(m: MensajeControl) {
    if (!m || typeof m !== 'object') return;
    const input = this.input;
    switch (m.tipo) {
      case 'hola':
        this.ultimoHola = performance.now();
        this.quiereImagen = Boolean(m.imagen);
        this.enviarEstado();
        break;
      case 'parametro': {
        const clave = m.clave as ClaveParametro;
        if (!(clave in ORIGINALES) || typeof m.valor !== typeof ORIGINALES[clave]) return;
        if (typeof m.valor === 'number' && !Number.isFinite(m.valor)) return;
        setParametro(clave, m.valor);
        guardarParametros();
        this.alCambiarParametros();
        break;
      }
      case 'restablecerParametros':
        for (const clave of Object.keys(ORIGINALES) as ClaveParametro[]) setParametro(clave, ORIGINALES[clave]);
        guardarParametros();
        this.alCambiarParametros();
        break;
      case 'ajustes': {
        if (!input || !m.cambios || typeof m.cambios !== 'object') return;
        const cambiosOk = filtrarAjustes(m.cambios);
        void input.aplicarAjustes(cambiosOk);
        // La vista del trackeo sobre el juego se aplica al momento si se está jugando.
        if (cambiosOk.camaraEnJuego && this.game.scene.isActive('Game')) input.preview.mostrar(cambiosOk.camaraEnJuego);
        break;
      }
      case 'nombre': {
        const control: NombreControl = {
          nombre: limpiarNombre(String(m.nombre ?? ''), CONFIG.nombreMaxLetras),
          confirmar: Boolean(m.confirmar),
          version: ++this.version,
        };
        this.game.registry.set('nombreControl', control);
        break;
      }
      case 'reintentar':
        if (input && input.config.modoEntrada !== 'teclado') void input.start();
        break;
    }
  }

  private enviarEstado() {
    if (performance.now() - this.ultimoHola > CONTROL_VIVO_MS) return;
    const input = this.input;
    if (!input) return;
    const activas = this.game.scene.getScenes(true);
    const escena = activas[activas.length - 1]?.sys.settings.key ?? '';
    const pantallaNombre = activas.find((s) => s.sys.settings.key === 'NameEntry') as unknown as { nombreActual?: string } | undefined;
    const vista = input.vista;
    const estado: EstadoJuego = {
      tipo: 'estado',
      escena,
      modo: input.modo,
      estadoEntrada: input.estado,
      mensajeEntrada: input.estado === 'error' ? input.error : input.estado === 'cargando' ? input.progreso : '',
      personas: input.countCrudo,
      ajustes: { ...input.config },
      parametros: cambios() as Record<string, number | boolean>,
      nombre: pantallaNombre?.nombreActual ?? null,
      maxLetras: CONFIG.nombreMaxLetras,
      vista: vista
        ? {
            puntos: vista.puntos,
            conexiones: vista.conexiones,
            jugadores: vista.jugadores,
            aspecto: vista.video?.videoWidth ? vista.video.videoWidth / vista.video.videoHeight : 4 / 3,
          }
        : null,
    };
    this.cuenta++;
    if (this.quiereImagen && vista?.video && this.cuenta % IMAGEN_CADA === 0) estado.imagen = this.imagen(vista.video);
    try {
      this.canal.postMessage(estado);
    } catch (e) {
      console.warn('ORBE: no se pudo mandar el estado a la ventana de control', e);
    }
  }

  /** Imagen chica de la cámara, sin espejar (la ventana de control la espeja si corresponde). */
  private imagen(video: HTMLVideoElement) {
    if (video.readyState < 2 || !video.videoWidth) return undefined;
    this.lienzo ??= document.createElement('canvas');
    const alto = Math.round((ANCHO_IMAGEN * video.videoHeight) / video.videoWidth);
    if (this.lienzo.width !== ANCHO_IMAGEN || this.lienzo.height !== alto) Object.assign(this.lienzo, { width: ANCHO_IMAGEN, height: alto });
    const ctx = this.lienzo.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(video, 0, 0, ANCHO_IMAGEN, alto);
    return this.lienzo.toDataURL('image/jpeg', 0.6);
  }
}
