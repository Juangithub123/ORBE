// Tiempo máximo para un paso del arranque de la cámara: si algo se cuelga (permiso, modelo, GPU, video),
// se informa en vez de quedar esperando para siempre.

/** Un paso del arranque tardó más de lo esperado. */
export class TardoDemasiado extends Error {}

/** Rechaza con `mensaje` si la promesa no termina en `ms`. */
export function conLimite<T>(promesa: Promise<T>, ms: number, mensaje: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const limite = new Promise<never>((_, rechazar) => {
    timer = setTimeout(() => rechazar(new TardoDemasiado(mensaje)), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(timer));
}
