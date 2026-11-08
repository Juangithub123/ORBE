# Guía de rendimiento: ORBE + TouchDesigner (Kinect) + Handtrack en la misma PC

Objetivo: las tres cosas andando a la vez, cada una en su pantalla, a **25-30 cuadros por segundo** estables.

PC medida (noviembre 2026): **AMD A8-9600** (4 núcleos, el límite real) · **GTX 1060 6 GB** (le sobra) · 8 GB de RAM.

## Cómo está repartida la CPU

La CPU tiene 4 hilos, o sea 400% en total. La placa de video casi no trabaja: 27-40% de uso y a 600-700 MHz. Por eso **todo se traba por CPU, no por GPU**: cuando la CPU llega al 100%, las tres aplicaciones pierden cuadros a la vez y el audio de ORBE se corta.

Medido con las tres andando juntas (en % de un núcleo, sobre 400):

| | Antes | Después de los ajustes |
|---|---|---|
| ORBE (menú/juego, modo liviano) | 130-155 | 75-105 |
| Handtrack (1 modelo: pose) | 145-150 | ~120 |
| TouchDesigner (Kinect) | 60-190 (según el editor) | 55-100 |
| Camo + OBS (para que llegue la cámara) | ~55 | ~20 (sin Camo; sigue OBS) |
| Administrador de tareas + Claude | 30-45 | (se cierran en la función) |
| **CPU total** | **99-100%** | **~78%** |

Handtrack con los ajustes: cámara 30 fps · render 30 fps · detección ~16/s (pose lite, ~30 ms).

## Lo que ya quedó configurado

**ORBE** (se guarda en la PC, no hay que repetirlo):
- Modo **liviano**: audio a 32 kHz, una sola reverb y un drone simple (el audio pasó de ~78% a ~36% de un núcleo).
- **Tope de 30 cuadros por segundo** (`fpsMax = 30` en el panel ⚙). Se puede volver a 60 desde el panel si la PC queda libre.
- Esqueleto del Kinect arreglado (ver [`kinect/README.md`](../kinect/README.md)).

**Handtrack** (Rendimiento, en la ventana de controles; se guarda solo):
- Resolución de los efectos 0,75 · tope de render **30** · tope de inferencias **20** · imagen para los modelos **640 px** · preview de cámara pausado.
- Cámara a **640×480** a 30 fps: el modelo ve 640 px igual, así que una imagen más grande solo gasta CPU en decodificarla.

## Lo que tenés que hacer vos

Ordenado de lo que más rinde a lo que menos.

### 1. Windows y la placa de video (una sola vez)

- **Plan de energía "Alto rendimiento"**: hoy está en *Equilibrado*, y el A8 baja su frecuencia. Panel de control → Opciones de energía → *Alto rendimiento*, o en una terminal como administrador:
  ```
  powercfg /setactive SCHEME_MIN
  ```
- **NVIDIA: "Preferir rendimiento máximo"**: la placa se queda en 600-700 MHz, y eso hace más lenta la detección de MediaPipe, que corre en la GPU. Panel de control de NVIDIA → Administrar la configuración 3D → Configuración global → *Modo de control de energía* → **Preferir rendimiento máximo**.
- Configuración → Sistema → Pantalla → **Gráficos**: agregá `ORBE.exe`, `Handtrack Experimentos.exe` y `TouchDesigner.exe` en **Alto rendimiento**.
- Si Windows ofrece "Modo de juego", dejalo activado.

### 2. La cámara de Handtrack: sin OBS en el medio

Hoy la imagen hace **teléfono → Camo → OBS → OBS Virtual Camera → Handtrack**. Camo y OBS juntos gastan ~0,5 núcleo. Si OBS no hace nada más (recortar, rotar), elegí la cámara **Camo** directamente en Handtrack (Cámara → Camo) y cerrá OBS. Mejor todavía: una **webcam USB** común, que gasta menos que Camo.

Ojo: el Kinect v1 y una webcam en el mismo puerto/controlador USB 2.0 pueden pelearse por el ancho de banda. Si la cámara o el Kinect se cortan, enchufalos en puertos de lados distintos de la PC.

### 3. TouchDesigner

Detalle en [`kinect/README.md`](../kinect/README.md), sección 4. Lo principal:
- **Un solo Kinect CHOP.** Borrá o poné en *Bypass* el Kinect TOP (`kinect2`) y el CHOP de más (`kinect1`).
- **Modo perform** (F1) o, como mínimo, sin visores abiertos.
- **FPS = 30** en la barra de tiempo.
- Pegá el `enviar_esqueletos.py` nuevo en el Execute DAT.

### 4. Handtrack: uno o dos modelos, no más

Cada modelo (manos, pose, cara, segmentación) es una detección aparte en cada cuadro. Con uno anda a ~16 detecciones por segundo en esta PC; con dos, esperá unas 10-12 por cada uno.
- Usá **una capa** (o dos que pidan el mismo modelo). Una escena con *Partículas* (manos) y *Debug* con pose prendida corre los dos modelos.
- **Pose lite**, nunca full. **Personas máximo: 1** si alcanza.
- Partículas: **8.000-12.000**, no 25.000 (el preset "Partículas" viene con 25.000).
- Si con dos modelos el render baja de 25: tope de inferencias **15** e imagen para los modelos **480 px** (sirve si la gente está cerca de la cámara).
- *Mostrar cámara de fondo* apagado si no hace falta, y la ventana de controles **minimizada** durante la función.

### 5. Durante la función

- Cerrá el **Administrador de tareas**, **Claude**, el navegador y todo lo que no sea parte de la obra.
- ORBE: elegí **modo liviano** al iniciar.
- Abrí las tres en este orden: TouchDesigner (y esperá a que el Kinect detecte) → ORBE → Handtrack.

## Cómo medir

- **ORBE:** F3 muestra los cuadros por segundo reales y el tope ("FPS 30 (tope 30)"). La versión 0.3.2 del portable todavía muestra los de la pantalla (60); se arregla en la próxima compilación.
- **Handtrack:** ventana de controles → Rendimiento: Cámara, Inferencia, Render y ms por modelo. O "Mostrar stats en la proyección".
- **Todo junto:** Administrador de tareas → Rendimiento → CPU. **Mantenela por debajo de ~85%**: arriba de eso las tres aplicaciones empiezan a perder cuadros a la vez. (Cerralo después de mirar: también gasta.)

Si con todo esto la CPU sigue arriba del 90%, en orden: sacá la música de ORBE (volumen de música a 0 en el panel ⚙ no alcanza, porque el audio se sigue calculando: pedime que agregue un "sin música"), bajá Handtrack a tope de inferencias 15, y como última opción, una CPU de 6 núcleos o más resolvería todo. La GTX 1060 alcanza de sobra.
