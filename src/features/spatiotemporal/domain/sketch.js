/**
 * Croquis X (sketch) sobre el que se desplazan los vértices de G.
 *
 * Hipótesis del póster (sección "Hipótesis"):
 *   - X finito y conexo,
 *   - X ≠ K_m (por eso el ciclo solo se permite con m ≥ 4),
 *   - coloreado fijo C^X_0, …, C^X_c con C^X_i ≠ ∅ para i = 1, …, c.
 *
 * El coloreado se asigna en round-robin (i mod colorCount), lo que garantiza
 * que todas las clases de color de X sean no vacías mientras size ≥ colorCount.
 */

export const SKETCH_TYPES = [
  { id: 'cycle', label: 'Ciclo C_m', minSize: 4 },
  { id: 'path', label: 'Camino P_m', minSize: 3 },
];

export function createSketch({ type = 'cycle', size = 6, colorCount = 3 } = {}) {
  const spec = SKETCH_TYPES.find((s) => s.id === type) ?? SKETCH_TYPES[0];
  if (!Number.isInteger(size) || size < spec.minSize) {
    throw new Error(`${spec.label} requiere m ≥ ${spec.minSize}.`);
  }
  if (type === 'cycle' && size < 4) {
    // Excluido por la hipótesis X ≠ K_m: C₃ = K₃.
    throw new Error('El ciclo C₃ = K₃ está excluido por la hipótesis X ≠ K_m.');
  }
  if (colorCount < 2 || colorCount > size) {
    throw new Error('Se requiere 2 ≤ (c+1) ≤ m para que C^X_i ≠ ∅ ∀ i.');
  }

  // Aristas de X
  const edges = [];
  for (let i = 0; i < size; i++) {
    if (type === 'cycle') edges.push([i, (i + 1) % size]);
    else if (i < size - 1) edges.push([i, i + 1]);
  }

  // Adyacencia
  const neighbors = Array.from({ length: size }, () => []);
  const adjacency = new Uint8Array(size * size);
  for (const [a, b] of edges) {
    neighbors[a].push(b);
    neighbors[b].push(a);
    adjacency[a * size + b] = 1;
    adjacency[b * size + a] = 1;
  }

  // Coloración fija del croquis: C^X_i = { x : colors[x] = i }
  const colors = new Uint8Array(size);
  for (let i = 0; i < size; i++) colors[i] = i % colorCount;

  const symbol = type === 'cycle' ? 'C' : 'P';

  return {
    type,
    size,
    colorCount,
    symbol,
    label: `${symbol}${size}`,
    edges,
    neighbors,
    adjacency,
    colors,
    /** ¿Las posiciones a y b son adyacentes en E(X)? */
    isAdjacent: (a, b) => a !== b && adjacency[a * size + b] === 1,
  };
}
