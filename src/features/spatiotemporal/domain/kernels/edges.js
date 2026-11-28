/**
 * Kernel de aristas  (póster, "Conexión y desconexión").
 *
 * Para todo par {v_i, v_j}, usando los grados d_t^-(v) y las posiciones p_t
 * del estado previo (los pares se muestrean de forma independiente):
 *
 *   ausente ∧ {p(v_i), p(v_j)} ∈ E(X)  ⇒  P[ presente ] = (d_i+1)(d_j+1) / (n+1)²
 *   presente ∧ {p(v_i), p(v_j)} ∉ E(X)  ⇒  P[ presente ] = 1 − d_i·d_j / n²
 *
 * Los dos casos restantes no aparecen escritos en el póster; se completan así:
 *   ausente ∧ posiciones NO adyacentes ⇒ 0   (X es el ancla: sólo se crean
 *                                            aristas donde E(X) tiene arista)
 *   presente ∧ posiciones adyacentes   ⇒ 1 − d_i·d_j/n²
 *
 * ⚠ Con la otra lectura posible ("presente ∧ adyacente ⇒ 1", borrar queda
 *   prohibido sobre una arista anclada en X) la cadena RESULTA REDUCIBLE. Se
 *   comprobó con el cálculo exacto: con X = P₃ y c+1 = 3 sólo se alcanzan
 *   1290 de 1296 estados; los 6 inalcanzables son exactamente (grafo vacío,
 *   coloración 222) para cada permutación. Motivo: para borrar la única
 *   arista posible sus extremos deben ocupar las posiciones NO adyacentes
 *   {0,2} de P₃, dejando al tercer vértice aislado en la posición 1 (territorio
 *   C₁); y un vértice aislado sólo alcanza los colores {0, territorio} =
 *   {C₀, C₁}, nunca C₂. La lectura adoptada restaura la irreducibilidad.
 *
 * No hay división por cero: d = 0 da (0+1)(0+1)/(n+1)² y 1 − 0.
 *
 * Cambiar de lectura = devolver `1` en la rama `present && linked` de
 * `edgeProbability` (está aislada ahí a propósito).
 */

/**
 * P[{v_i, v_j} ∈ E(G_{t^+})] condicionado al estado t⁻.
 *
 * Función pura y sin azar: es la misma que muestrea `stepEdges` y la que
 * enumera la matriz de transición exacta del módulo `exactStationary`.
 *
 * @param {boolean} present {v_i, v_j} ∈ E(G_t⁻)
 * @param {boolean} linked  {p_t(v_i), p_t(v_j)} ∈ E(X)
 * @param {number} degI     d_t^-(v_i)
 * @param {number} degJ     d_t^-(v_j)
 * @param {number} n        número de vértices
 * @returns {number} probabilidad en [0, 1]
 */
export function edgeProbability(present, linked, degI, degJ, n) {
  if (present) {
    // Permanencia del póster (caso presente ∧ no adyacente) + su completación
    // a todo par presente. Si quieres la otra lectura, devuelve `1` cuando
    // `linked` sea true (ver nota al inicio del archivo sobre irreducibilidad).
    return 1 - (degI * degJ) / (n * n);
  }
  // Creación: sólo sobre una arista de E(X); en otro sitio nunca se crea.
  return linked ? ((degI + 1) * (degJ + 1)) / ((n + 1) * (n + 1)) : 0;
}

/** Pares {i, j} con i < j, en el orden de los bits de E(G). */
export function edgePairs(n) {
  const pairs = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
  return pairs;
}

export function stepEdges(state, sketch, rng, detail) {
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

  // El orden de este doble bucle (i creciente, j = i+1 …) es el MISMO que el
  // de `edgePairs(n)`, así que el índice correlativo coincide con detail.pairs.
  let pairIndex = -1;

  for (let i = 0; i < n; i++) {
    const row = adj[i]; // estado previo
    for (let j = i + 1; j < n; j++) {
      pairIndex += 1;
      const present = (row & (1 << j)) !== 0;
      const linked = sketch.isAdjacent(pos[i], pos[j]);
      const pPresent = edgeProbability(present, linked, deg[i], deg[j], n);

      const kept = rng.chance(pPresent);
      if (kept) {
        nextAdj[i] |= 1 << j;
        nextAdj[j] |= 1 << i;
      } else {
        nextAdj[i] &= ~(1 << j);
        nextAdj[j] &= ~(1 << i);
      }

      if (detail) {
        detail.edgeWas[pairIndex] = present ? 1 : 0;
        detail.edgeLinked[pairIndex] = linked ? 1 : 0;
        detail.edgeDegI[pairIndex] = deg[i];
        detail.edgeDegJ[pairIndex] = deg[j];
        detail.edgeProb[pairIndex] = pPresent;
        detail.edgeNow[pairIndex] = kept ? 1 : 0;
      }
    }
  }

  return { adj: nextAdj };
}
