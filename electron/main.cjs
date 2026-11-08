// Proceso principal de la versión de escritorio (Electron).
// Abre el juego ya compilado (dist/, con `npm run build:electron`) desde un protocolo propio, app://orbe/,
// para que funcionen igual que en la web las descargas con progreso del modelo y la carga de los niveles
// (abierto como archivo local, el navegador interno las bloquea).
//
// Modo kiosco (`--kiosco`, o un .exe portable con "kiosco" en el nombre): pantalla completa en el monitor o
// proyector externo si hay, sin cursor, y el juego arranca solo. Se sale con Ctrl+Q.
//
// Ventana de control (F4 en el juego, el panel ⚙, o `--control` al abrir): una segunda ventana para el
// operador, en la pantalla principal (no en la del proyector), con los parámetros, el nombre, la entrada y
// la zona de juego. Habla con el juego directamente (BroadcastChannel, mismo origen app://orbe).

const { app, BrowserWindow, Menu, ipcMain, powerSaveBlocker, protocol, screen, session, systemPreferences } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const ESQUEMA = 'app';
const ORIGEN = `${ESQUEMA}://orbe`;
const DIST = path.join(__dirname, '..', 'dist');

const abrirControlAlInicio = process.argv.includes('--control');
const kiosco =
  process.argv.includes('--kiosco') ||
  /kiosco/i.test(path.basename(process.env.PORTABLE_EXECUTABLE_FILE ?? process.execPath));

// En notebooks con dos GPU (por ejemplo, una RTX y la integrada), que use la dedicada.
app.commandLine.appendSwitch('force_high_performance_gpu');
// El juego necesita WebGL: aunque Chromium tenga la placa de video en su lista de bloqueos, que lo intente igual.
app.commandLine.appendSwitch('ignore-gpu-blocklist');
// El audio puede sonar sin esperar un clic (en el kiosco no hay nadie que haga clic).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

protocol.registerSchemesAsPrivileged([
  { scheme: ESQUEMA, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

// Una sola ventana: si se abre otra vez, se trae al frente la que ya está.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const ventana = ventanaJuego ?? BrowserWindow.getAllWindows()[0];
    if (!ventana) return;
    if (ventana.isMinimized()) ventana.restore();
    ventana.focus();
  });
  app.whenReady().then(iniciar);
}

app.on('window-all-closed', () => app.quit());

// --- Preferencias de la ventana (pantalla completa) ---------------------------------

const archivoPreferencias = () => path.join(app.getPath('userData'), 'escritorio.json');

function leerPreferencias() {
  try {
    return { pantallaCompleta: false, ...JSON.parse(fs.readFileSync(archivoPreferencias(), 'utf8')) };
  } catch {
    return { pantallaCompleta: false };
  }
}

function guardarPreferencias(preferencias) {
  try {
    fs.writeFileSync(archivoPreferencias(), JSON.stringify(preferencias, null, 2));
  } catch (e) {
    console.warn('ORBE: no se pudieron guardar las preferencias de la ventana', e);
  }
}

// --- Archivos del juego ------------------------------------------------------------

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.tmj': 'application/json',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/** app://orbe/<ruta> → dist/<ruta>. Nada fuera de dist/. */
function servirJuego() {
  protocol.handle(ESQUEMA, async (pedido) => {
    const url = new URL(pedido.url);
    const relativo = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const archivo = path.normalize(path.join(DIST, relativo));
    if (url.host !== 'orbe' || !archivo.startsWith(DIST + path.sep)) return new Response('No encontrado', { status: 404 });
    try {
      const datos = await fs.promises.readFile(archivo);
      const tipo = TIPOS[path.extname(archivo).toLowerCase()] ?? 'application/octet-stream';
      return new Response(datos, { headers: { 'content-type': tipo, 'content-length': String(datos.length) } });
    } catch {
      return new Response('No encontrado', { status: 404 });
    }
  });
}

// --- Permisos ----------------------------------------------------------------------

/** Lo que el juego puede pedir: la cámara (solo video), pantalla completa, mantener la pantalla encendida y copiar al portapapeles (panel de parámetros). */
const PERMITIDOS = new Set(['media', 'fullscreen', 'screen-wake-lock', 'clipboard-sanitized-write']);

