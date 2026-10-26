import { CONFIG } from '../config';
import fuenteConfig from '../config.ts?raw';
import {
  ORIGINALES,
  cambios,
  guardarParametros,
  leerDefiniciones,
  rango,
  setParametro,
  type ClaveParametro,
  type ValorParametro,
} from '../storage/parametros';
import { FUENTE } from './text';

// Panel para ajustar a mano los parámetros de config.ts mientras se juega.
// Se abre con el botón ⚙ (arriba a la derecha) o con F2. Los cambios se aplican al instante
// y se guardan en este navegador. "Copiar cambios" da el JSON para pasarlo a config.ts.
// Es HTML encima del juego (dentro de #app, así también se ve en pantalla completa).

const ESTILO = `
.orbe-engranaje { position: fixed; top: 10px; right: 10px; z-index: 20; width: 38px; height: 38px;
  border-radius: 50%; border: 1px solid rgba(255,255,255,.35); background: rgba(0,0,0,.6); color: #fff;
  font-size: 20px; line-height: 36px; padding: 0; cursor: pointer; opacity: .45; }
.orbe-engranaje:hover { opacity: 1; }
.orbe-panel { position: fixed; top: 0; right: 0; z-index: 30; box-sizing: border-box; width: 400px; max-width: 100vw;
  height: 100%; overflow-y: auto; padding: 14px 16px 40px; background: rgba(0,0,0,.92);
  border-left: 1px solid rgba(255,255,255,.25); color: #fff; font: 13px ${FUENTE}; }
.orbe-panel[hidden] { display: none; }
.orbe-panel h2 { margin: 0; font-size: 20px; }
.orbe-panel h3 { margin: 18px 0 6px; font-size: 13px; color: #9a9a9a; text-transform: uppercase; letter-spacing: .05em; }
.orbe-panel .cabecera { display: flex; justify-content: space-between; align-items: center; }
.orbe-panel .nota { color: #9a9a9a; margin: 6px 0 10px; }
.orbe-panel button { font: inherit; color: #fff; background: #222; border: 1px solid rgba(255,255,255,.35);
  border-radius: 6px; padding: 5px 10px; cursor: pointer; }
.orbe-panel button:hover { background: #333; }
.orbe-panel .acciones { display: flex; gap: 8px; flex-wrap: wrap; }
.orbe-panel .fila { padding: 8px 0; border-top: 1px solid rgba(255,255,255,.1); }
.orbe-panel .nombre { font-weight: bold; }
.orbe-panel .fila.cambiado .nombre { color: #ffd060; }
.orbe-panel .desc { color: #9a9a9a; margin: 2px 0 6px; }
.orbe-panel .control { display: flex; gap: 8px; align-items: center; }
.orbe-panel input[type=range] { flex: 1; min-width: 0; }
.orbe-panel input[type=number] { width: 80px; font: inherit; color: #fff; background: #111;
  border: 1px solid rgba(255,255,255,.35); border-radius: 4px; padding: 3px 5px; }
.orbe-panel .volver { padding: 2px 7px; visibility: hidden; }
.orbe-panel .fila.cambiado .volver { visibility: visible; }
.orbe-panel textarea { width: 100%; box-sizing: border-box; margin-top: 8px; font: 12px monospace; color: #fff;
  background: #111; border: 1px solid rgba(255,255,255,.35); }
`;

interface Fila {
  clave: ClaveParametro;
  div: HTMLDivElement;
  mostrar: (v: ValorParametro) => void;
}

export class PanelParametros {
  private panel: HTMLDivElement;
  private filas: Fila[] = [];
  private salida: HTMLTextAreaElement;

