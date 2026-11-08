import { CONFIG } from '../config';
import type { ModoEntrada } from '../input/PlayerInput';
import type { PuntoKinect } from '../input/kinect';
import type { ModoNombre } from '../game/nombre';
import { NOMBRE_CAMARA, NOMBRE_MODO, NOMBRE_MODO_NOMBRE, NOMBRE_PUNTO_KINECT } from '../scenes/shared';
import { cargarParametros } from '../storage/parametros';
import { AJUSTES_POR_DEFECTO, type Ajustes, type CamaraEnJuego, type Zona } from '../storage/settings';
import { PanelParametros } from '../ui/PanelParametros';
import { FUENTE } from '../ui/text';
import { CANAL, agarreEn, arrastrarZona, claveZona, limpiarNombre, type Agarre, type EstadoJuego, type MensajeControl } from './protocolo';

// Ventana de control para el operador (la misma página con ?control): se abre con F4 o desde el panel ⚙ y
// se usa en la pantalla de la computadora mientras el juego va en el proyector, sin tocar la ventana del juego.
// Desde acá: entrada y detección (prender/apagar el trackeo, verlo o no sobre el juego), la zona de juego
// (se arrastra sobre la imagen de la cámara), el nombre del dúo, el volumen y todos los parámetros de config.ts.
// Todo se manda al juego por el canal de protocolo.ts; el juego aplica y guarda, y devuelve su estado.

const ESCENAS: Record<string, string> = {
  Boot: 'cargando',
  Start: 'inicio',
  Menu: 'menú',
  Settings: 'ajustes',
  Calibration: 'calibración',
  NameEntry: 'nombre del dúo',
  Game: 'jugando',
  Pause: 'pausa (falta alguien)',
  PauseMenu: 'menú de pausa',
  LevelTransition: 'entre niveles',
  Result: 'resultado',
  Leaderboard: 'ranking',
};

const MODOS: ModoEntrada[] = ['pose', 'manos', 'kinect', 'teclado'];
/** Sin estado del juego en este tiempo, se avisa que no hay conexión (con la ventana del juego minimizada,
 * el navegador espacia sus mensajes, así que hay margen). */
const SIN_JUEGO_MS = 4000;
/** Cada cuánto se saluda al juego (si no saluda, el juego no manda nada). */
const HOLA_MS = 1000;
/** Mientras se arrastra la zona, cada cuánto se manda al juego. */
const ZONA_CADA_MS = 50;
/** Después de soltar, se sigue mostrando la zona local hasta que el juego devuelva la nueva. */
const ESPERA_ZONA_MS = 600;
/** Tolerancia (fracción de la imagen) para agarrar un borde de la zona. */
const TOLERANCIA_BORDE = 0.025;
const CLAVE_PREFERENCIAS = 'orbe.control';