function configurarPermisos() {
  const delJuego = (url) => typeof url === 'string' && url.startsWith(`${ORIGEN}/`);
  session.defaultSession.setPermissionRequestHandler((contenido, permiso, responder, detalles) => {
    const soloVideo = permiso !== 'media' || !(detalles.mediaTypes ?? []).includes('audio');
    responder(delJuego(contenido.getURL()) && PERMITIDOS.has(permiso) && soloVideo);
  });
  session.defaultSession.setPermissionCheckHandler((_contenido, permiso, origen) => delJuego(`${origen}/`) && PERMITIDOS.has(permiso));
}

// --- Ventana -----------------------------------------------------------------------

/** Ventana del juego y ventana de control (una sola de cada una). */
let ventanaJuego = null;
let ventanaControl = null;

const PREFERENCIAS_WEB = {
  preload: path.join(__dirname, 'preload.cjs'),
  contextIsolation: true,
  sandbox: true,
  // El juego sigue (detección y música) aunque la ventana no tenga el foco.
  backgroundThrottling: false,
};

/** Atajos que valen en las dos ventanas: Ctrl+Q sale, Ctrl+Shift+I abre las herramientas de desarrollo. */
function atajosComunes(ventana) {
  ventana.webContents.on('before-input-event', (evento, tecla) => {
    if (tecla.type !== 'keyDown') return;
    const ctrl = tecla.control || tecla.meta;
    if (ctrl && tecla.key.toLowerCase() === 'q') {
      evento.preventDefault();
      app.quit();
    } else if (ctrl && tecla.shift && tecla.key.toLowerCase() === 'i') {
      evento.preventDefault();
      ventana.webContents.toggleDevTools();
    }
  });
}

/** En el kiosco, la pantalla externa (monitor o proyector) si hay; si no, la principal. `--pantalla=N` elige a mano. */
function pantallaDelKiosco() {
  const pantallas = screen.getAllDisplays();
  const pedida = process.argv.find((a) => a.startsWith('--pantalla='));
  if (pedida) {
    const n = Number(pedida.split('=')[1]);
    if (pantallas[n]) return pantallas[n];
  }
  const principal = screen.getPrimaryDisplay();
  return pantallas.find((p) => !p.internal && p.id !== principal.id) ?? pantallas.find((p) => !p.internal) ?? principal;
}

function crearVentana() {
  const preferencias = leerPreferencias();
  const pantalla = kiosco ? pantallaDelKiosco() : screen.getPrimaryDisplay();
  const area = pantalla.workArea;
  const ancho = Math.min(1280, area.width);
  const alto = Math.min(720, area.height);
  const ventana = new BrowserWindow({
    title: 'ORBE',
    x: Math.round(area.x + (area.width - ancho) / 2),
    y: Math.round(area.y + (area.height - alto) / 2),
    width: ancho,
    height: alto,
    backgroundColor: '#000000',
    show: false,
    fullscreen: kiosco || preferencias.pantallaCompleta,
    kiosk: kiosco,
    autoHideMenuBar: true,
    webPreferences: PREFERENCIAS_WEB,
  });
  ventanaJuego = ventana;

  ventana.once('ready-to-show', () => ventana.show());
  // Cerrar el juego cierra todo (también la ventana de control).
  ventana.on('closed', () => {
    ventanaJuego = null;
    app.quit();
  });
  atajosComunes(ventana);
  // La ventana de control la abre el juego con window.open (F4 o el panel ⚙): se crea acá, en su pantalla.
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (new URL(url).searchParams.has('control') && url.startsWith(`${ORIGEN}/`)) abrirVentanaControl();
    return { action: 'deny' };
  });
  const avisarPantalla = () => ventana.webContents.send('orbe:pantalla-completa', ventana.isFullScreen());
  ventana.on('enter-full-screen', avisarPantalla);
  ventana.on('leave-full-screen', avisarPantalla);

  ventana.webContents.on('before-input-event', (evento, tecla) => {
    if (tecla.type !== 'keyDown') return;
    if (tecla.key === 'F11' && !kiosco) {
      evento.preventDefault();
      ponerPantallaCompleta(ventana, !ventana.isFullScreen());
    }
  });

  if (kiosco) {
    // Sin cursor: se juega con el cuerpo, frente a un monitor o proyector.
    ventana.webContents.on('did-finish-load', () => ventana.webContents.insertCSS('* { cursor: none !important; }'));
  }

  ventana.loadURL(`${ORIGEN}/index.html`);
  return ventana;
}