  constructor(contenedor: HTMLElement) {
    const estilo = document.createElement('style');
    estilo.textContent = ESTILO;
    document.head.appendChild(estilo);

    const engranaje = document.createElement('button');
    engranaje.className = 'orbe-engranaje';
    engranaje.title = 'Parámetros [F2]';
    engranaje.textContent = '⚙';
    engranaje.addEventListener('click', () => this.alternar());
    contenedor.appendChild(engranaje);

    this.panel = document.createElement('div');
    this.panel.className = 'orbe-panel';
    this.panel.hidden = true;
    this.panel.innerHTML = `
      <div class="cabecera"><h2>Parámetros</h2><button data-accion="cerrar" title="Cerrar [F2]">✕</button></div>
      <p class="nota">Los cambios se aplican al instante y quedan guardados en este navegador.
        Algunos (como el brillo) se notan al empezar el próximo nivel.</p>
      <div class="acciones">
        <button data-accion="copiar">Copiar cambios</button>
        <button data-accion="restablecer">Restablecer todo</button>
      </div>
      <textarea rows="4" readonly hidden></textarea>`;
    this.salida = this.panel.querySelector('textarea')!;
    this.panel.querySelector('[data-accion=cerrar]')!.addEventListener('click', () => this.alternar(false));
    this.panel.querySelector('[data-accion=copiar]')!.addEventListener('click', () => this.copiar());
    this.panel.querySelector('[data-accion=restablecer]')!.addEventListener('click', () => this.restablecer());

    let seccion = '';
    for (const def of leerDefiniciones(fuenteConfig, ORIGINALES)) {
      if (def.seccion !== seccion) {
        seccion = def.seccion;
        const h = document.createElement('h3');
        h.textContent = seccion;
        this.panel.appendChild(h);
      }
      const fila = this.crearFila(def.clave, def.descripcion);
      this.filas.push(fila);
      this.panel.appendChild(fila.div);
    }
    contenedor.appendChild(this.panel);

    // Mientras se escribe en el panel, las teclas no llegan al juego (Phaser escucha en window).
    for (const tipo of ['keydown', 'keyup', 'keypress'] as const) {
      this.panel.addEventListener(tipo, (e) => {
        if (e instanceof KeyboardEvent && e.type === 'keydown' && e.key === 'Escape') this.alternar(false);
        e.stopPropagation();
      });
    }
    // F2 abre y cierra desde cualquier lado (en captura, antes que el juego y el panel).
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'F2') return;
        e.preventDefault();
        e.stopPropagation();
        this.alternar();
      },
      true,
    );
  }

  alternar(abrir = this.panel.hidden) {
    this.panel.hidden = !abrir;
    if (abrir) for (const f of this.filas) f.mostrar(CONFIG[f.clave]);
    else (document.activeElement as HTMLElement | null)?.blur();
  }

  private crearFila(clave: ClaveParametro, descripcion: string): Fila {
    const original = ORIGINALES[clave];
    const div = document.createElement('div');
    div.className = 'fila';
    const nombre = document.createElement('div');
    nombre.className = 'nombre';
    nombre.textContent = clave;
    const desc = document.createElement('div');
    desc.className = 'desc';
    desc.textContent = descripcion;
    const control = document.createElement('div');
    control.className = 'control';
    const volver = document.createElement('button');
    volver.className = 'volver';
    volver.title = `Volver al valor de config.ts (${original})`;
    volver.textContent = '↺';
    div.append(nombre, desc, control);

    let mostrar: (v: ValorParametro) => void;
    if (typeof original === 'boolean') {
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.addEventListener('change', () => this.cambiar(clave, check.checked));
      control.append(check, volver);
      mostrar = (v) => (check.checked = v as boolean);
    } else {
      const { min, max, paso } = rango(original);
      const deslizador = document.createElement('input');
      deslizador.type = 'range';
      deslizador.min = String(min);
      deslizador.max = String(max);
      deslizador.step = String(paso);
      const numero = document.createElement('input');
      numero.type = 'number';
      numero.step = 'any';
      deslizador.addEventListener('input', () => {
        numero.value = deslizador.value;
        this.cambiar(clave, Number(deslizador.value));
      });
      numero.addEventListener('change', () => {
        let v = Number(numero.value);
        if (numero.value.trim() === '' || !Number.isFinite(v)) return mostrar(CONFIG[clave]);
        if (Number.isInteger(original)) v = Math.round(v);
        this.cambiar(clave, v);
        mostrar(v);
      });
      control.append(deslizador, numero, volver);
      mostrar = (v) => {
        deslizador.value = String(v);
        numero.value = String(v);
      };
    }

    volver.addEventListener('click', () => {
      this.cambiar(clave, original);
      mostrar(original);
    });
    mostrar(CONFIG[clave]);
    div.classList.toggle('cambiado', CONFIG[clave] !== original);
    return { clave, div, mostrar };
  }

  private cambiar(clave: ClaveParametro, valor: ValorParametro) {
    setParametro(clave, valor);
    guardarParametros();
    this.filas.find((f) => f.clave === clave)?.div.classList.toggle('cambiado', valor !== ORIGINALES[clave]);
  }

  private restablecer() {
    for (const f of this.filas) {
      setParametro(f.clave, ORIGINALES[f.clave]);
      f.mostrar(ORIGINALES[f.clave]);
      f.div.classList.remove('cambiado');
    }
    guardarParametros();
    this.salida.hidden = true;
  }

  /** Muestra los cambios como JSON (para pasarlos a config.ts) y los copia al portapapeles si se puede. */
  private copiar() {
    const c = cambios();
    const texto = Object.keys(c).length ? JSON.stringify(c, null, 2) : '(sin cambios respecto de config.ts)';
    this.salida.value = texto;
    this.salida.hidden = false;
    this.salida.select();
    navigator.clipboard?.writeText(texto).catch(() => {
      // Sin permiso de portapapeles: queda seleccionado en el cuadro para copiarlo a mano.
    });
  }
}
