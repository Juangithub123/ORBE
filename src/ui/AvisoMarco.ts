// Aviso para cuando el juego está dentro de un marco (iframe) que no deja usar la cámara, como la página
// de un juego web en itch.io: el navegador bloquea la cámara en un marco de otro sitio salvo que la página
// lo permita, y eso no se puede arreglar desde el juego. La salida es abrir el juego en su propia pestaña,
// así que el aviso es un enlace (HTML encima del juego) que abre esta misma dirección aparte.

/** Si el juego corre dentro de un marco de otra página. */
export function enMarco() {
  try {
    return window.self !== window.top;
  } catch {
    // Acceder a window.top de otro sitio puede tirar error: eso ya dice que hay un marco.
    return true;
  }
}

/**
 * Si la página que contiene al juego no deja usar la cámara. Chrome y Edge lo informan de antemano
 * (Permissions Policy); en otros navegadores se sabe recién al pedir la cámara (null = no se sabe).
 */
export function camaraBloqueadaPorMarco(): boolean | null {
  if (!enMarco()) return false;
  const politica = (document as Document & { permissionsPolicy?: Politica; featurePolicy?: Politica }).permissionsPolicy ??
    (document as Document & { featurePolicy?: Politica }).featurePolicy;
  if (!politica?.allowsFeature) return null;
  return !politica.allowsFeature('camera');
}

interface Politica {
  allowsFeature(nombre: string): boolean;
}

/** El navegador no deja usar la cámara porque el juego está dentro de una página que no lo permite. */
export class CamaraBloqueadaEnMarco extends Error {
  constructor() {
    super('Esta página no deja usar la cámara dentro del juego. Abrilo en una pestaña aparte (aviso arriba) o jugá con el teclado.');
  }
}

const ESTILO = `
.orbe-aviso-marco { position: fixed; top: 0; left: 50%; transform: translateX(-50%); z-index: 40;
  max-width: calc(100vw - 24px); box-sizing: border-box; margin-top: 10px; padding: 10px 14px;
  display: flex; gap: 12px; align-items: center; flex-wrap: wrap; justify-content: center;
  background: rgba(20,20,20,.95); border: 1px solid #ffd060; border-radius: 8px;
  color: #fff; font: 14px Verdana, Tahoma, sans-serif; text-align: center; }
.orbe-aviso-marco a { color: #000; background: #ffd060; padding: 6px 12px; border-radius: 6px;
  font-weight: bold; text-decoration: none; white-space: nowrap; }
.orbe-aviso-marco button { font: inherit; color: #9a9a9a; background: none; border: 0; cursor: pointer; }
`;

let aviso: HTMLDivElement | null = null;

/** Muestra (o esconde) el aviso con el enlace para abrir el juego en una pestaña aparte. */
export function mostrarAvisoMarco(visible: boolean) {
  if (!visible) {
    if (aviso) aviso.hidden = true;
    return;
  }
  if (!aviso) {
    const estilo = document.createElement('style');
    estilo.textContent = ESTILO;
    document.head.appendChild(estilo);
    aviso = document.createElement('div');
    aviso.className = 'orbe-aviso-marco';
    const texto = document.createElement('span');
    texto.textContent = 'Esta página no deja usar la cámara dentro del juego.';
    const enlace = document.createElement('a');
    enlace.href = location.href;
    enlace.target = '_blank';
    enlace.rel = 'noopener';
    enlace.textContent = 'Abrir el juego en una pestaña nueva ↗';
    const cerrar = document.createElement('button');
    cerrar.textContent = '✕';
    cerrar.title = 'Cerrar (seguir con el teclado)';
    cerrar.addEventListener('click', () => mostrarAvisoMarco(false));
    aviso.append(texto, enlace, cerrar);
    (document.getElementById('app') ?? document.body).appendChild(aviso);
  }
  aviso.hidden = false;
}