const ESTILO = `
body.orbe-control { margin: 0; overflow: auto; background: #0b0b0b; color: #fff; font: 14px ${FUENTE}; }
body.orbe-control #app { display: none; }
.orbe-ctl { display: grid; grid-template-columns: minmax(0, 560px) minmax(0, 1fr); gap: 24px; padding: 16px; }
@media (max-width: 900px) { .orbe-ctl { grid-template-columns: minmax(0, 1fr); } }
.orbe-ctl h1 { margin: 0; font-size: 22px; }
.orbe-ctl h2 { margin: 22px 0 8px; font-size: 13px; color: #9a9a9a; text-transform: uppercase; letter-spacing: .05em; }
.orbe-ctl .estado { margin: 6px 0 0; color: #9a9a9a; }
.orbe-ctl .estado b { color: #fff; }
.orbe-ctl .conexion { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; margin-left: 8px; }
.orbe-ctl .conexion.si { background: #0f3d26; color: #4dffa6; }
.orbe-ctl .conexion.no { background: #4a1a1a; color: #ff8080; }
.orbe-ctl .c-fila { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 8px 0; }
.orbe-ctl label { color: #ccc; }
.orbe-ctl select, .orbe-ctl input[type=text] { font: inherit; color: #fff; background: #151515;
  border: 1px solid rgba(255,255,255,.35); border-radius: 6px; padding: 5px 8px; }
.orbe-ctl input[type=text] { font-size: 22px; letter-spacing: .1em; text-transform: uppercase; width: 220px; }
.orbe-ctl button { font: inherit; color: #fff; background: #222; border: 1px solid rgba(255,255,255,.35);
  border-radius: 6px; padding: 6px 12px; cursor: pointer; }
.orbe-ctl button:hover { background: #333; }
.orbe-ctl button.principal { background: #0f3d26; border-color: #4dffa6; }
.orbe-ctl .nota { color: #9a9a9a; margin: 4px 0; font-size: 13px; }
.orbe-ctl canvas { display: block; width: 100%; background: #000; border: 1px solid rgba(255,255,255,.25);
  border-radius: 6px; touch-action: none; }
.orbe-ctl [hidden] { display: none !important; }
.orbe-ctl .desconectado { opacity: .45; }
.orbe-ctl .parametros { max-height: calc(100vh - 32px); overflow-y: auto; position: sticky; top: 16px; }
`;

interface Preferencias {
  imagen: boolean;
  /** Última entrada con sensor, para volver a ella al prender la detección. */
  ultimoSensor: ModoEntrada;
}

export function iniciarVentanaControl() {
  new VentanaControl();
}

class VentanaControl {
  private canal = new BroadcastChannel(CANAL);
  private estado: EstadoJuego | null = null;
  private ultimoEstado = -Infinity;
  private preferencias: Preferencias;
  private imagen = new Image();
  private hayImagen = false;
  private panel: PanelParametros;
  private ultimosParametros = '';

  // Arrastre de la zona sobre el lienzo.
  private arrastre: { agarre: Agarre; inicio: Zona; x: number; y: number } | null = null;
  private zonaLocal: Zona | null = null;
  private zonaLocalHasta = 0;
  private ultimoEnvioZona = 0;
  private dibujoPendiente = false;

  private el: {
    conexion: HTMLElement;
    resumen: HTMLElement;
    controles: HTMLElement;
    entrada: HTMLSelectElement;
    reintentar: HTMLButtonElement;
    deteccion: HTMLInputElement;
    trackeo: HTMLSelectElement;
    espejar: HTMLInputElement;
    filaPunto: HTMLElement;
    punto: HTMLSelectElement;
    mensajeEntrada: HTMLElement;
    lienzo: HTMLCanvasElement;
    verImagen: HTMLInputElement;
    zonaTexto: HTMLElement;
    sinZona: HTMLElement;
    modoNombre: HTMLSelectElement;
    nombre: HTMLInputElement;
    enPantalla: HTMLElement;
    volumen: HTMLInputElement;
    volumenTexto: HTMLElement;
  };

