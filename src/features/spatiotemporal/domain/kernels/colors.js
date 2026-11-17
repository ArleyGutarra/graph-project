/**
 * Kernel de colores  (póster, "Coloración").
 *
 * Pesos (estado previo, t^-):
 *   w_i(v) = |N_G^{t^-}(v) ∩ C_i^{t^-}| / d_t^-(v)  +  α · 1{ p_t(v) ∈ C^X_i }
 *
 * con la convención 0/0 := 0 para vértices aislados. Como todo posición tiene
 * una clase de color en X y α > 0, siempre Σ_i w_i(v) ≥ α > 0 (bien definido).
 *
 * Probabilidad de transición:
 *   P[ v ∈ C_i^{t+} ] = k·1{i = 0} + (1 − k) · w_i(v) / Σ_j w_j(v)
 *
 * Nota: la probabilidad se muestrea de forma independiente para cada vértice,
 * lo que garantiza que {C_i^{t+}} sea una partición de V(G) (los axiomas
 * P[v ∈ ⋃ C_i] = 1 y P[v ∈ C_i ∩ C_j] = 0, i ≠ j).
 */
export function stepColors(state, sketch, params, rng) {
  const { n, adj, color, pos } = state;
  const { k, alpha } = params;
  const colorCount = sketch.colorCount;

  // Grados del estado previo
  const deg = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    let d = 0;
    const row = adj[i];
    for (let j = 0; j < n; j++) if (row & (1 << j)) d++;
    deg[i] = d;
  }

  const nextColor = new Uint8Array(n);
  const weights = new Float64Array(colorCount);
  const probs = new Float64Array(colorCount);

  for (let v = 0; v < n; v++) {
    // |N(v) ∩ C_i| en el estado previo
    weights.fill(0);
    const row = adj[v];
    const d = deg[v];
    if (d > 0) {
      for (let u = 0; u < n; u++) {
        if (row & (1 << u)) weights[color[u]] += 1;
      }
      for (let i = 0; i < colorCount; i++) weights[i] /= d;
    }

    // Bonificación α si la posición del vértice tiene color i en el croquis
    const positionColor = sketch.colors[pos[v]];
    weights[positionColor] += alpha;

    // P[v ∈ C_i] = k·1{i=0} + (1−k)·w_i / Σw
    let total = 0;
    for (let i = 0; i < colorCount; i++) total += weights[i];
    let acc = 0;
    for (let i = 0; i < colorCount; i++) {
      const p = (i === 0 ? k : 0) + ((1 - k) * weights[i]) / total;
      acc += p;
      probs[i] = acc;
    }

    const r = rng.next() * acc;
    let chosen = 0;
    while (chosen < colorCount - 1 && r >= probs[chosen]) chosen++;
    nextColor[v] = chosen;
  }

  return { color: nextColor };
}
