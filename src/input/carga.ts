import { TardoDemasiado } from './limite';

// Etapas de la carga de la cámara (permiso, motor, modelo, detector), para mostrar cada una con su barra.
// Las descargas se hacen acá (y no dentro de MediaPipe) para poder medir los bytes y la velocidad.

/** Si una descarga pasa este tiempo sin recibir datos, se considera frenada. */
const DESCARGA_FRENADA_MS = 20_000;
/** Cada cuánto se recalcula la velocidad de descarga. */
const VENTANA_VELOCIDAD_MS = 500;

export type EstadoEtapa = 'pendiente' | 'en curso' | 'listo' | 'error';

export class Etapa {
  estado: EstadoEtapa = 'pendiente';
  /** Texto corto: "esperando permiso", "GPU", el motivo del error… */
  detalle = '';
  /** Si la etapa es una descarga, de acá salen los bytes y la velocidad. */
  descarga: Descarga | null = null;
  private inicio = 0;
  private fin = 0;

  constructor(readonly nombre: string) {}

  empezar(detalle = '') {
    this.estado = 'en curso';
    this.detalle = detalle;
    this.inicio = performance.now();
  }

  terminar(detalle = '') {
    this.estado = 'listo';
    this.detalle = detalle;
    this.fin = performance.now();
  }

  fallar(detalle: string) {
    this.estado = 'error';
    this.detalle = detalle;
    this.fin = performance.now();
  }

  /** Segundos que lleva (o que tardó). */
  get segundos() {
    if (this.estado === 'pendiente') return 0;
    return ((this.estado === 'en curso' ? performance.now() : this.fin) - this.inicio) / 1000;
  }

  /** Avance de 0 a 1, o null si no se sabe (etapas que no son descargas, o sin tamaño total). */
  get avance(): number | null {
    if (this.estado === 'listo') return 1;
    const d = this.descarga;
    if (!d || !d.total) return null;
    return Math.min(1, d.bytes / d.total);
  }
}

/** Descarga un archivo midiendo bytes y velocidad. */
export class Descarga {
  bytes = 0;
  /** Tamaño total según el servidor (0 si no lo informa, por ejemplo si viene comprimido). */
  total = 0;
  /** Bytes por segundo, medido en la última ventana. */
  velocidad = 0;
  readonly datos: Promise<Uint8Array>;
  private urlBlob: string | null = null;

  constructor(
    readonly url: string,
    private pedir: (url: string) => Promise<Response> = (u) => fetch(u),
    private frenadaMs = DESCARGA_FRENADA_MS,
  ) {
    this.datos = this.bajar();
  }

  /** URL local (blob:) con los datos ya descargados, para pasarle a MediaPipe. */
  async urlLocal(tipo: string) {
    const datos = await this.datos;
    this.urlBlob ??= URL.createObjectURL(new Blob([datos as BlobPart], { type: tipo }));
    return this.urlBlob;
  }

  private async bajar(): Promise<Uint8Array> {
    const respuesta = await this.pedir(this.url);
    if (!respuesta.ok) throw new Error(`No se pudo descargar ${this.url} (HTTP ${respuesta.status}).`);
    const largo = Number(respuesta.headers.get('content-length'));
    // Si viene comprimido, content-length es el tamaño comprimido: no sirve como total.
    this.total = respuesta.headers.get('content-encoding') ? 0 : largo || 0;
    if (!respuesta.body) {
      const datos = new Uint8Array(await respuesta.arrayBuffer());
      this.bytes = datos.length;
      return datos;
    }

    const lector = respuesta.body.getReader();
    const partes: Uint8Array[] = [];
    let ventana = { t: performance.now(), bytes: 0 };
    for (;;) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const frenada = new Promise<never>((_, rechazar) => {
        const mensaje = `La descarga se frenó (${this.frenadaMs / 1000} s sin recibir datos).`;
        timer = setTimeout(() => rechazar(new TardoDemasiado(mensaje)), this.frenadaMs);
      });
      let parte: ReadableStreamReadResult<Uint8Array>;
      try {
        parte = await Promise.race([lector.read(), frenada]);
      } catch (e) {
        lector.cancel().catch(() => {});
        throw e;
      } finally {
        clearTimeout(timer);
      }
      if (parte.done) break;
      partes.push(parte.value);
      this.bytes += parte.value.length;
      const ahora = performance.now();
      if (ahora - ventana.t >= VENTANA_VELOCIDAD_MS) {
        this.velocidad = ((this.bytes - ventana.bytes) * 1000) / (ahora - ventana.t);
        ventana = { t: ahora, bytes: this.bytes };
      }
    }
    if (this.total && this.bytes !== this.total) this.total = this.bytes;

    const datos = new Uint8Array(this.bytes);
    let pos = 0;
    for (const p of partes) {
      datos.set(p, pos);
      pos += p.length;
    }
    return datos;
  }
}

const descargas = new Map<string, Descarga>();

/** Descarga un archivo una sola vez por sesión (cambiar de modo no lo vuelve a bajar). Si falla, se puede reintentar. */
export function descargar(url: string): Descarga {
  let d = descargas.get(url);
  if (!d) {
    d = new Descarga(url);
    descargas.set(url, d);
    d.datos.catch(() => descargas.delete(url));
  }
  return d;
}

/** "3,2 MB", "850 KB". */
export function formatearBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;
}
