import { formatearBytes, type Etapa } from '../input/carga';
import type { InputManager } from '../input/InputManager';
import { FUENTE } from './text';

// Panel con una barra por cada etapa de la carga de la cámara (permiso, motor, modelo, detector).
// Muestra los MB descargados y la velocidad, así se ve si algo avanza o en qué etapa se trabó.
// Es HTML abajo a la izquierda, dentro de #app. Aparece mientras carga o si falló (con el error y botones
// para reintentar o cerrarlo), y se va solo unos segundos después de que la cámara queda lista.

const ESTILO = `
.orbe-carga { position: fixed; left: 12px; bottom: 12px; z-index: 15; box-sizing: border-box;
  width: 400px; max-width: calc(100vw - 24px); padding: 10px 12px; border-radius: 8px;
  background: rgba(0,0,0,.85); border: 1px solid rgba(255,255,255,.3); color: #fff; font: 13px ${FUENTE};
  pointer-events: none; }
.orbe-carga[hidden], .orbe-carga [hidden] { display: none !important; }
.orbe-carga h4 { margin: 0 0 8px; font-size: 14px; }
.orbe-carga .mensaje { margin-top: 10px; color: #ff8080; }
.orbe-carga .botones { margin-top: 8px; display: flex; gap: 8px; pointer-events: auto; }
.orbe-carga button { font: inherit; color: #fff; background: #222; border: 1px solid rgba(255,255,255,.35);
  border-radius: 6px; padding: 4px 10px; cursor: pointer; }
.orbe-carga button:hover { background: #333; }
.orbe-carga .etapa { margin-top: 7px; }
.orbe-carga .fila { display: flex; justify-content: space-between; gap: 10px; }
.orbe-carga .info { color: #9a9a9a; text-align: right; overflow-wrap: anywhere; }
.orbe-carga .error .info { color: #ff8080; }
.orbe-carga .barra { position: relative; height: 6px; margin-top: 3px; border-radius: 3px;
  background: rgba(255,255,255,.15); overflow: hidden; }
.orbe-carga .relleno { position: absolute; top: 0; bottom: 0; left: 0; background: #fff; border-radius: 3px; }
.orbe-carga .listo .relleno { background: #4cff7a; }
.orbe-carga .error .relleno { background: #ff5050; }
.orbe-carga .indefinida .relleno { width: 30% !important; animation: orbe-carga-ida 1.2s ease-in-out infinite; }
@keyframes orbe-carga-ida { from { left: -30%; } to { left: 100%; } }
`;

/** Cada cuánto se actualiza el panel. */
const CADA_MS = 200;
/** Cuánto queda visible después de que la cámara está lista. */
const DESPUES_DE_LISTA_MS = 3000;

export class PanelCarga {
  private div: HTMLDivElement;
  private titulo: HTMLHeadingElement;
  private filas = new Map<Etapa, { div: HTMLDivElement; info: HTMLSpanElement; relleno: HTMLDivElement }>();
  private mensaje: HTMLDivElement;
  private botones: HTMLDivElement;
  private cargaActual: Etapa[] = [];
  private listaDesde = 0;
  /** Se cerró a mano (después de un error); vuelve a aparecer en la próxima carga. */
  private cerrado = false;
  /** Si está a la vista (las escenas ocultan su línea de estado para no pisarse). */
  visible = false;

  constructor(private input: InputManager) {
    const estilo = document.createElement('style');
    estilo.textContent = ESTILO;
    document.head.appendChild(estilo);
    this.div = document.createElement('div');
    this.div.className = 'orbe-carga';
    this.div.hidden = true;
    this.titulo = document.createElement('h4');
    this.mensaje = document.createElement('div');
    this.mensaje.className = 'mensaje';
    this.botones = document.createElement('div');
    this.botones.className = 'botones';
    const reintentar = document.createElement('button');
    reintentar.textContent = 'Reintentar';
    reintentar.addEventListener('click', () => this.input.start());
    const cerrar = document.createElement('button');
    cerrar.textContent = 'Cerrar';
    cerrar.addEventListener('click', () => (this.cerrado = true));
    this.botones.append(reintentar, cerrar);
    this.div.append(this.titulo, this.mensaje, this.botones);
    (document.getElementById('app') ?? document.body).appendChild(this.div);
    setInterval(() => this.actualizar(), CADA_MS);
  }

