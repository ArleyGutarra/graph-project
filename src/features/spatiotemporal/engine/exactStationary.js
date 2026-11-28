import { composePositions, positionChoices } from '../domain/kernels/displacement';
import { edgeProbability, edgePairs } from '../domain/kernels/edges';
import { colorProbabilities } from '../domain/kernels/colors';

export { edgePairs };

/**
 * Cálculo EXACTO de π* para n pequeño (póster, Teorema: π* única).
 *
 * Ω se enumera como el producto cartesiano
 *      Ω = { subgrafos de K_n } × { coloraciones } × { permutaciones de [n] }
 *   = 2^{n(n−1)/2} · (c+1)^n · n!
 *
 * y la matriz P se construye EXCLUSIVAMENTE reutilizando los kernels del
 * modelo (aristas, colores y desplazamiento), de modo que la matriz y la
 * simulación en vivo comparten el mismo modelo: si difieren, el fallo está
 * aquí y no en el póster.
 *
 * Es posible porque los tres kernels son independientes condicionado al estado
 * t⁻ (SUPF1 del README): P(S→S') = P(aristas) · P(colores) · P(destinos).
 *
 * Límite: MAX_EXACT_STATES = 2000. Con n = 3 da |Ω| = 8·(c+1)³·6:
 *   (c+1) = 2 → 384   |   (c+1) = 3 → 1296   |   (c+1) = 4 → 3072 ✗
 * n = 4 da 124 416 estados y ~5·10¹⁰ operaciones para armar P: NO es viable en
 * el navegador, por eso el cálculo exacto se limita a n = 3 (decisión tomada
 * en el plan acordado).
 */

export const MAX_EXACT_STATES = 2000;

export function factorial(n) {
  let acc = 1;
  for (let i = 2; i <= n; i++) acc *= i;
  return acc;
}

/** Rango de Lehmer (índice factorial) de una permutación. */
export function permRank(perm) {
  const n = perm.length;
  let rank = 0;
  for (let i = 0; i < n; i++) {
    let less = 0;
    for (let j = i + 1; j < n; j++) if (perm[j] < perm[i]) less++;
    rank = rank * (n - i) + less;
  }
  return rank;
}

/** Permutación correspondiente a un rango de Lehmer. */
export function permUnrank(rank, n) {
  const pool = Array.from({ length: n }, (_, i) => i);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const f = factorial(n - 1 - i);
    const idx = Math.floor(rank / f);
    rank -= idx * f;
    out[i] = pool[idx];
    pool.splice(idx, 1);
  }
  return out;
}

/**
 * Codificador estado ↔ índice de Ω.
 * @param {{n: number, colorCount: number, m?: number}} opts
 *   n = vértices · m = posiciones de X (por defecto n = m)
 */
export function createStateCodec({ n, colorCount, m = n }) {
  const pairs = edgePairs(n);
  const edgesCount = 1 << pairs.length;
  const colorPower = colorCount ** n;
  const permCount = factorial(m);
  const size = edgesCount * colorPower * permCount;

  if (size > MAX_EXACT_STATES) {
    throw new Error(`|Ω| = ${size} supera el límite de ${MAX_EXACT_STATES} estados exactos.`);
  }

  function encode(state) {
    let mask = 0;
    for (let p = 0; p < pairs.length; p++) {
      const [i, j] = pairs[p];
      if (state.adj[i] & (1 << j)) mask |= 1 << p;
    }
    let colors = 0;
    for (let v = 0; v < n; v++) colors = colors * colorCount + state.color[v];
    return (mask * colorPower + colors) * permCount + permRank(state.pos);
  }

  function decode(index) {
    const rank = index % permCount;
    const rest = (index - rank) / permCount;
    const colorCode = rest % colorPower;
    const mask = (rest - colorCode) / colorPower;

    const adj = new Int32Array(n);
    const color = new Uint8Array(n);
    for (let v = n - 1, acc = colorCode; v >= 0; v--) {
      color[v] = acc % colorCount;
      acc = (acc - color[v]) / colorCount;
    }
    for (let p = 0; p < pairs.length; p++) {
      if (mask & (1 << p)) {
        const [i, j] = pairs[p];
        adj[i] |= 1 << j;
        adj[j] |= 1 << i;
      }
    }

    return { n, adj, color, pos: permUnrank(rank, m) };
  }

  /** Índice del estado resultante de aplicar un paso concreto. */
  function indexAfter(nextMask, nextColors, nextPos) {
    let colors = 0;
    for (let v = 0; v < n; v++) colors = colors * colorCount + nextColors[v];
    return (nextMask * colorPower + colors) * permCount + permRank(nextPos);
  }

  function degree(state, v) {
    let d = 0;
    const row = state.adj[v];
    for (let j = 0; j < n; j++) if (row & (1 << j)) d++;
    return d;
  }

  return {
    n,
    m,
    colorCount,
    pairs,
    edgesCount,
    colorPower,
    permCount,
    size,
    encode,
    decode,
    indexAfter,
    degree,
  };
}