  constructor() {
    cargarParametros();
    this.preferencias = leerPreferencias();
    document.title = 'ORBE · Control';
    document.body.classList.add('orbe-control');
    const estilo = document.createElement('style');
    estilo.textContent = ESTILO;
    document.head.appendChild(estilo);

    const raiz = document.createElement('div');
    raiz.className = 'orbe-ctl';
    raiz.innerHTML = `
      <div>
        <h1>ORBE · Control <span class="conexion no">sin conexión</span></h1>
        <p class="estado" data-id="resumen">Esperando el juego… (tiene que estar abierto en esta computadora)</p>
        <div data-id="controles" class="desconectado">
          <h2>Entrada y trackeo</h2>
          <div class="c-fila">
            <label><input type="checkbox" data-id="deteccion"> Detección (trackeo) prendida</label>
            <button data-id="reintentar" hidden>Reintentar</button>
          </div>
          <div class="c-fila"><label>Entrada</label><select data-id="entrada">${opciones(MODOS.map((m) => [m, NOMBRE_MODO[m]]))}</select></div>
          <div class="c-fila" data-id="filaPunto"><label>Punto de cada jugador</label><select data-id="punto"></select></div>
          <div class="c-fila">
            <label>Trackeo sobre el juego</label>
            <select data-id="trackeo">${opciones((['superpuesta', 'miniatura', 'no'] as CamaraEnJuego[]).map((c) => [c, NOMBRE_CAMARA[c]]))}</select>
            <label><input type="checkbox" data-id="espejar"> Espejar</label>
          </div>
          <p class="nota" data-id="mensajeEntrada"></p>

          <h2>Área de juego</h2>
          <p class="nota">Arrastrá el rectángulo (o sus bordes y esquinas): lo que queda adentro ocupa toda la pantalla del juego.
            Se aplica al instante.</p>
          <canvas data-id="lienzo" width="560" height="420"></canvas>
          <p class="nota" data-id="sinZona" hidden>Con el teclado no hay zona de juego: elegí una entrada con cámara o Kinect.</p>
          <div class="c-fila">
            <span data-id="zonaTexto" class="nota"></span>
            <button data-accion="zonaToda">Toda la imagen</button>
            <button data-accion="zonaDefecto">Restablecer</button>
            <label><input type="checkbox" data-id="verImagen"> Ver imagen de la cámara</label>
          </div>

          <h2>Nombre del dúo</h2>
          <div class="c-fila"><label>Forma de elegirlo en el juego</label>
            <select data-id="modoNombre">${opciones(Object.entries(NOMBRE_MODO_NOMBRE))}</select></div>
          <div class="c-fila">
            <input type="text" data-id="nombre" placeholder="NOMBRE" autocomplete="off" spellcheck="false">
            <button class="principal" data-accion="confirmarNombre">Confirmar y jugar</button>
            <button data-accion="borrarNombre">Borrar</button>
          </div>
          <p class="nota" data-id="enPantalla"></p>

          <h2>Sonido</h2>
          <div class="c-fila"><label>Volumen</label><input type="range" min="0" max="1" step="0.05" data-id="volumen"><span data-id="volumenTexto"></span></div>
        </div>
      </div>
      <div class="parametros" data-id="parametros"></div>`;
    document.body.appendChild(raiz);

    const q = <T extends HTMLElement>(id: string) => raiz.querySelector<T>(`[data-id=${id}]`)!;
    this.el = {
      conexion: raiz.querySelector('.conexion')!,
      resumen: q('resumen'),
      controles: q('controles'),
      entrada: q('entrada'),
      reintentar: q('reintentar'),
      deteccion: q('deteccion'),
      trackeo: q('trackeo'),
      espejar: q('espejar'),
      filaPunto: q('filaPunto'),
      punto: q('punto'),
      mensajeEntrada: q('mensajeEntrada'),
      lienzo: q('lienzo'),
      verImagen: q('verImagen'),
      zonaTexto: q('zonaTexto'),
      sinZona: q('sinZona'),
      modoNombre: q('modoNombre'),
      nombre: q('nombre'),
      enPantalla: q('enPantalla'),
      volumen: q('volumen'),
      volumenTexto: q('volumenTexto'),
    };

    this.panel = new PanelParametros(q('parametros'), {
      incrustado: true,
      alCambiar: (clave, valor) => this.enviar({ tipo: 'parametro', clave, valor }),
      alRestablecer: () => this.enviar({ tipo: 'restablecerParametros' }),
    });

    this.conectarControles(raiz);
    this.conectarLienzo();
    this.imagen.onload = () => {
      this.hayImagen = true;
      this.pedirDibujo();
    };

    this.canal.onmessage = (e: MessageEvent<EstadoJuego>) => {
      if (e.data?.tipo === 'estado') this.recibir(e.data);
    };
    const saludar = () => this.enviar({ tipo: 'hola', imagen: this.preferencias.imagen });
    saludar();
    setInterval(saludar, HOLA_MS);
    setInterval(() => this.revisarConexion(), 500);
  }

