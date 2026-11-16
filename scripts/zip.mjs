// Arma un .zip con el contenido de una carpeta (los archivos quedan en la raíz del zip, como pide itch.io
// para un juego web: index.html arriba de todo). Sin dependencias, para que ande igual en Windows, macOS
// y Linux: `node scripts/zip.mjs <carpeta> <archivo.zip>`. `{version}` en el nombre se cambia por la de package.json.

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const [carpeta, nombreSalida] = process.argv.slice(2);
if (!carpeta || !nombreSalida) {
  console.error('Uso: node scripts/zip.mjs <carpeta> <archivo.zip>');
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const salida = nombreSalida.replace('{version}', version);

function archivos(dir) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

/** Fecha MS-DOS del 1/1/1980: algunos programas se quejan de una fecha en cero. */
const FECHA = (1 << 5) | 1;

const locales = [];
const central = [];
let posicion = 0;
const lista = archivos(carpeta).sort();
for (const ruta of lista) {
  const nombre = Buffer.from(relative(carpeta, ruta).split(sep).join('/'), 'utf8');
  const datos = readFileSync(ruta);
  const comprimido = deflateRawSync(datos, { level: 9 });
  // Si comprimir no achica (modelos, wasm ya comprimidos), se guarda tal cual.
  const guardar = comprimido.length >= datos.length;
  const cuerpo = guardar ? datos : comprimido;
  const metodo = guardar ? 0 : 8;
  const crc = crc32(datos);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // versión necesaria
  local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
  local.writeUInt16LE(metodo, 8);
  local.writeUInt16LE(0, 10); // hora
  local.writeUInt16LE(FECHA, 12); // 1/1/1980 (la fecha no importa)
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(cuerpo.length, 18);
  local.writeUInt32LE(datos.length, 22);
  local.writeUInt16LE(nombre.length, 26);
  local.writeUInt16LE(0, 28);
  locales.push(local, nombre, cuerpo);

  const entrada = Buffer.alloc(46);
  entrada.writeUInt32LE(0x02014b50, 0);
  entrada.writeUInt16LE(20, 4);
  entrada.writeUInt16LE(20, 6);
  entrada.writeUInt16LE(0x0800, 8);
  entrada.writeUInt16LE(metodo, 10);
  entrada.writeUInt16LE(0, 12);
  entrada.writeUInt16LE(FECHA, 14);
  entrada.writeUInt32LE(crc, 16);
  entrada.writeUInt32LE(cuerpo.length, 20);
  entrada.writeUInt32LE(datos.length, 24);
  entrada.writeUInt16LE(nombre.length, 28);
  entrada.writeUInt32LE(posicion, 42);
  central.push(entrada, nombre);
  posicion += local.length + nombre.length + cuerpo.length;
}

const tamanoCentral = central.reduce((suma, b) => suma + b.length, 0);
const fin = Buffer.alloc(22);
fin.writeUInt32LE(0x06054b50, 0);
fin.writeUInt16LE(lista.length, 8);
fin.writeUInt16LE(lista.length, 10);
fin.writeUInt32LE(tamanoCentral, 12);
fin.writeUInt32LE(posicion, 16);

mkdirSync(dirname(salida) || '.', { recursive: true });
const zip = Buffer.concat([...locales, ...central, fin]);
writeFileSync(salida, zip);
console.log(`${salida}: ${lista.length} archivos, ${(zip.length / 1e6).toFixed(1)} MB`);
