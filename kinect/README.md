# ORBE con Kinect v1 (TouchDesigner como puente)

Para la videoinstalación, el juego puede usar un **Kinect v1** para seguir a las dos personas. El Kinect lo lee **TouchDesigner** (con el SDK 1.8 de Microsoft, como cualquier proyecto con el Kinect CHOP) y le manda los esqueletos al juego por **WebSocket**, unas 30 veces por segundo. El juego funciona igual que con la webcam: zona de juego calibrable, filtro de suavizado, pausa si falta alguien y los esqueletos dibujados sobre el juego.

```
Kinect v1 ──► TouchDesigner (Kinect CHOP → Execute DAT → Web Server DAT, puerto 9980) ──WebSocket──► ORBE
```

TouchDesigner y el juego van en **la misma computadora** (web o escritorio).

## 1. Armar el proyecto de TouchDesigner

Se puede hacer en un proyecto nuevo o dentro de uno que ya tengas. Son tres operadores:

### a) Kinect CHOP → `kinect_orbe`

1. Agregá un **Kinect CHOP** (o usá el que ya tenés).
2. En sus parámetros:
   - **Hardware Version:** Kinect v1.
   - **Skeleton:** *Full* (no *Seated*).
   - **Max Players** (o *Players*): **2**. El Kinect v1 sigue dos esqueletos completos a la vez.
   - Activá **Color Space Positions** (posición de cada articulación en la imagen de color: canales `u` y `v`). Si tu versión no la tiene, alcanza con las posiciones en el mundo (`tx`, `ty`, `tz`): el juego las proyecta solo.
3. Renombralo **`kinect_orbe`**. Si preferís no tocar el tuyo, poné después un **Null CHOP** (o un Select CHOP) y renombrá ese.

Los canales se llaman como `p1/spine:u`, `p1/hand_l:v`, etc. El juego acepta las variantes de nombres de las distintas versiones del CHOP.

### b) Web Server DAT → `servidor_orbe`

1. Agregá un **Web Server DAT** y renombralo **`servidor_orbe`**.
2. **Port:** `9980`. **Active:** encendido.
3. Junto a él se crea un DAT de callbacks (por ejemplo `servidor_orbe_callbacks`). Abrilo, borrá lo que tiene y pegá el contenido de [`servidor_orbe.py`](servidor_orbe.py).

### c) Execute DAT → manda los esqueletos

1. Agregá un **Execute DAT** (el nombre no importa).
2. Borrá lo que tiene y pegá el contenido de [`enviar_esqueletos.py`](enviar_esqueletos.py).
3. En sus parámetros: **Active** encendido y **Frame End** encendido.

Guardá el proyecto (por ejemplo, `orbe_kinect.toe`).

## 2. Probar la conexión

1. Con TouchDesigner abierto, entrá en el navegador a **http://localhost:9980**: tiene que decir *"ORBE: servidor del Kinect andando"*.
2. Abrí el juego (el link web, la app de escritorio o `npm run dev`) y en **Ajustes → Entrada** elegí **Kinect (2 personas)**. También sirve el link con `?entrada=kinect`: https://juangithub123.github.io/ORBE/?entrada=kinect
3. Abajo, en Ajustes, tiene que decir **"Kinect conectado (TouchDesigner) · personas detectadas: N"**. En el textport de TouchDesigner aparece *"ORBE: se conectó el juego"*.

Si TouchDesigner se cierra o se corta, el juego se pausa y se reconecta solo cuando vuelve.

## 3. Ajustar en el juego

- **Calibrar zona de juego** (Ajustes [4]): qué parte de la imagen del Kinect ocupa toda la pantalla. Conviene hacerlo una vez en el lugar de la instalación.
- **Punto del Kinect** (Ajustes [2]): columna (abajo del pecho, por defecto), centro de los hombros, cadera, cabeza o mano más alta.
- **Ajuste fino de altura:** en el panel ⚙, `kinectAjusteAltura` corre el punto hacia abajo (+) o hacia arriba (−), en % del largo del torso.
- **Espejar cámara** (Ajustes [3]): si al moverte a la derecha el anillo va a la izquierda.
- **Cámara en el juego** (Ajustes [5] o en la pausa): muestra los esqueletos sobre el juego (no hay imagen de cámara, solo los esqueletos).
- **Otro puerto:** `kinectPuerto` en el panel ⚙, o el link con `?kinect=localhost:9981`.

## 4. Que TouchDesigner pese lo menos posible

- **Modo perform:** **F1** entra en modo perform (no dibuja el editor ni las vistas previas) y **Esc** vuelve. Para que el proyecto abra directamente así, buscá la opción de abrir en modo perform en **Dialogs → Window Placement** (el nombre exacto cambia según la versión).
- **30 cuadros por segundo:** el Kinect da 30 por segundo; en la barra de tiempo de abajo poné **FPS = 30**.
- **Sin imagen:** el proyecto no necesita Kinect TOP ni ningún TOP. Cerrá los visores de los operadores.

## 5. Si algo no anda

| Qué pasa | Qué revisar |
|---|---|
| "No se pudo conectar con TouchDesigner" | TouchDesigner abierto, el Web Server DAT se llama `servidor_orbe`, está **Active** y en el puerto **9980** (o el que pongas en el juego). Probá http://localhost:9980 en el navegador. Después, en Ajustes, **R** reintenta. |
| Conecta pero "personas detectadas: 0" | El Kinect CHOP no está siguiendo esqueletos: pararse de frente a 1,5–3,5 m; *Skeleton: Full*. Con el medidor del juego (F3) se ven los mensajes por segundo que llegan: si llegan pero no hay personas, mandame los nombres de los canales del CHOP (se ven al abrir el operador) y los agrego. |
| El anillo se mueve al revés | Ajustes → **Espejar cámara**. |
| Los jugadores no llegan a los bordes | Ajustes → **Calibrar zona de juego**. |

## 6. Probar sin el Kinect

`npm run kinect:simular` levanta un simulador que hace de TouchDesigner (mismo puerto y formato) con dos cuerpos que se mueven. Sirve para probar el juego en cualquier computadora.
