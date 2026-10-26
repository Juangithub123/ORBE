import { describe, expect, it } from 'vitest';
import { TardoDemasiado, conLimite } from '../src/input/limite';

describe('conLimite', () => {
  it('devuelve el resultado si llega a tiempo', async () => {
    await expect(conLimite(Promise.resolve(7), 50, 'x')).resolves.toBe(7);
  });
  it('rechaza con el mensaje si tarda demasiado', async () => {
    const nunca = new Promise<never>(() => {});
    await expect(conLimite(nunca, 20, 'se colgó')).rejects.toThrow(new TardoDemasiado('se colgó'));
  });
  it('deja pasar el error original', async () => {
    await expect(conLimite(Promise.reject(new Error('falló')), 50, 'x')).rejects.toThrow('falló');
  });
});
