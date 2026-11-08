# ORBE – La salida es colectiva

Arcade cooperativo para dos jugadores que juegan con el cuerpo. La cámara (o un Kinect v1, para la videoinstalación) sigue a los dos (dos manos de una persona, o dos personas enteras) y entre ellos aparece un **orbe**: está en el punto medio y es **más grande cuanto más cerca están**. Juntos tienen que guiarlo hacia arriba por un nivel que avanza solo, esquivando rocas, rompiendo las frágiles (hace falta un orbe grande, o sea, estar cerca) y juntando monedas, hasta la meta.

Es la versión web y de escritorio de un juego que primero se hizo en TouchDesigner (las capturas de referencia están en `docs/referencias/`).

- **Jugar en el navegador:** https://juangithub123.github.io/ORBE/
- **Bajar la versión de escritorio** (Windows, macOS, Linux): [GitHub Releases](https://github.com/Juangithub123/ORBE/releases)

---

## Estado del desarrollo

Las seis fases del plan original están hechas, más varias mejoras pedidas después.

| Fase | Qué incluye | Estado |
|---|---|---|
| F1 | Esqueleto: Vite + Phaser 4 + TypeScript, panel de control (`config.ts`), cálculo del orbe, entrada por teclado, todas las escenas conectadas | ✅ |
| F2 | Nivel jugable: niveles de Tiled, colisiones, scroll con aceleración, rocas sólidas y frágiles, monedas, meta, vidas, bloom | ✅ |
| F3 | Estados: cuenta regresiva, pausa si falta un jugador, resultado con reinicio acercándose | ✅ |
| F4 | Cámara con MediaPipe: Manos (2 manos) y Pose (2 personas), calibración de la zona de juego | ✅ |
| F5 | Nombre del dúo atrapando letras que caen, ranking top 10, botones que se llenan con el orbe | ✅ |
| F6 | Audio: banda sonora tecno industrial generada en vivo (Tone.js) que crece por nivel, efectos sintetizados | ✅ |

Agregados después:

- Panel de parámetros en vivo (⚙ o F2), selector de modo **liviano / completo** al inicio, medidor de rendimiento (F3).
- Resolución de dibujo (más nítido sin cambiar la lógica de 1280×720), pantalla completa o ventana.
- Carga de la cámara por etapas con barras, MB y velocidad; mensajes claros si falta el permiso.
- Cámara y esqueleto de MediaPipe **sobre el juego** (o miniatura), elegible en la pausa.
- Filtro **One Euro** para la captura, centro de la palma, torso según visibilidad, modelo de pose "full" en el modo completo.
- Pausa con Esc (seguir, volumen, cámara, volver al menú).
- **Versión de escritorio** con Electron: instalador y portable de Windows, macOS y Linux, modo kiosco, selector de webcam, actualización automática.
- **Kinect v1** para la videoinstalación, con TouchDesigner como puente: ver [`kinect/README.md`](kinect/README.md).

Probado con cámara simulada en navegadores sin GPU (Playwright). **Falta probar a fondo con cámaras y GPU reales** (la tablet Android y la PC con RTX 3060): ver [Pendientes](#pendientes).

---

## Cómo se juega

1. **Inicio:** se elige el modo (liviano para celulares y tablets, completo para computadoras). Ese toque también habilita audio, cámara y pantalla completa.
2. **Menú:** Jugar, Ranking, Ajustes. Los botones se activan **manteniendo el orbe encima** 1,5 s (o con un clic, o con su tecla).
3. **Nombre del dúo:** caen letras; se atrapan tocándolas con el orbe. ⌫ borra una, BORRAR borra todo, OK confirma.
4. **Nivel:** el nivel sube solo y cada vez más rápido. Tocar una roca resta una vida (10 por partida, no se recargan). Las rocas naranjas (frágiles) se rompen con el orbe grande. Las monedas suman 10 puntos. Al cruzar la franja verde se pasa al nivel siguiente.
5. **Si falta un jugador**, el juego se pausa solo y sigue con cuenta regresiva cuando vuelven los dos. **Esc** abre la pausa a pedido.
6. **Resultado:** ¡GANARON! o GAME OVER. La partida entra al ranking si está en el top 10. Acercarse entre sí reinicia con el mismo dúo.

Hay 3 niveles: *Primer paso*, *Juntos rompemos* y *La salida*.

---

## Lógica del juego

### Escenas (`src/scenes/`)

```
Boot → Start (modo) → Menu ─┬─ NameEntry → Game ⇄ LevelTransition → Result → Leaderboard
                            ├─ Leaderboard
                            └─ Settings ⇄ Calibration
Game lanza encima: Pause (falta un jugador) y PauseMenu (Esc)
```

- `BootScene`: carga los niveles (`public/levels/niveles.json` + `.tmj`), lee los ajustes y crea el `InputManager`.
- `StartScene`: selector de modo. En el kiosco de escritorio arranca solo.
- `GameScene`: el nivel. Estados: `cuenta`, `jugando`, `pausa` (falta alguien), `menu` (Esc), `completo`, `perdido`.
- Los datos de la partida (`RunState`: dúo, puntaje, vidas, nivel) viajan entre escenas por el registry de Phaser (`shared.ts`).

### Entrada (`src/input/`)

El juego solo conoce el `InputManager`. Por cada frame:

1. **Fuente** (`PlayerInput`): `KeyboardInput` (WASD = P1, flechas = P2, P simula que falta uno), `HandsInput` o `PoseInput` (ambas heredan de `CameraInput`), o `KinectInput` (esqueletos de un Kinect v1 que manda TouchDesigner por WebSocket; lectura en `kinect.ts`, guía en `kinect/README.md`).
2. Los jugadores se ordenan por x (P1 siempre a la izquierda).
3. **Filtro One Euro** (`unoEuro.ts`) por jugador, una vez por cada detección nueva: saca el temblor sin agregar retardo en movimientos rápidos.
4. **Zona de juego** (calibrada en Ajustes): la parte de la imagen de la cámara que ocupa toda la pantalla, para no tener que moverse tanto.
5. **Suavizado por frame** (`suavizado`): une las detecciones (unas 30 por segundo) en un movimiento continuo.
6. **Presencia con histéresis**: un jugador se considera ausente después de 400 ms sin detectarlo.
7. **Orbe** (`game/orb.ts`, función pura): centro = promedio de los dos; radio de `radioMax` (cerca, a menos de `distCerca`) a `radioMin` (lejos, a más de `distLejos`).

**Cámara (`CameraInput.ts`):** una sola cámara compartida por Manos y Pose (cambiar entre ellas no vuelve a pedir permiso). El motor de MediaPipe (wasm) y el modelo se descargan desde el juego con barra de progreso (`carga.ts`, `PanelCarga.ts`) y se le pasan ya descargados. La detección corre en su propio ciclo (`requestVideoFrameCallback`), una vez por imagen nueva o menos si el modo lo limita. Primero intenta con GPU; si no responde en 20 s, usa la CPU.

**Qué punto es cada jugador (`puntos.ts`):** Manos, el centro de la palma (o la muñeca, como en TD). Pose, el centro del torso pesado por visibilidad (si las caderas no se ven, solo hombros) o la muñeca más alta visible.

### Niveles (`public/levels/`, `src/level/`)

Se dibujan en [Tiled](https://www.mapeditor.org/) (`orbe.tiled-project`), 1280 px de ancho. El nivel empieza abajo y se sube. Clases de objetos:

| Clase | Qué es |
|---|---|
| `piedra` | Roca sólida: resta una vida al tocarla |
| `piedra_fragil` | Roca frágil: se rompe si el orbe es más grande que `radioRomper` (o su propiedad `radioMin`) |
| `punto` | Moneda (un punto) |
| `final` | Meta (rectángulo verde) |

Propiedades del mapa: `nombre` y `velScrollInicial` (0 = la de `config.ts`). `parseTiled.ts` convierte rectángulos, elipses y polígonos (con rotación y desplazamientos de capa) a polígonos; `game/collisions.ts` hace círculo-polígono y círculo-círculo. Para agregar un nivel: crear el `.tmj` y sumarlo a `niveles.json`.

### Audio (`src/audio/`)

Todo se sintetiza en vivo con **Tone.js** (no hay archivos de audio). `musica.ts` es la partitura (pura, con tests): tecno industrial en Mi menor, 8 compases, capas que entran por nivel (nivel 1: bombo, bajo, hats y drone; nivel 2: claps, hats rápidos y línea acid; nivel 3: stabs y barridos de ruido). El tempo sube con el progreso de la partida (`bpmInicial` → `bpmFinal`); la música se abre y sube de volumen de nivel en nivel. En la pausa baja y se filtra. `AudioEngine.ts` arma los instrumentos y los efectos; se carga al primer clic.

### Rendimiento: modo liviano y completo (`src/perfil.ts`)

| | Liviano | Completo |
|---|---|---|
| Resolución automática | hasta 1280×720 | hasta 2560×1440 |
| Brillo (bloom) | no | sí |
| Detecciones por segundo | 20 | una por imagen (≈30) |
| Modelo de pose | lite | full |
| Cámara sobre el juego | 480×270 | 960×540 |
| Reverbs | cortas | largas |

Además, en los dos: máximo 60 cuadros por segundo (`fpsMax`), la pantalla no se apaga (Wake Lock) y la vista de la cámara se redibuja solo con imágenes nuevas. La lógica siempre trabaja en 1280×720: con más resolución, la cámara de Phaser hace zoom (`pantalla.ts`).

### Ajustes, parámetros y guardado

- **`src/config.ts`** es el panel de control: todos los números ajustables, con su explicación. El **panel ⚙** (o F2) los muestra y los cambia en vivo; los cambios quedan en el navegador y "Copiar cambios" da el JSON para pasarlos a `config.ts`.
- **Ajustes** (pantalla del juego): entrada, webcam, punto de pose, espejar, calibrar, cámara en el juego, resolución, pantalla, volumen, ranking.
- **Guardado** en `localStorage`: `orbe.ajustes`, `orbe.parametros`, `orbe.leaderboard`. En escritorio, además, `escritorio.json` en la carpeta de datos de la app (pantalla completa o ventana).

---

## Estructura

```
src/
  main.ts              Crea el juego (Phaser), el panel de parámetros y el medidor
  config.ts            Panel de control: todos los parámetros
  perfil.ts            Modo liviano / completo
  pantalla.ts          Resolución, pantalla completa, Wake Lock, orientación
  escritorio.ts        Puente con Electron (null en la web)
  scenes/              Una escena por pantalla (ver arriba)
  input/               Entrada: teclado, cámara (MediaPipe), filtro, carga, vista de la cámara
  game/                Orbe, partida, colisiones, reglas del nombre
  level/               Lectura de niveles de Tiled
  audio/               Música y efectos (Tone.js)
  storage/             Ajustes, parámetros y ranking (localStorage)
  ui/                  Botones, textos, HUD, paneles (parámetros, carga, rendimiento)
public/
  levels/              Niveles (.tmj) y proyecto de Tiled
  mediapipe/models/    Modelos de MediaPipe (manos, pose lite y full)
  mediapipe/wasm/      Motor de MediaPipe (se copia de node_modules al compilar; no está en git)
kinect/                Kinect v1 con TouchDesigner: guía y scripts para pegar en el proyecto de TouchDesigner
electron/              Versión de escritorio: main.cjs (ventana, protocolo, permisos, kiosco, actualizaciones) y preload.cjs
build/                 Ícono y agregados del instalador de Windows
tests/                 Tests (Vitest) de la lógica pura
scripts/               Copia del wasm de MediaPipe y simulador del Kinect
.github/workflows/     Publicación web (pages.yml) y de escritorio (escritorio.yml)
```

Convenciones: código, comentarios y textos en **español** (rioplatense en lo que ve el jugador). La lógica pura va en módulos sin Phaser y con tests. Cada archivo empieza con un comentario que explica qué hace.

---

## Comandos

Requiere Node 24.

```bash
npm install
npm run dev            # juego en el navegador con recarga automática (http://localhost:5173)
npm test               # tests
npm run typecheck      # chequeo de tipos
npm run build          # compila la versión web (dist/)
npm run kinect:simular # simulador del Kinect (hace de TouchDesigner) para probar el modo Kinect

npm run escritorio         # compila y abre la versión de escritorio
npm run escritorio:kiosco  # lo mismo, en modo kiosco
npm run dist:win           # arma el instalador y el portable de Windows en release/ (hay que correrlo en Windows)
npm run dist:mac           # .dmg (en macOS)
npm run dist:linux         # AppImage (en Linux)
```

**Parámetros en la URL** (web): `?entrada=pose|manos|kinect|teclado`, `?kinect=servidor:puerto`, `?perfil=liviano|completo`, `?nivel=N` (arranca en ese nivel con un dúo de prueba que no entra al ranking).

**Atajos de teclado:** F2 panel de parámetros · F3 medidor de rendimiento · Esc pausa / volver · en el juego, F1 depuración, N pasar de nivel, G invulnerable, 1 reiniciar · en modo teclado, P simula que falta un jugador · en escritorio, F11 pantalla completa, Ctrl+Q salir, Ctrl+Shift+I herramientas de desarrollo.

---

## Versión web

Cada push a `main` publica en GitHub Pages (`.github/workflows/pages.yml`): https://juangithub123.github.io/ORBE/

## Versión de escritorio (Electron)

El juego compilado con `vite build --mode electron` (rutas relativas) se sirve desde un protocolo propio, `app://orbe/`, para que las descargas con progreso del modelo y la carga de niveles funcionen como en la web. `electron/main.cjs`:

- concede el permiso de cámara (solo video, solo al juego);
- fuerza la **GPU dedicada** (notebooks con dos GPU) e ignora la lista de bloqueo de GPU de Chromium;
- una sola ventana; Ctrl+Q sale; F11 alterna pantalla completa y se recuerda;
- la pantalla no se apaga mientras el juego está abierto;
- **modo kiosco** (`--kiosco`, o un portable con "kiosco" en el nombre): pantalla completa en el **monitor o proyector externo** si hay (`--pantalla=N` elige otro), sin cursor, sin el engranaje del panel, arranca solo con el modo marcado. El instalador de Windows crea un acceso directo aparte, "ORBE (kiosco)".
- **actualización automática** al abrir (instalador de Windows y AppImage de Linux): baja la versión nueva de GitHub Releases y la instala al cerrar.

### Publicar una versión

1. Subir `version` en `package.json` (por ejemplo, a `0.3.0`) y mergear a `main`.
2. Publicarla, de cualquiera de estas dos formas:
   - en GitHub: **Actions → "Versión de escritorio" → Run workflow** (en `main`) → marcar **publicar**;
   - o subir el tag: `git tag v0.3.0 && git push origin v0.3.0`.
3. GitHub Actions (`escritorio.yml`) arma Windows, macOS y Linux y publica la versión en Releases (si no había tag, GitHub lo crea al publicar). Las versiones instaladas se actualizan solas.

En cada push a una rama que no sea `main`, el mismo workflow arma los tres sistemas sin publicar y deja los archivos para bajar en la ejecución de Actions (14 días), para probar antes.

### Notas por sistema

- **Windows:** la app no está firmada: la primera vez SmartScreen avisa "Windows protegió su PC" → *Más información* → *Ejecutar de todas formas*. En notebooks con dos GPU, si igual usa la integrada: Configuración → Sistema → Pantalla → Gráficos → ORBE → *Alto rendimiento*.
- **macOS:** sin firmar (hace falta una cuenta paga de Apple): la primera vez, clic derecho → *Abrir*. No se actualiza sola. macOS pide permiso de cámara.
- **Linux:** AppImage: darle permiso de ejecución (`chmod +x`).

---

## Pruebas

- `npm test`: lógica pura (orbe, colisiones, niveles, ranking, nombre, partitura, perfil, filtro, puntos de manos y pose, descargas, parámetros, resolución).
- Las pruebas en navegador y en Electron se hicieron con Playwright y cámara simulada (`--use-fake-device-for-media-stream`); no están automatizadas en el repo.

---

## Pendientes

- **Probar con cámaras y GPU reales** (tablet Android, PC con RTX 3060) y ajustar con el medidor (F3): FPS, ms y detecciones por segundo en cada modo.
- **MediaPipe en un Web Worker**, para que la detección no le saque tiempo al dibujo (la mejora de rendimiento más grande que queda).
- Más niveles y balance (velocidades, vidas, frecuencia de letras en el nombre).
- Firma de código (Windows y macOS) si se distribuye a más gente.
- Elegir la pantalla del kiosco desde Ajustes (hoy: la externa automática o `--pantalla=N`).
- Probar el modo Kinect con el sensor y TouchDesigner reales (está probado con el simulador). Alternativa futura: [Kinect-Remold](https://github.com/Spidoug/Kinect-Remold) (runtime nuevo con WebSocket propio; hoy sigue a una sola persona por defecto).

## Para seguir con Claude Code en una sesión local

Ver [`CLAUDE.md`](CLAUDE.md): convenciones del proyecto y cómo probar.