  private enviar(m: MensajeControl) {
    this.canal.postMessage(m);
  }

  private ajustar(cambios: Partial<Ajustes>) {
    this.enviar({ tipo: 'ajustes', cambios });
    // Se muestra enseguida, sin esperar la vuelta del juego.
    if (this.estado) this.estado.ajustes = { ...this.estado.ajustes, ...cambios };
  }

  private conectarControles(raiz: HTMLElement) {
    const { el } = this;
    el.entrada.addEventListener('change', () => {
      const modo = el.entrada.value as ModoEntrada;
      if (modo !== 'teclado') this.guardarPreferencias({ ultimoSensor: modo });
      this.ajustar({ modoEntrada: modo });
    });
    el.deteccion.addEventListener('change', () => {
      this.ajustar({ modoEntrada: el.deteccion.checked ? this.preferencias.ultimoSensor : 'teclado' });
    });
    el.reintentar.addEventListener('click', () => this.enviar({ tipo: 'reintentar' }));
    el.trackeo.addEventListener('change', () => this.ajustar({ camaraEnJuego: el.trackeo.value as CamaraEnJuego }));
    el.espejar.addEventListener('change', () => this.ajustar({ espejar: el.espejar.checked }));
    el.punto.addEventListener('change', () => {
      if (this.estado?.ajustes.modoEntrada === 'kinect') this.ajustar({ puntoKinect: el.punto.value as PuntoKinect });
      else this.ajustar({ puntoPose: el.punto.value as Ajustes['puntoPose'] });
    });
    el.verImagen.checked = this.preferencias.imagen;
    el.verImagen.addEventListener('change', () => {
      this.guardarPreferencias({ imagen: el.verImagen.checked });
      this.hayImagen = false;
      this.enviar({ tipo: 'hola', imagen: el.verImagen.checked });
      this.pedirDibujo();
    });
    el.modoNombre.addEventListener('change', () => this.ajustar({ modoNombre: el.modoNombre.value as ModoNombre }));
    el.volumen.addEventListener('input', () => this.ajustar({ volumen: Number(el.volumen.value) }));

    // El nombre se ve en el juego mientras se escribe (si está en la pantalla del nombre).
    el.nombre.addEventListener('input', () => {
      const limpio = limpiarNombre(el.nombre.value, this.estado?.maxLetras ?? CONFIG.nombreMaxLetras);
      if (el.nombre.value !== limpio) el.nombre.value = limpio;
      this.enviar({ tipo: 'nombre', nombre: limpio, confirmar: false });
    });
    const confirmar = () => {
      this.enviar({ tipo: 'nombre', nombre: el.nombre.value, confirmar: true });
      el.nombre.value = '';
    };
    el.nombre.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirmar();
    });
    raiz.querySelector('[data-accion=confirmarNombre]')!.addEventListener('click', confirmar);
    raiz.querySelector('[data-accion=borrarNombre]')!.addEventListener('click', () => {
      el.nombre.value = '';
      this.enviar({ tipo: 'nombre', nombre: '', confirmar: false });
    });

    const ponerZona = (z: Zona) => {
      const clave = claveZona(this.estado?.ajustes.modoEntrada ?? null);
      if (!clave) return;
      this.zonaLocal = z;
      this.zonaLocalHasta = performance.now() + ESPERA_ZONA_MS;
      this.ajustar({ [clave]: z });
      this.pedirDibujo();
    };
    raiz.querySelector('[data-accion=zonaToda]')!.addEventListener('click', () => ponerZona({ x0: 0, x1: 1, y0: 0, y1: 1 }));
    raiz.querySelector('[data-accion=zonaDefecto]')!.addEventListener('click', () => {
      const clave = claveZona(this.estado?.ajustes.modoEntrada ?? null);
      if (clave) ponerZona({ ...AJUSTES_POR_DEFECTO[clave] });
    });
  }

  /** La zona se arrastra con el mouse (o el dedo) sobre la imagen. */
  private conectarLienzo() {
    const lienzo = this.el.lienzo;
    const aFraccion = (e: PointerEvent) => {
      const r = lienzo.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    };
    lienzo.addEventListener('pointerdown', (e) => {
      const zona = this.zonaVisible();
      if (!zona) return;
      const p = aFraccion(e);
      const agarre = agarreEn(zona, p.x, p.y, TOLERANCIA_BORDE);
      if (!agarre) return;
      lienzo.setPointerCapture(e.pointerId);
      this.arrastre = { agarre, inicio: zona, x: p.x, y: p.y };
    });
    lienzo.addEventListener('pointermove', (e) => {
      const p = aFraccion(e);
      if (!this.arrastre) {
        const zona = this.zonaVisible();
        lienzo.style.cursor = zona ? cursorDe(agarreEn(zona, p.x, p.y, TOLERANCIA_BORDE)) : 'default';
        return;
      }
      this.zonaLocal = arrastrarZona(this.arrastre.inicio, this.arrastre.agarre, p.x - this.arrastre.x, p.y - this.arrastre.y);
      this.zonaLocalHasta = Infinity;
      const ahora = performance.now();
      if (ahora - this.ultimoEnvioZona > ZONA_CADA_MS) {
        this.ultimoEnvioZona = ahora;
        this.enviarZona();
      }
      this.pedirDibujo();
    });
    const soltar = () => {
      if (!this.arrastre) return;
      this.arrastre = null;
      this.enviarZona();
      this.zonaLocalHasta = performance.now() + ESPERA_ZONA_MS;
    };
    lienzo.addEventListener('pointerup', soltar);
    lienzo.addEventListener('pointercancel', soltar);
  }

  private enviarZona() {
    const clave = claveZona(this.estado?.ajustes.modoEntrada ?? null);
    if (clave && this.zonaLocal) this.ajustar({ [clave]: this.zonaLocal });
  }

  /** La zona que se muestra: la que se está arrastrando (o se acaba de soltar), o la del juego. */
  private zonaVisible(): Zona | null {
    const clave = claveZona(this.estado?.ajustes.modoEntrada ?? null);
    if (!clave || !this.estado) return null;
    if (this.zonaLocal && (this.arrastre || performance.now() < this.zonaLocalHasta)) return this.zonaLocal;
    return this.estado.ajustes[clave];
  }

  private recibir(estado: EstadoJuego) {
    this.estado = estado;
    this.ultimoEstado = performance.now();
    if (estado.imagen && this.preferencias.imagen) this.imagen.src = estado.imagen;
    if (!estado.vista) this.hayImagen = false;

    const parametros = JSON.stringify(estado.parametros);
    if (parametros !== this.ultimosParametros) {
      this.ultimosParametros = parametros;
      this.panel.sincronizar(estado.parametros);
    }
    this.mostrarEstado();
    this.pedirDibujo();
  }

  private revisarConexion() {
    const conectado = performance.now() - this.ultimoEstado < SIN_JUEGO_MS;
    this.el.conexion.textContent = conectado ? 'conectado' : 'sin conexión';
    this.el.conexion.className = `conexion ${conectado ? 'si' : 'no'}`;
    this.el.controles.classList.toggle('desconectado', !conectado);
    if (!conectado) this.el.resumen.textContent = 'Esperando el juego… (tiene que estar abierto en esta computadora)';
  }

  private mostrarEstado() {
    const { el } = this;
    const e = this.estado!;
    const a = e.ajustes;
    const conSensor = a.modoEntrada !== 'teclado';
    const quien = a.modoEntrada === 'manos' ? 'manos' : 'personas';
    el.resumen.innerHTML =
      `Pantalla: <b>${ESCENAS[e.escena] ?? e.escena}</b> · Entrada: <b>${NOMBRE_MODO[a.modoEntrada]}</b>` +
      (conSensor ? ` · ${quien} detectadas: <b>${e.estadoEntrada === 'lista' ? e.personas : '–'}</b>` : '');

    ponerValor(el.entrada, a.modoEntrada);
    ponerValor(el.deteccion, conSensor);
    if (conSensor && a.modoEntrada !== this.preferencias.ultimoSensor) this.guardarPreferencias({ ultimoSensor: a.modoEntrada });
    ponerValor(el.trackeo, a.camaraEnJuego);
    ponerValor(el.espejar, a.espejar);
    ponerValor(el.modoNombre, a.modoNombre);
    ponerValor(el.volumen, String(a.volumen));
    el.volumenTexto.textContent = `${Math.round(a.volumen * 100)} %`;

    // Punto de cada jugador: solo en Pose y Kinect.
    const opcionesPunto: [string, string][] =
      a.modoEntrada === 'kinect'
        ? Object.entries(NOMBRE_PUNTO_KINECT)
        : [
            ['torso', 'centro del torso'],
            ['muneca', 'muñeca más alta'],
          ];
    el.filaPunto.hidden = a.modoEntrada !== 'pose' && a.modoEntrada !== 'kinect';
    const html = opciones(opcionesPunto);
    if (el.punto.dataset.opciones !== html) {
      el.punto.innerHTML = html;
      el.punto.dataset.opciones = html;
    }
    ponerValor(el.punto, a.modoEntrada === 'kinect' ? a.puntoKinect : a.puntoPose);

    const error = e.estadoEntrada === 'error';
    el.reintentar.hidden = !error || !conSensor;
    el.mensajeEntrada.textContent = conSensor ? e.mensajeEntrada : 'Detección apagada: los jugadores se mueven con el teclado (WASD y flechas).';
    el.sinZona.hidden = conSensor;
    el.lienzo.hidden = !conSensor;

    el.enPantalla.textContent =
      e.nombre !== null
        ? `En la pantalla del juego: ${e.nombre || '(vacío)'}`
        : a.modoNombre === 'sin'
          ? 'El juego no pide nombre ("sin nombre"): se usa lo que escribas acá, o DUO.'
          : 'El juego no está en la pantalla del nombre: lo que confirmes se usa al llegar.';
  }

  private pedirDibujo() {
    if (this.dibujoPendiente) return;
    this.dibujoPendiente = true;
    requestAnimationFrame(() => {
      this.dibujoPendiente = false;
      this.dibujar();
    });
  }

  /** Imagen (espejada si corresponde), esqueletos, jugadores y la zona de juego, como se ve en el juego. */
  private dibujar() {
    const lienzo = this.el.lienzo;
    const e = this.estado;
    const zona = this.zonaVisible();
    if (!e || lienzo.hidden) return;
    const aspecto = e.vista?.aspecto ?? 4 / 3;
    const ancho = Math.round(lienzo.clientWidth * Math.min(2, devicePixelRatio || 1)) || 560;
    const alto = Math.round(ancho / aspecto);
    if (lienzo.width !== ancho || lienzo.height !== alto) Object.assign(lienzo, { width: ancho, height: alto });
    const ctx = lienzo.getContext('2d')!;
    const espejar = e.ajustes.espejar;
    ctx.clearRect(0, 0, ancho, alto);

    if (this.preferencias.imagen && this.hayImagen) {
      ctx.save();
      ctx.globalAlpha = 0.8;
      if (espejar) {
        ctx.translate(ancho, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(this.imagen, 0, 0, ancho, alto);
      ctx.restore();
    }

    const aLienzo = (p: { x: number; y: number }) => ({ x: (espejar ? 1 - p.x : p.x) * ancho, y: p.y * alto });
    const grosor = Math.max(1.5, ancho / 320);
    if (e.vista) {
      ctx.strokeStyle = 'rgba(0,255,136,0.8)';
      ctx.fillStyle = 'rgba(0,255,136,0.95)';
      ctx.lineWidth = grosor;
      for (const grupo of e.vista.puntos) {
        const pts = grupo.map(aLienzo);
        ctx.beginPath();
        for (const { start, end } of e.vista.conexiones) {
          if (!pts[start] || !pts[end]) continue;
          ctx.moveTo(pts[start].x, pts[start].y);
          ctx.lineTo(pts[end].x, pts[end].y);
        }
        ctx.stroke();
        for (const p of pts) ctx.fillRect(p.x - grosor, p.y - grosor, grosor * 2, grosor * 2);
      }
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = grosor + 1;
      for (const j of e.vista.jugadores) {
        const p = aLienzo(j);
        ctx.beginPath();
        ctx.arc(p.x, p.y, grosor * 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (zona) {
      const x = zona.x0 * ancho;
      const y = zona.y0 * alto;
      const w = (zona.x1 - zona.x0) * ancho;
      const h = (zona.y1 - zona.y0) * alto;
      // Afuera de la zona, más oscuro (no llega al juego).
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, ancho, y);
      ctx.fillRect(0, y + h, ancho, alto - y - h);
      ctx.fillRect(0, y, x, h);
      ctx.fillRect(x + w, y, ancho - x - w, h);
      ctx.strokeStyle = '#ffd060';
      ctx.lineWidth = grosor + 1;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#ffd060';
      const m = grosor * 4;
      for (const [cx, cy] of [
        [x, y],
        [x + w, y],
        [x, y + h],
        [x + w, y + h],
      ]) {
        ctx.fillRect(cx - m, cy - m, m * 2, m * 2);
      }
      const pc = (n: number) => Math.round(n * 100);
      this.el.zonaTexto.textContent = `x ${pc(zona.x0)}–${pc(zona.x1)} % · y ${pc(zona.y0)}–${pc(zona.y1)} %`;
    }

    if (!e.vista) {
      ctx.fillStyle = '#9a9a9a';
      ctx.font = `${Math.round(ancho / 30)}px ${FUENTE}`;
      ctx.textAlign = 'center';
      ctx.fillText(e.estadoEntrada === 'cargando' ? 'Cargando la cámara…' : 'Sin imagen de la cámara', ancho / 2, alto / 2);
    }
  }

  private guardarPreferencias(cambios: Partial<Preferencias>) {
    this.preferencias = { ...this.preferencias, ...cambios };
    try {
      localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify(this.preferencias));
    } catch {
      // Sin localStorage: duran hasta cerrar la ventana.
    }
  }
}

function leerPreferencias(): Preferencias {
  const porDefecto: Preferencias = { imagen: true, ultimoSensor: 'pose' };
  try {
    return { ...porDefecto, ...JSON.parse(localStorage.getItem(CLAVE_PREFERENCIAS) ?? '{}') };
  } catch {
    return porDefecto;
  }
}

function opciones(pares: [string, string][]) {
  return pares.map(([valor, texto]) => `<option value="${valor}">${texto}</option>`).join('');
}

/** Pone el valor que manda el juego, salvo en el control que se está usando (no le cambia nada en la mano). */
function ponerValor(control: HTMLInputElement | HTMLSelectElement, valor: string | boolean) {
  if (document.activeElement === control && !(control instanceof HTMLInputElement && control.type === 'checkbox')) return;
  if (typeof valor === 'boolean') (control as HTMLInputElement).checked = valor;
  else if (control.value !== valor) control.value = valor;
}

function cursorDe(agarre: Agarre | null) {
  switch (agarre) {
    case 'mover':
      return 'move';
    case 'x0':
    case 'x1':
      return 'ew-resize';
    case 'y0':
    case 'y1':
      return 'ns-resize';
    case 'x0y0':
    case 'x1y1':
      return 'nwse-resize';
    case 'x1y0':
    case 'x0y1':
      return 'nesw-resize';
    default:
      return 'default';
  }
}