/**
 * Construye la matriz de transición P (densa, size × size) del modelo dado,
 * enumerando las elecciones independientes de los tres kernels.
 * @returns {Float64Array}
 */
export function buildTransitionMatrix({ codec, sketch, params, onProgress }) {
  const { n, colorCount, pairs, edgesCount, colorPower, size, degree, indexAfter } = codec;
  const m = sketch.size;
  const P = new Float64Array(size * size);

  const nextColors = new Uint8Array(n);
  const targets = new Uint8Array(n);
  const scratch = new Uint8Array(n);
  const odometer = new Int32Array(n);
  const colorCodes = new Array(colorPower);
  const colorProbs = new Array(colorPower);

  for (let src = 0; src < size; src++) {
    const state = codec.decode(src);

    // FASE 1a · aristas: probabilidad por par (estado t⁻)
    const present = new Uint8Array(pairs.length);
    const edgeProb = new Float64Array(pairs.length);
    for (let p = 0; p < pairs.length; p++) {
      const [i, j] = pairs[p];
      const isPresent = (state.adj[i] & (1 << j)) !== 0;
      present[p] = isPresent ? 1 : 0;
      edgeProb[p] = edgeProbability(
        isPresent,
        sketch.isAdjacent(state.pos[i], state.pos[j]),
        degree(state, i),
        degree(state, j),
        n
      );
    }

    // FASE 1b · colores: probabilidad por vértice (estado t⁻)
    const vertexProbs = [];
    for (let v = 0; v < n; v++) vertexProbs[v] = colorProbabilities(state, sketch, params, v);

    // FASE 2 · destinos: soporte uniforme sobre N_X(p) ∪ {p}
    const choices = [];
    const choiceCounts = [];
    for (let v = 0; v < n; v++) {
      const list = positionChoices(state.pos[v], sketch);
      choices.push(list);
      choiceCounts.push(list.length);
    }

    // Prefijo: código de coloración → colores y su probabilidad conjunta
    for (let code = 0; code < colorPower; code++) {
      const colors = new Uint8Array(n);
      let acc = code;
      for (let v = n - 1; v >= 0; v--) {
        colors[v] = acc % colorCount;
        acc = (acc - colors[v]) / colorCount;
      }
      let probability = 1;
      for (let v = 0; v < n; v++) probability *= vertexProbs[v][colors[v]];
      colorCodes[code] = colors;
      colorProbs[code] = probability;
    }

    for (let mask = 0; mask < edgesCount; mask++) {
      // Probabilidad de este subgrafo concreto
      let pMask = 1;
      for (let p = 0; p < pairs.length; p++) {
        pMask *= mask & (1 << p) ? edgeProb[p] : 1 - edgeProb[p];
      }

      for (let code = 0; code < colorPower; code++) {
        const pColors = colorProbs[code];
        if (pColors === 0) continue;
        nextColors.set(colorCodes[code]);

        odometer.fill(0);
        for (;;) {
          let pTargets = 1;
          for (let v = 0; v < n; v++) {
            targets[v] = choices[v][odometer[v]];
            pTargets /= choiceCounts[v];
          }

          composePositions(state.pos, targets, m, scratch);
          P[src * size + indexAfter(mask, nextColors, scratch)] += pMask * pColors * pTargets;

          let v = 0;
          while (v < n) {
            odometer[v] += 1;
            if (odometer[v] < choiceCounts[v]) break;
            odometer[v] = 0;
            v += 1;
          }
          if (v >= n) break;
        }
      }
    }

    if (onProgress && (src & 15) === 15) onProgress(src + 1, size);
  }

  return P;
}

