// Filtro "One Euro" (Casiez, Roussel y Vogel, 2012), el estándar para suavizar seguimiento de manos y cuerpo.
// Es un pasabajos que se adapta a la velocidad: quieto filtra mucho (saca el temblor de la detección) y
// rápido filtra poco (no agrega retardo). Trabaja con el momento de cada detección, así que no depende de
// cuántas detecciones por segundo haya.

/** Factor de suavizado de un pasabajos de primer orden con frecuencia de corte `corte` (Hz) y paso `dt` (s). */
function alfa(corte: number, dt: number) {
  // Con corte 0 (por ejemplo, desde el panel) el filtro quedaría congelado.
  const tau = 1 / (2 * Math.PI * Math.max(0.01, corte));
  return 1 / (1 + tau / dt);
}

export class FiltroUnoEuro {
  private x: number | null = null;
  private dx = 0;
  private t = 0;

  /**
   * @param corteMin corte con la señal quieta (Hz): menos = más suave.
   * @param beta cuánto sube el corte con la velocidad: más = menos retardo al moverse rápido.
   * @param corteDerivada corte del filtro de la velocidad (Hz).
   */
  constructor(
    public corteMin = 0.8,
    public beta = 5,
    public corteDerivada = 1,
  ) {}

  /** Filtra el valor `x` medido en el momento `t` (segundos). */
  filtrar(x: number, t: number) {
    if (this.x === null || t <= this.t) {
      // Primer valor (o un tiempo que no avanza): se toma tal cual.
      if (this.x === null) this.x = x;
      this.t = Math.max(this.t, t);
      return this.x;
    }
    const dt = t - this.t;
    this.t = t;
    const dxCrudo = (x - this.x) / dt;
    this.dx += alfa(this.corteDerivada, dt) * (dxCrudo - this.dx);
    const corte = this.corteMin + this.beta * Math.abs(this.dx);
    this.x += alfa(corte, dt) * (x - this.x);
    return this.x;
  }

  reiniciar() {
    this.x = null;
    this.dx = 0;
    this.t = 0;
  }
}
