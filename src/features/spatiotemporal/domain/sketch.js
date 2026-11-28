/**
 * Croquis X (sketch) sobre el que se desplazan los vértices de G.
 *
 * Hipótesis del póster (sección "Hipótesis"):
 *   - X finito y conexo,
 *   - X ≠ K_m,
 *   - coloreado fijo C^X_0, …, C^X_c con C^X_i ≠ ∅ para i = 1, …, c.
 *
 * Estas hipótesis NO se fuerzan aquí: el croquis puede ser completo y el
 * número de colores puede exceder a m, porque la interfaz debe AVISAR de la
 * violación (ver `domain/hypotheses.js`) en lugar de impedir elegirla.
 * Sí se mantienen los límites estructurales: X conexo y 2 ≤ (c+1) ≤ 5.
 *
 * El coloreado se asigna en round-robin (i mod colorCount), de modo que
 * C^X_i = ∅ sólo ocurre cuando colorCount > size.
 */

export const SKETCH_TYPES = [
  { id: 'cycle', label: 'Ciclo C_m', minSize: 4 },
  { id: 'path', label: 'Camino P_m', minSize: 3 },
  // Completo K_m: está para poder VIOLAR la hipótesis X ≠ K_m y ver el aviso.
  { id: 'complete', label: 'Completo K_m', minSize: 3 },
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
  if (colorCount < 2 || colorCount > 5) {
    throw new Error('Se requiere 2 ≤ (c+1) ≤ 5.');
  }

  // Aristas de X
  const edges = [];
  for (let i = 0; i < size; i++) {
    if (type === 'cycle') edges.push([i, (i + 1) % size]);
    else if (type === 'path' && i < size - 1) edges.push([i, i + 1]);
    else if (type === 'complete') for (let j = i + 1; j < size; j++) edges.push([i, j]);
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

  /**
   * Soporte del desplazamiento: N_X(p) ∪ {p}, en el MISMO orden que lo
   * muestrea `stepPositions` (vecinos primero, la posición propia al final),
   * de modo que la semilla produce exactamente la misma trayectoria.
   */
  const choices = neighbors.map((list, i) => [...list, i]);

  // Coloración fija del croquis: C^X_i = { x : colors[x] = i }
  const colors = new Uint8Array(size);
  for (let i = 0; i < size; i++) colors[i] = i % colorCount;

  const symbol = type === 'cycle' ? 'C' : type === 'path' ? 'P' : 'K';

  return {
    type,
    size,
    colorCount,
    symbol,
    label: `${symbol}${size}`,
    edges,
    neighbors,
    choices,
    adjacency,
    colors,
    /** ¿Las posiciones a y b son adyacentes en E(X)? */
    isAdjacent: (a, b) => a !== b && adjacency[a * size + b] === 1,
  };
}

/** ¿Es X conexo? (BFS sobre la adyacencia). */
export function isSketchConnected(sketch) {
  const { size, neighbors } = sketch;
  if (size === 0) return true;
  const seen = new Uint8Array(size);
  const queue = [0];
  seen[0] = 1;
  let reached = 1;
  while (queue.length) {
    const node = queue.pop();
    for (const next of neighbors[node]) {
      if (!seen[next]) {
        seen[next] = 1;
        reached += 1;
        queue.push(next);
      }
    }
  }
  return reached === size;
}

/** ¿X es completo (K_m)? */
export function isSketchComplete(sketch) {
  return sketch.edges.length === (sketch.size * (sketch.size - 1)) / 2;
}

/** Posiciones x con C^X_i = ∅ (i = 0 … colorCount−1). */
export function emptySketchColorClasses(sketch) {
  const present = new Uint8Array(sketch.colorCount);
  for (const c of sketch.colors) present[c] = 1;
  const missing = [];
  // El póster exige C^X_i ≠ ∅ sólo para i ≥ 1, pero C^X_0 vacío también deja
  // la coloración de X incompleta: se reporta por igual.
  for (let i = 0; i < sketch.colorCount; i++) if (!present[i]) missing.push(i);
  return missing;
}
