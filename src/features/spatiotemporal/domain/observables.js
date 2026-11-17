/**
 * Observables del sistema: magnitudes que se registran a lo largo del tiempo.
 *
 *  - edges        : número de aristas |E(G_t)|
 *  - meanDegree   : grado medio 2|E|/n
 *  - colorCounts  : nº de vértices de cada color
 *  - colorFractions: frecuencia relativa de cada color (partición de V)
 */
export function computeObservables(state, colorCount) {
  const { n, adj, color } = state;

  let half = 0;
  for (let i = 0; i < n; i++) {
    const row = adj[i];
    for (let j = i + 1; j < n; j++) if (row & (1 << j)) half++;
  }

  const colorCounts = new Array(colorCount).fill(0);
  for (let v = 0; v < n; v++) colorCounts[color[v]]++;

  return {
    edges: half,
    meanDegree: n > 0 ? (2 * half) / n : 0,
    colorCounts,
    colorFractions: colorCounts.map((c) => c / n),
  };
}
