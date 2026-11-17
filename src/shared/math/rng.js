/**
 * Generador pseudoaleatorio determinista (mulberry32).
 *
 * Toda simulación recibe una semilla: la misma semilla + los mismos
 * parámetros producen siempre la misma trayectoria, lo que permite
 * reproducir los resultados del experimento.
 */
export function createRng(seed = 1) {
  let state = seed >>> 0;

  /** Número uniforme en [0, 1). */
  function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,

    /** Verdadero con probabilidad p. */
    chance: (p) => next() < p,

    /** Entero uniforme en [0, max). */
    int: (max) => Math.min(max - 1, Math.floor(next() * max)),

    /** Elemento uniforme de una lista no vacía. */
    pick: (items) => items[Math.min(items.length - 1, Math.floor(next() * items.length))],

    /** Copia barajada (Fisher-Yates) de la lista recibida. */
    shuffle: (items) => {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}
