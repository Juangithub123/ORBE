// Copia los archivos wasm de MediaPipe desde node_modules a public/mediapipe/wasm,
// para que el juego los cargue localmente (sin CDN, y así el ejecutable funciona sin internet).
// Se ejecuta solo antes de `npm run dev` y `npm run build` (scripts predev / prebuild).
// Los modelos (.task) ya están en public/mediapipe/models y se guardan en el repo.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origen = join(raiz, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const destino = join(raiz, 'public', 'mediapipe', 'wasm');

const ARCHIVOS = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

mkdirSync(destino, { recursive: true });
for (const archivo of ARCHIVOS) {
  const de = join(origen, archivo);
  const a = join(destino, archivo);
  if (!existsSync(de)) throw new Error(`No se encontró ${de}. ¿Corriste npm install?`);
  if (existsSync(a) && statSync(a).size === statSync(de).size) continue;
  copyFileSync(de, a);
  console.log(`MediaPipe: copiado ${archivo}`);
}
