/**
 * Registro temporal de observables con muestreo adaptativo.
 *
 * Guarda hasta `capacity` puntos; si se desborda, duplica el paso de muestreo
 * y descarta la mitad de los puntos. Así la memoria queda acotada aunque la
 * simulación corra miles de pasos, y el eje temporal sigue siendo exacto
 * (cada punto conserva su instante t).
 */
export class HistoryBuffer {
  constructor(capacity = 1200) {
    this.capacity = capacity;
    this.stride = 1;
    this.points = [];
  }

  /** Registra la muestra del instante `t` si le corresponde muestrearla. */
  push(t, sample) {
    if (t % this.stride !== 0) return;
    this.points.push({ t, ...sample });
    if (this.points.length > this.capacity) this.#compact();
  }

  #compact() {
    this.points = this.points.filter((_, i) => i % 2 === 0);
    this.stride *= 2;
  }

  /** Descarta las muestras posteriores a `t` (al retroceder con el scrubber). */
  trimAfter(t) {
    let kept = this.points.length;
    while (kept > 0 && this.points[kept - 1].t > t) kept -= 1;
    if (kept < this.points.length) this.points.length = kept;
  }

  clear() {
    this.points = [];
    this.stride = 1;
  }
}
