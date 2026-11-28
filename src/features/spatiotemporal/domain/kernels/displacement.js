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
 * SUPF2 (orden de los vértices): se asume el orden natural 0, 1, …, n−1, es
 * decir, el vértice 1 aplica primero y el n el último. El orden SÍ importa:
 * los p_t(v) son distintos (p_t es biyectiva) pero x_i puede coincidir con
 * p_t(v_j), y (a b)∘(b c) ≠ (b c)∘(a b). La constante `VERTEX_ORDER` deja
 * esta elección escrita.
 *
 * Detalle fiel al póster: todas las transposiciones se construyen con p_t
 * (posiciones previas), por lo que un intercambio mutuo entre dos vértices se
 * cancela: (a b) ∘ (a b) = id.
 */

/** Orden de aplicación de las transposiciones dentro de un paso. */
export const VERTEX_ORDER = '0..n-1 (σ_1 primero, σ_n último)';

/**
 * Soporte uniforme del destino de un vértice en la posición `from`:
 * N_X(from) ∪ {from}. Coincide con `sketch.choices[from]`.
 * @returns {Uint8Array|number[]}
 */
export function positionChoices(from, sketch) {
  return sketch.choices[from];
}

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
 * @param {Uint8Array} [out]   buffer de salida (por defecto se crea uno nuevo)
 * @param {Uint8Array} [permOut] si se pasa, recibe σ_t como tabla de imágenes
 * @returns {Uint8Array}       p_{t+1} = σ_t ∘ p_t
 */
export function composePositions(pos, targets, m, out = new Uint8Array(pos.length), permOut) {
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

  for (let v = 0; v < pos.length; v++) out[v] = perm[pos[v]];
  if (permOut) permOut.set(perm);
  return out;
}

/**
 * Muestrea los destinos (uniformes en N_X(p) ∪ {p}) y aplica la composición.
 * Si se pasa `detail`, guarda posiciones previas, destinos y σ_t.
 */
export function stepPositions(state, sketch, rng, detail) {
  const { n, pos } = state;
  const m = sketch.size;

  const targets = detail ? detail.targets : new Uint8Array(n);
  for (let v = 0; v < n; v++) {
    const choices = sketch.choices[pos[v]];
    targets[v] = choices[rng.int(choices.length)];
  }

  if (detail) {
    detail.posBefore.set(pos);
    return { pos: composePositions(pos, targets, m, undefined, detail.perm) };
  }

  return { pos: composePositions(pos, targets, m) };
}