/** Pantalla para la ventana de control: la principal, salvo que ahí esté el juego en el kiosco y haya otra. */
function pantallaDelControl() {
  const principal = screen.getPrimaryDisplay();
  if (!kiosco) return principal;
  const delJuego = pantallaDelKiosco();
  if (delJuego.id !== principal.id) return principal;
  return screen.getAllDisplays().find((p) => p.id !== delJuego.id) ?? principal;
}

function abrirVentanaControl() {
  if (ventanaControl) {
    if (ventanaControl.isMinimized()) ventanaControl.restore();
    ventanaControl.focus();
    return;
  }
  const area = pantallaDelControl().workArea;
  const ancho = Math.min(1200, area.width);
  const alto = Math.min(860, area.height);
  const ventana = new BrowserWindow({
    title: 'ORBE · Control',
    x: Math.round(area.x + (area.width - ancho) / 2),
    y: Math.round(area.y + (area.height - alto) / 2),
    width: ancho,
    height: alto,
    backgroundColor: '#0b0b0b',
    autoHideMenuBar: true,
    webPreferences: PREFERENCIAS_WEB,
  });
  ventanaControl = ventana;
  ventana.on('closed', () => {
    ventanaControl = null;
  });
  atajosComunes(ventana);
  ventana.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  ventana.loadURL(`${ORIGEN}/index.html?control`);
}

function ponerPantallaCompleta(ventana, completa) {
  if (kiosco) return;
  ventana.setFullScreen(completa);
  guardarPreferencias({ ...leerPreferencias(), pantallaCompleta: completa });
}

// --- Puente con el juego (ver preload.cjs) ------------------------------------------

function configurarPuente() {
  ipcMain.on('orbe:info', (evento) => {
    const ventana = BrowserWindow.fromWebContents(evento.sender);
    evento.returnValue = {
      kiosco,
      version: app.getVersion(),
      plataforma: process.platform,
      pantallaCompleta: ventana?.isFullScreen() ?? false,
    };
  });
  ipcMain.on('orbe:poner-pantalla-completa', (evento, completa) => {
    const ventana = BrowserWindow.fromWebContents(evento.sender);
    if (ventana) ponerPantallaCompleta(ventana, Boolean(completa));
  });
  ipcMain.on('orbe:salir', () => app.quit());
}

// --- Actualizaciones ----------------------------------------------------------------

/**
 * Al abrir, busca una versión nueva en GitHub Releases, la baja y la instala al cerrar.
 * Solo en el instalador de Windows y el AppImage de Linux (el portable se baja a mano, y en macOS
 * hace falta firmar la app).
 */
function buscarActualizacion() {
  const actualizable =
    app.isPackaged &&
    !process.env.PORTABLE_EXECUTABLE_DIR &&
    (process.platform === 'win32' || (process.platform === 'linux' && process.env.APPIMAGE));
  if (!actualizable) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.checkForUpdatesAndNotify().catch((e) => console.warn('ORBE: no se pudo buscar una actualización', e));
  } catch (e) {
    console.warn('ORBE: actualizaciones no disponibles', e);
  }
}

// --- Inicio --------------------------------------------------------------------------

async function iniciar() {
  // Sin menú (y sin sus atajos, como recargar con Ctrl+R).
  Menu.setApplicationMenu(null);
  servirJuego();
  configurarPermisos();
  configurarPuente();
  // En macOS el sistema pide permiso de cámara a la app.
  if (process.platform === 'darwin') await systemPreferences.askForMediaAccess('camera').catch(() => false);
  // Se juega sin tocar el teclado ni el mouse: que la pantalla no se apague mientras el juego está abierto.
  powerSaveBlocker.start('prevent-display-sleep');
  crearVentana();
  if (abrirControlAlInicio) abrirVentanaControl();
  buscarActualizacion();
}
