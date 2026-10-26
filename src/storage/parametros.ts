import { CONFIG, type Config } from '../config';

// Parámetros del panel de control (config.ts) cambiados a mano desde el juego.
// Se guardan en localStorage solo los que difieren del valor original de config.ts,
// así un cambio en config.ts sigue valiendo para todo lo que no se tocó en el panel.

const CLAVE = 'orbe.parametros';

/** No se editan desde el panel: la resolución exige recargar, y espejar/volumen ya están en Ajustes. */
const EXCLUIDOS = new Set(['ancho', 'alto', 'espejar', 'volumenGeneral']);

export type ClaveParametro = keyof Config;
export type ValorParametro = number | boolean;

export interface DefParametro {
  clave: ClaveParametro;
  seccion: string;
  descripcion: string;
}

/** Valores de config.ts antes de aplicar los cambios guardados. */
export const ORIGINALES: Readonly<Config> = { ...CONFIG };

/**
 * Lee las secciones (`// --- Nombre ---`) y los comentarios (`/** ... *\/`) del código de config.ts,
 * para que el panel muestre las mismas explicaciones sin repetirlas en otro lado.
 */
export function leerDefiniciones(fuente: string, valores: Record<string, unknown>): DefParametro[] {
  const defs: DefParametro[] = [];
  let seccion = '';
  let descripcion = '';
  for (const linea of fuente.split('\n')) {
    const s = linea.match(/^\s*\/\/\s*---\s*(.+?)\s*-*\s*$/);
    if (s) {
      seccion = s[1];
      descripcion = '';
      continue;
    }
    const d = linea.match(/^\s*\/\*\*\s*(.*?)\s*\*\/\s*$/);
    if (d) {
      descripcion = d[1];
      continue;
    }
    const c = linea.match(/^\s*(\w+)\s*:/);
    if (c) {
      const clave = c[1];
      const tipo = typeof valores[clave];
      if ((tipo === 'number' || tipo === 'boolean') && !EXCLUIDOS.has(clave)) {
        defs.push({ clave: clave as ClaveParametro, seccion, descripcion });
      }
      descripcion = '';
    }
  }
  return defs;
}

/** Rango y paso del deslizador, deducidos del valor original. El campo numérico acepta cualquier valor. */
export function rango(original: number): { min: number; max: number; paso: number } {
  if (original === 0) return { min: 0, max: 100, paso: 1 };
  const decimales = (String(original).split('.')[1] ?? '').length;
  if (Number.isInteger(original)) return { min: 0, max: Math.max(10, original * 4), paso: 1 };
  if (original < 0.1) return { min: 0, max: original * 10, paso: 10 ** -(decimales + 1) };
  if (original < 1) return { min: 0, max: 1, paso: 0.01 };
  return { min: 0, max: original * 4, paso: 10 ** -decimales };
}

/** Aplica los cambios guardados sobre CONFIG. Se llama una vez, antes de crear el juego. */
export function cargarParametros() {
  let guardados: Record<string, unknown> = {};
  try {
    guardados = JSON.parse(localStorage.getItem(CLAVE) ?? '{}');
  } catch {
    // Sin localStorage o con datos rotos: quedan los valores de config.ts.
  }
  for (const [clave, valor] of Object.entries(guardados)) {
    if (clave in ORIGINALES && !EXCLUIDOS.has(clave) && typeof valor === typeof ORIGINALES[clave as ClaveParametro]) {
      setParametro(clave as ClaveParametro, valor as ValorParametro);
    }
  }
}

export function setParametro(clave: ClaveParametro, valor: ValorParametro) {
  (CONFIG as Record<ClaveParametro, ValorParametro>)[clave] = valor;
}

/** Parámetros que difieren de config.ts. */
export function cambios(): Partial<Record<ClaveParametro, ValorParametro>> {
  const r: Partial<Record<ClaveParametro, ValorParametro>> = {};
  for (const clave of Object.keys(ORIGINALES) as ClaveParametro[]) {
    if (CONFIG[clave] !== ORIGINALES[clave]) r[clave] = CONFIG[clave];
  }
  return r;
}

export function guardarParametros() {
  try {
    const c = cambios();
    if (Object.keys(c).length === 0) localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, JSON.stringify(c));
  } catch {
    // Sin localStorage: los cambios duran hasta cerrar el juego.
  }
}