/** ¿Es P irreducible? (conectividad fuerte vía alcanzabilidad desde estado 0). */
export function checkIrreducible(P, size) {
  const seen = new Uint8Array(size);
  const stack = [0];
  seen[0] = 1;
  let reached = 1;
  while (stack.length) {
    const i = stack.pop();
    const row = i * size;
    for (let j = 0; j < size; j++) {
      if (!seen[j] && P[row + j] > 0) {
        seen[j] = 1;
        reached += 1;
        stack.push(j);
      }
    }
  }
  return { ok: reached === size, reached, size };
}

/** ¿Es P aperiódica? En una cadena irreducible basta con un lazo P(S,S) > 0. */
export function checkAperiodic(P, size) {
  let best = 0;
  for (let i = 0; i < size; i++) {
    const value = P[i * size + i];
    if (value > best) best = value;
  }
  return { ok: best > 0, maxSelfLoop: best };
}

/** Producto vector-matriz v ↦ v·P. */
export function matvec(v, P, size) {
  const out = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    const p = v[i];
    if (p === 0) continue;
    const row = i * size;
    for (let j = 0; j < size; j++) {
      const q = P[row + j];
      if (q !== 0) out[j] += p * q;
    }
  }
  return out;
}

/** Distancia de variación total ½·Σ|p − q|. */
export function totalVariation(a, b) {
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc += Math.abs(a[i] - b[i]);
  return acc / 2;
}

/** ‖π·P − π‖₁: residuo que certifica que π es estacionaria. */
export function residual(P, pi, size) {
  const next = matvec(pi, P, size);
  let acc = 0;
  for (let i = 0; i < size; i++) acc += Math.abs(next[i] - pi[i]);
  return acc;
}

function normalize(vector) {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) sum += vector[i];
  if (sum <= 0) {
    const uniform = 1 / vector.length;
    for (let i = 0; i < vector.length; i++) vector[i] = uniform;
    return vector;
  }
  for (let i = 0; i < vector.length; i++) vector[i] = vector[i] / sum;
  return vector;
}

/**
 * Iteración de potencia π_{k+1} = π_k · P desde la uniforme.
 * @returns {{pi: Float64Array, iterations: number, delta: number, converged: boolean}}
 */
export function powerStationary(
  P,
  size,
  { maxIter = 20000, tol = 1e-14, onProgress, shouldStop } = {}
) {
  let pi = new Float64Array(size).fill(1 / size);
  let next = new Float64Array(size);
  let delta = Infinity;
  let iterations = 0;
  let converged = false;

  for (let it = 1; it <= maxIter; it++) {
    next.fill(0);
    for (let i = 0; i < size; i++) {
      const p = pi[i];
      if (p === 0) continue;
      const row = i * size;
      for (let j = 0; j < size; j++) {
        const q = P[row + j];
        if (q !== 0) next[j] += p * q;
      }
    }

    delta = 0;
    for (let i = 0; i < size; i++) delta += Math.abs(next[i] - pi[i]);

    const swap = pi;
    pi = next;
    next = swap;
    iterations = it;

    if (delta < tol) {
      converged = true;
      break;
    }
    if (onProgress && it % 250 === 0) onProgress(it, delta);
    if (shouldStop && it % 250 === 0 && shouldStop()) {
      iterations = it;
      break;
    }
  }

  normalize(pi);
  return { pi, iterations, delta, converged };
}

