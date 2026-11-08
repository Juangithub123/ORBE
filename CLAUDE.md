# ORBE — notas para Claude Code

Leé primero el [README](README.md): estado del desarrollo, lógica del juego, estructura y comandos.

## Convenciones

- Todo en **español**: código (nombres de variables y funciones), comentarios y textos. Lo que ve el jugador, en español rioplatense ("tocá", "elegí").
- Cada archivo empieza con un comentario que explica qué hace y por qué. Comentar el *por qué*, no el *qué*.
- Los números ajustables van en `src/config.ts` con un comentario `/** ... */` de una línea: el panel ⚙ los lee de ahí (secciones `// --- Nombre ---`).
- La lógica pura (sin Phaser ni DOM) va en módulos aparte y con tests en `tests/` (Vitest).
- Dependencias con versión exacta en `package.json`.
- Commits en español, con un resumen y una lista de cambios.

## Antes de subir cambios

```bash
npm run typecheck && npm test && npm run build
```

Para la versión de escritorio: `npm run escritorio` (abre la app) y `npm run dist:win` en Windows (arma el instalador y el portable en `release/`).

## Probar sin cámara ni manos

- Modo teclado: WASD mueve a P1 y las flechas a P2; P simula que falta un jugador.
- `?entrada=teclado`, `?nivel=2`, `?perfil=liviano` en la URL (ver README).
- En desarrollo (`npm run dev`), `window.orbe` es el juego y `window.orbeAudio` el motor de audio, para inspeccionar desde la consola.
- Modo Kinect sin sensor: `npm run kinect:simular` (hace de TouchDesigner) y `?entrada=kinect`.
- Playwright con `--use-fake-device-for-media-stream` da una cámara simulada (sin manos: para probar la detección se puede reemplazar `detectar` de la fuente).

## Publicar

- Web: push a `main` → GitHub Pages.
- Escritorio: subir `version` en `package.json`, mergear a `main` y publicar: Actions → "Versión de escritorio" → Run workflow con "publicar" (o subir el tag `vX.Y.Z`) → GitHub Actions publica en Releases.
