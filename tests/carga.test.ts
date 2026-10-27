import { describe, expect, it } from 'vitest';
import { Descarga, Etapa, formatearBytes } from '../src/input/carga';
import { TardoDemasiado } from '../src/input/limite';
import { textoEtapa } from '../src/ui/PanelCarga';

/** Respuesta que entrega `partes` de a una; si `colgar`, después de la última no termina nunca. */
function respuesta(partes: number[], { largo = true, colgar = false } = {}) {
  const total = partes.reduce((a, b) => a + b, 0);
  let i = 0;
  const cuerpo = new ReadableStream<Uint8Array>({
    pull(c) {
      if (i < partes.length) c.enqueue(new Uint8Array(partes[i++]).fill(7));
      else if (!colgar) c.close();
    },
  });
  return new Response(cuerpo, { headers: largo ? { 'content-length': String(total) } : {} });
}

describe('Descarga', () => {
  it('junta los datos y cuenta los bytes', async () => {
    const d = new Descarga('x', async () => respuesta([1000, 2000, 500]));
    const datos = await d.datos;
    expect(datos.length).toBe(3500);
    expect(d.bytes).toBe(3500);
    expect(d.total).toBe(3500);
  });

  it('sin content-length, el total queda en 0 (se muestran solo los MB bajados)', async () => {
    const d = new Descarga('x', async () => respuesta([10, 20], { largo: false }));
    await d.datos;
    expect(d.total).toBe(0);
    expect(d.bytes).toBe(30);
  });

  it('falla con un error claro si el servidor responde mal', async () => {
    const d = new Descarga('/modelo.task', async () => new Response('no', { status: 404 }));
    await expect(d.datos).rejects.toThrow('HTTP 404');
  });

  it('si deja de llegar información, se considera frenada', async () => {
    const d = new Descarga('x', async () => respuesta([100], { colgar: true }), 50);
    await expect(d.datos).rejects.toBeInstanceOf(TardoDemasiado);
    expect(d.bytes).toBe(100);
  });
});

describe('formatearBytes', () => {
  it('KB y MB con coma decimal', () => {
    expect(formatearBytes(512 * 1024)).toBe('512 KB');
    expect(formatearBytes(13.5 * 1024 * 1024)).toBe('13,5 MB');
  });
});

describe('textoEtapa', () => {
  it('muestra el estado de cada etapa', () => {
    const e = new Etapa('Cámara');
    expect(textoEtapa(e)).toBe('esperando…');
    e.empezar('esperando permiso');
    expect(textoEtapa(e)).toMatch(/^esperando permiso · \d/);
    e.fallar('Se negó el permiso');
    expect(textoEtapa(e)).toBe('Se negó el permiso');
  });

  it('una descarga en curso muestra MB y velocidad', () => {
    const e = new Etapa('Modelo');
    e.empezar();
    e.descarga = { bytes: 2 * 1024 * 1024, total: 8 * 1024 * 1024, velocidad: 1024 * 1024 } as Descarga;
    expect(textoEtapa(e)).toBe('2,0 MB / 8,0 MB · 1,0 MB/s');
    expect(e.avance).toBe(0.25);
  });
});
