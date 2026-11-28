/**
 * Kernel de colores  (póster, "Coloración").
 *
 * Pesos (estado previo, t^-):
 *   w_i(v) = |N_G^{t^-}(v) ∩ C_i^{t^-}| / d_t^-(v)  +  α · 1{ p_t(v) ∈ C^X_i }
 *
 * con la convención 0/0 := 0 para vértices aislados (SUPF3 del README). Como
 * toda posición tiene una clase de color en X y α > 0, siempre Σ_i w_i(v) ≥ α > 0
 * (bien definido).
 *
 * Probabilidad de transición:
 *   P[ v ∈ C_i^{t+} ] = k·1{i = 0} + (1 − k) · w_i(v) / Σ_j w_j(v)
 *
 * Degenerado sólo alcanzable si se viola la hipótesis α > 0: si α = 0 y d = 0
 * entonces Σw = 0 y se usa la distribución uniforme sobre los colores (nunca NaN).
 *
 * Nota: la probabilidad se muestrea de forma independiente para cada vértice,
 * lo que garantiza que {C_i^{t+}} sea una partición de V(G) (los axiomas
 * P[v ∈ ⋃ C_i] = 1 y P[v ∈ C_i ∩ C_j] = 0, i ≠ j).
 */

/**
 * Rellena `out` con los pesos w_i(v) (no normalizados).
 * @param {Float64Array} out longitud sketch.colorCount
 * @returns {Float64Array} el mismo `out`
 */
export function fillColorWeights(state, sketch, params, v, out) {
  const { n, adj, color, pos } = state;
  const { alpha } = params;
  const colorCount = sketch.colorCount;
  const row = adj[v];

  // |N(v) ∩ C_i| / d(v) en el estado previo (0/0 := 0)
  out.fill(0);
  let d = 0;
  for (let j = 0; j < n; j++) if (row & (1 << j)) d++;
  if (d > 0) {
    for (let u = 0; u < n; u++) if (row & (1 << u)) out[color[u]] += 1;
    for (let i = 0; i < colorCount; i++) out[i] /= d;
  }

  // Bonificación α si la posición del vértice tiene color i en el croquis
  out[sketch.colors[pos[v]]] += alpha;

  return out;
}

/**
 * Normaliza los pesos a probabilidades (no acumuladas): Σ_i out[i] = 1.
 *
 *   out_i = k·1{i = 0} + (1 − k) · w_i / Σw
 *
 * Si Σw = 0 (sólo posible con α = 0 y d = 0) devuelve la uniforme.
 * @param {Float64Array} weights
 * @param {{k: number}} params
 * @param {Float64Array} out longitud weights.length
 * @returns {Float64Array} el mismo `out`
 */
export function normalizeWeights(weights, params, out) {
  const { k } = params;
  const colorCount = weights.length;

  let total = 0;
  for (let i = 0; i < colorCount; i++) total += weights[i];

  if (total <= 0) {
    for (let i = 0; i < colorCount; i++) out[i] = 1 / colorCount;
    return out;
  }

  for (let i = 0; i < colorCount; i++) {
    out[i] = (i === 0 ? k : 0) + ((1 - k) * weights[i]) / total;
  }
  return out;
}

/**
 * Probabilidades P[v ∈ C_i] para el vértice `v` (muestreo y enumeración
 * exacta comparten esta misma función).
 * @returns {Float64Array} longitud sketch.colorCount
 */
export function colorProbabilities(state, sketch, params, v) {
  const weights = new Float64Array(sketch.colorCount);
  fillColorWeights(state, sketch, params, v, weights);
  return normalizeWeights(weights, params, new Float64Array(sketch.colorCount));
}

export function stepColors(state, sketch, params, rng, detail) {
  const { n, colorCount } = { n: state.n, colorCount: sketch.colorCount };

  const nextColor = new Uint8Array(n);
  const weights = new Float64Array(colorCount);
  const probs = new Float64Array(colorCount); // normalizadas (no acumuladas)
  const cumulative = new Float64Array(colorCount);

  if (detail) detail.colorBefore.set(state.color);

  for (let v = 0; v < n; v++) {
    fillColorWeights(state, sketch, params, v, weights);
    normalizeWeights(weights, params, probs);

    let acc = 0;
    for (let i = 0; i < colorCount; i++) {
      acc += probs[i];
      cumulative[i] = acc;
    }

    const r = rng.next() * acc;
    let chosen = 0;
    while (chosen < colorCount - 1 && r >= cumulative[chosen]) chosen++;
    nextColor[v] = chosen;
  }

  if (detail) detail.colorAfter.set(nextColor);
  return { color: nextColor };
}
