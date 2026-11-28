import { edgePairs } from './kernels/edges';

/**
 * Detalle de un paso de la cadena: todo lo que la vista "Simular" y el
 * Inspector necesitan reconstruir, guardado en arrays compactos para que
 * poder retroceder con el scrubber no cueste decenas de MB.
 *
 * Con él se reconstruyen los dos micro-estados del paso:
 *
 *   t⁻ (después del desplazamiento) = estado entrante
 *        { adj: estado.adj, color: colorBefore, pos: posBefore }
 *   t⁺ (después de aristas+colores)  = { adj: desde edgeNow,
 *        color: colorAfter, pos: posBefore }
 *
 * Es decir: `posBefore` es la posición ANTES del desplazamiento, de modo que
 * el conmutador t⁻ ↔ t⁺ sólo cambia aristas y colores.
 *
 * @param {number} n   vértices de G
 * @param {number} [m] posiciones de X (por defecto n)
 */
export function createStepDetail(n, m = n) {
  const pairs = edgePairs(n);
  return {
    n,
    m,
    pairs,
    // Fase de desplazamiento
    posBefore: new Uint8Array(n),
    targets: new Uint8Array(n),
    perm: new Uint8Array(m), // σ_t como tabla de imágenes
    // Fase de aristas
    edgeWas: new Uint8Array(pairs.length),
    edgeLinked: new Uint8Array(pairs.length),
    edgeNow: new Uint8Array(pairs.length),
    edgeDegI: new Int8Array(pairs.length),
    edgeDegJ: new Int8Array(pairs.length),
    edgeProb: new Float64Array(pairs.length),
    // Fase de coloración
    colorBefore: new Uint8Array(n),
    colorAfter: new Uint8Array(n),
  };
}

/** Reconstruye el estado t⁺ (aristas y colores actualizados, posiciones de t⁻). */
export function statePlusOf(state, detail) {
  const adj = new Int32Array(state.n);
  detail.pairs.forEach(([i, j], index) => {
    if (detail.edgeNow[index]) {
      adj[i] |= 1 << j;
      adj[j] |= 1 << i;
    }
  });
  return { n: state.n, adj, color: detail.colorAfter, pos: detail.posBefore };
}

/**
 * Estado que debe dibujar la vista Simular para el micro-paso elegido.
 *
 *  · t⁻ → el estado de partida del último paso (`previous`), que es el que
 *    lleva las posiciones ya desplazadas;
 *  · t⁺ → el mismo estado con aristas y colores ya actualizados y las
 *    posiciones todavía sin desplazar (`statePlusOf`).
 *
 * Ambos difieren SÓLO por la actualización, igual que los estados t⁻ / t⁺ de
 * la maqueta. Si todavía no hay pasos (o no se guardó el detalle), se muestra
 * el estado actual.
 */
export function displayedState({ state, previous, detail, mode = 'simulation', subphase = 'plus' }) {
  if (mode !== 'simulation') return state;
  if (subphase === 'plus' && detail && previous) return statePlusOf(previous, detail);
  return previous ?? state;
}

/**
 * Descompone una permutación en ciclos disjuntos (para la fórmula
 * σ = (x₁ x₂)(x₃ x₄ x₅) ∈ S_m).
 * @returns {number[][]} ciclos, sin fijos y en orden creciente por su mínimo
 */
export function permutationCycles(perm) {
  const m = perm.length;
  const seen = new Uint8Array(m);
  const cycles = [];
  for (let start = 0; start < m; start++) {
    if (seen[start]) continue;
    const cycle = [];
    let current = start;
    while (!seen[current]) {
      seen[current] = 1;
      cycle.push(current);
      current = perm[current];
    }
    if (cycle.length > 1) cycles.push(cycle);
  }
  cycles.sort((a, b) => Math.min(...a) - Math.min(...b));
  return cycles;
}

/** Formatea los ciclos como (x₁ x₂)(x₃ x₄ x₅). */
export function formatCycles(cycles) {
  if (!cycles.length) return 'id';
  return cycles.map((cycle) => `(${cycle.map((x) => `x${x}`).join(' ')})`).join('');
}
