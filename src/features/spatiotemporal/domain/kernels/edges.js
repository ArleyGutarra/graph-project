/**
 * Kernel de aristas  (póster, "Conexión y desconexión").
 *
 * Para todo par {v_i, v_j}, usando los grados d_t^-(v) y las posiciones p_t
 * del estado previo (los pares se muestrean de forma independiente):
 *
 *   ausente ∧ {p(v_i), p(v_j)} ∈ E(X)  ⇒  P[ presente ] = (d_i+1)(d_j+1) / (n+1)²
 *   presente ∧ {p(v_i), p(v_j)} ∉ E(X)  ⇒  P[ presente ] = 1 − d_i·d_j / n²
 *
 * Los dos casos restantes no aparecen escritos en el póster; se completan de
 * forma natural (y es lo que hace posible el auto-transitoriedad/aperiodicidad):
 *   presente ∧ posiciones adyacentes   ⇒  se conserva (P = 1)
 *   ausente   ∧ posiciones no adyacentes ⇒  no se crea (P = 0)
 */
export function stepEdges(state, sketch, rng) {
  const { n, adj, pos } = state;

  // Grados del estado previo d_t^-(v)
  const deg = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    let d = 0;
    const row = adj[i];
    for (let j = 0; j < n; j++) if (row & (1 << j)) d++;
    deg[i] = d;
  }

  const nextAdj = Int32Array.from(adj);
  const n2 = n * n;
  const n1 = (n + 1) * (n + 1);

  for (let i = 0; i < n; i++) {
    const row = adj[i]; // estado previo
    for (let j = i + 1; j < n; j++) {
      const present = (row & (1 << j)) !== 0;
      const linked = sketch.isAdjacent(pos[i], pos[j]);

      let pPresent;
      if (present && linked) pPresent = 1;
      else if (present && !linked) pPresent = 1 - (deg[i] * deg[j]) / n2;
      else if (!present && linked) pPresent = ((deg[i] + 1) * (deg[j] + 1)) / n1;
      else pPresent = 0;

      if (rng.chance(pPresent)) {
        nextAdj[i] |= 1 << j;
        nextAdj[j] |= 1 << i;
      } else {
        nextAdj[i] &= ~(1 << j);
        nextAdj[j] &= ~(1 << i);
      }
    }
  }

  return { adj: nextAdj };
}
