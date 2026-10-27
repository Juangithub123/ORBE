import { describe, expect, it } from 'vitest';
import { LARGO_RANKING, insertarPartida, type Partida } from '../src/storage/leaderboard';

const p = (equipo: string, puntaje: number, extra: Partial<Partida> = {}): Partida => ({
  equipo,
  puntaje,
  nivel: 1,
  gano: false,
  fecha: 1000,
  ...extra,
});

describe('insertarPartida', () => {
  it('ordena por puntaje', () => {
    let r: Partida[] = [];
    for (const x of [p('A', 30), p('B', 90), p('C', 60)]) r = insertarPartida(r, x).ranking;
    expect(r.map((x) => x.equipo)).toEqual(['B', 'C', 'A']);
  });

  it('desempata por ganar, después por nivel y después por quién llegó antes', () => {
    const r = [
      p('TARDE', 50, { nivel: 3, fecha: 2000 }),
      p('NIVEL2', 50, { nivel: 2 }),
      p('GANO', 50, { nivel: 3, gano: true, fecha: 3000 }),
      p('ANTES', 50, { nivel: 3, fecha: 1000 }),
    ].reduce<Partida[]>((acc, x) => insertarPartida(acc, x).ranking, []);
    expect(r.map((x) => x.equipo)).toEqual(['GANO', 'ANTES', 'TARDE', 'NIVEL2']);
  });

  it('devuelve el puesto, o null si no entra en el top', () => {
    const lleno = Array.from({ length: LARGO_RANKING }, (_, i) => p(`E${i}`, 100 - i));
    expect(insertarPartida(lleno, p('NUEVO', 95.5)).puesto).toBe(6);
    const sinLugar = insertarPartida(lleno, p('BAJO', 1));
    expect(sinLugar.puesto).toBeNull();
    expect(sinLugar.ranking).toHaveLength(LARGO_RANKING);
  });

  it('a igual puntaje, la partida nueva queda después de la vieja', () => {
    const r = insertarPartida([p('VIEJA', 40, { fecha: 1 })], p('NUEVA', 40, { fecha: 2 }));
    expect(r.puesto).toBe(2);
  });
});