/**
 * Resolución directa de π·P = π con Σπ = 1 (sustitución de una fila de
 * I − Pᵀ por la normalización + eliminación de Gauss con pivoteo parcial).
 * Es la alternativa exacta cuando la iteración de potencia no converge.
 */
export function solveStationary(P, size) {
  const A = new Float64Array(size * size);
  for (let i = 0; i < size; i++) {
    const row = i * size;
    for (let j = 0; j < size; j++) A[row + j] = (i === j ? 1 : 0) - P[j * size + i];
  }
  const b = new Float64Array(size);
  const last = (size - 1) * size;
  for (let j = 0; j < size; j++) A[last + j] = 1;
  b[size - 1] = 1;

  for (let col = 0; col < size; col++) {
    let pivot = col;
    let best = Math.abs(A[col * size + col]);
    for (let r = col + 1; r < size; r++) {
      const value = Math.abs(A[r * size + col]);
      if (value > best) {
        best = value;
        pivot = r;
      }
    }
    if (best < 1e-13) continue;

    if (pivot !== col) {
      for (let j = 0; j < size; j++) {
        const tmp = A[col * size + j];
        A[col * size + j] = A[pivot * size + j];
        A[pivot * size + j] = tmp;
      }
      const tmp = b[col];
      b[col] = b[pivot];
      b[pivot] = tmp;
    }

    const diagonal = A[col * size + col];
    for (let r = col + 1; r < size; r++) {
      const factor = A[r * size + col] / diagonal;
      if (factor === 0) continue;
      for (let j = col; j < size; j++) A[r * size + j] -= factor * A[col * size + j];
      b[r] -= factor * b[col];
    }
  }

  const pi = new Float64Array(size);
  for (let r = size - 1; r >= 0; r--) {
    let acc = b[r];
    for (let j = r + 1; j < size; j++) acc -= A[r * size + j] * pi[j];
    const diagonal = A[r * size + r];
    pi[r] = Math.abs(diagonal) < 1e-13 ? 0 : acc / diagonal;
    if (pi[r] < 0) pi[r] = 0;
  }

  normalize(pi);
  return pi;
}

/**
 * Curva TV(π₀·Pᵗ, π*) para t = 0 … steps.
 * @returns {number[]}
 */
export function tvOverTime(pi0, P, size, piStar, steps) {
  const values = [];
  let vector = normalize(Float64Array.from(pi0));
  values.push(totalVariation(vector, piStar));
  for (let t = 1; t <= steps; t++) {
    vector = matvec(vector, P, size);
    values.push(totalVariation(vector, piStar));
  }
  return values;
}

/**
 * Marginales exactas de una distribución π sobre Ω, en la MISMA forma que la
 * simulación empírica devuelve sus histogramas, para compararlas.
 * @returns {{edges: Float64Array, colors: Float64Array[], positions: Float64Array[]}}
 */
export function marginalsFromPi(pi, codec) {
  const { n, m, colorCount, size, pairs, decode } = codec;
  const maxEdges = (n * (n - 1)) / 2;
  const edges = new Float64Array(maxEdges + 1);
  const colors = Array.from({ length: colorCount }, () => new Float64Array(n + 1));
  const positions = Array.from({ length: n }, () => new Float64Array(m + 1));
  const colorCounts = new Int32Array(colorCount);

  for (let i = 0; i < size; i++) {
    const p = pi[i];
    if (p === 0) continue;
    const state = decode(i);

    colorCounts.fill(0);
    let count = 0;
    for (let q = 0; q < pairs.length; q++) {
      const [a, b] = pairs[q];
      if (state.adj[a] & (1 << b)) count += 1;
    }
    for (let v = 0; v < n; v++) colorCounts[state.color[v]] += 1;

    edges[count] += p;
    for (let c = 0; c < colorCount; c++) colors[c][colorCounts[c]] += p;
    // P[p_t(v) = x]: la marginal de la POSICIÓN de un vértice concreto
    for (let v = 0; v < n; v++) positions[v][state.pos[v]] += p;
  }

  return { edges, colors, positions };
}