  private actualizar() {
    const { carga, estado } = this.input;
    if (carga !== this.cargaActual) {
      this.rehacer(carga);
      this.cerrado = false;
    }

    const ahora = performance.now();
    if (estado === 'lista') this.listaDesde ||= ahora;
    else this.listaDesde = 0;
    this.visible =
      !this.cerrado &&
      carga.length > 0 &&
      (estado === 'cargando' || estado === 'error' || (estado === 'lista' && ahora - this.listaDesde < DESPUES_DE_LISTA_MS));
    this.div.hidden = !this.visible;
    if (!this.visible) return;
    this.mensaje.hidden = this.botones.hidden = estado !== 'error';
    // Si el error ya figura en la etapa que falló, no se repite.
    const enEtapa = carga.some((e) => e.estado === 'error' && this.input.error.includes(e.detalle));
    this.mensaje.textContent = `${enEtapa ? '' : `${this.input.error} `}Mientras, se usa el teclado.`;

    this.titulo.textContent = estado === 'error' ? 'La cámara no cargó' : estado === 'lista' ? 'Cámara lista' : 'Cargando la cámara';
    for (const etapa of carga) {
      const fila = this.filas.get(etapa)!;
      const avance = etapa.avance;
      fila.div.className = `etapa ${etapa.estado === 'listo' ? 'listo' : etapa.estado === 'error' ? 'error' : ''} ${
        etapa.estado === 'en curso' && avance === null ? 'indefinida' : ''
      }`;
      fila.relleno.style.width = `${(avance ?? (etapa.estado === 'error' ? 1 : 0)) * 100}%`;
      fila.info.textContent = estado === 'error' && etapa.estado === 'pendiente' ? 'no llegó a empezar' : textoEtapa(etapa);
    }
  }

  private rehacer(carga: Etapa[]) {
    for (const { div } of this.filas.values()) div.remove();
    this.filas.clear();
    this.cargaActual = carga;
    for (const etapa of carga) {
      const div = document.createElement('div');
      const fila = document.createElement('div');
      fila.className = 'fila';
      const nombre = document.createElement('span');
      nombre.textContent = etapa.nombre;
      const info = document.createElement('span');
      info.className = 'info';
      fila.append(nombre, info);
      const barra = document.createElement('div');
      barra.className = 'barra';
      const relleno = document.createElement('div');
      relleno.className = 'relleno';
      barra.appendChild(relleno);
      div.append(fila, barra);
      this.div.insertBefore(div, this.mensaje);
      this.filas.set(etapa, { div, info, relleno });
    }
  }
}

/** "3,2 MB / 13,5 MB · 1,8 MB/s", "listo en 4,1 s (GPU)", "esperando permiso · 12 s"… */
export function textoEtapa(etapa: Etapa): string {
  const seg = `${etapa.segundos.toLocaleString('es-AR', { maximumFractionDigits: 1 })} s`;
  const d = etapa.descarga;
  switch (etapa.estado) {
    case 'pendiente':
      return 'esperando…';
    case 'error':
      return etapa.detalle;
    case 'listo':
      // Si ya estaba descargado de antes (por ejemplo, al cambiar de modo), termina al instante.
      if (d) return etapa.segundos < 0.1 ? `${formatearBytes(d.bytes)} (ya descargado)` : `${formatearBytes(d.bytes)} en ${seg}`;
      return `listo en ${seg}${etapa.detalle ? ` (${etapa.detalle})` : ''}`;
    case 'en curso':
      if (d) {
        if (d.bytes === 0) return `conectando… · ${seg}`;
        const total = d.total ? ` / ${formatearBytes(d.total)}` : '';
        return `${formatearBytes(d.bytes)}${total} · ${formatearBytes(d.velocidad)}/s`;
      }
      return `${etapa.detalle ? `${etapa.detalle} · ` : ''}${seg}`;
  }
}
