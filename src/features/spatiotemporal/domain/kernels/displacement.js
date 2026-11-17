/**
 * Kernel de desplazamiento  (póster, "Desplazamiento").
 *
 * En t⁺ → (t+1)⁻ cada vértice v_i elige uniformemente una posición destino
 *   x_j ∈ N_X(p_t(v_i)) ∪ { p_t(v_i) }
 * y aplica la transposición espacial σ_{i,t} = ( p_t(v_i)  x_j ) ∈ S_m.
 *
 * La nueva configuración resulta de la composición ordenada
 *   σ_t = σ_{n,t} ∘ … ∘ σ_{1,t}     (σ_{1,t} primero)
 * y p_{t+1} = σ_t ∘ p_t.
 *
 * Detalle fiel al póster: todas las transposiciones se construyen con p_t
 * (posiciones previas), por lo que un intercambio mutuo entre dos vértices se
 * cancela: (a b) ∘ (a b) = id.
 */

/**
 * Calcula la configuración final de posiciones dadas las posiciones previas
 * y el destino elegido por cada vértice (función pura, sin azar).
 *
 * Se parte de la identidad y se compone por la IZQUIERDA con cada
 * transposición en orden de vértice (v = 0 … n−1). Componer τ ∘ σ por la
 * izquierda equivale a intercambiar los valores τ(a) y τ(b) en la tabla de
 * imágenes de σ, de ahí el bucle de intercambio de valores.
 *
 * @param {Uint8Array} pos     posiciones previas p_t
 * @param {Uint8Array} targets destino elegido por cada vértice
 * @param {number} m           número de posiciones del croquis
 * @returns {Uint8Array}       p_{t+1} = σ_t ∘ p_t
 */
export function composePositions(pos, targets, m) {
  // σ en representación de tabla de imágenes: perm[p] = σ(p)
  const perm = new Uint8Array(m);
  for (let p = 0; p < m; p++) perm[p] = p;

  for (let v = 0; v < pos.length; v++) {
    const from = pos[v];
    const to = targets[v];
    if (to === from) continue;

    // σ ← (from to) ∘ σ : intercambiar los valores `from` y `to`
    for (let p = 0; p < m; p++) {
      if (perm[p] === from) perm[p] = to;
      else if (perm[p] === to) perm[p] = from;
    }
  }

  const nextPos = new Uint8Array(pos.length);
  for (let v = 0; v < pos.length; v++) nextPos[v] = perm[pos[v]];
  return nextPos;
}

/**
 * Muestrea los destinos (uniformes en N_X(p) ∪ {p}) y aplica la composición.
 */
export function stepPositions(state, sketch, rng) {
  const { n, pos } = state;
  const m = sketch.size;

  const targets = new Uint8Array(n);
  for (let v = 0; v < n; v++) {
    const from = pos[v];
    const neighbors = sketch.neighbors[from];
    const choice = rng.int(neighbors.length + 1);
    targets[v] = choice === neighbors.length ? from : neighbors[choice];
  }

  return { pos: composePositions(pos, targets, m) };
}
