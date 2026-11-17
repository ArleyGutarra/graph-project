/** Media aritmética de una lista de números. */
export function mean(values) {
  if (!values.length) return 0;
  let total = 0;
  for (const v of values) total += v;
  return total / values.length;
}

/** Desviación estándar muestral (0 si hay menos de dos datos). */
export function std(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  let acc = 0;
  for (const v of values) acc += (v - m) * (v - m);
  return Math.sqrt(acc / (values.length - 1));
}

/** Rango (máximo − mínimo) de una lista: mide la dispersión entre condiciones. */
export function spread(values) {
  if (!values.length) return 0;
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return max - min;
}

/**
 * Histograma de valores enteros (p. ej. número de aristas |E|).
 * Devuelve los centros de bin ordenados y sus conteos.
 */
export function integerHistogram(values) {
  if (!values.length) return { xs: [], counts: [] };
  const counts = new Map();
  for (const v of values) {
    const key = Math.round(v);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const xs = [...counts.keys()].sort((a, b) => a - b);
  return { xs, counts: xs.map((x) => counts.get(x)) };
}

/** Redondea a `digits` decimales (para mostrar en la interfaz). */
export function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
