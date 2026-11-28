import { createRng } from '../../../shared/math/rng';
import { createInitialState } from '../domain/initialState';
import { computeObservables } from '../domain/observables';

/**
 * Motor del modo "Estacionaria" (póster, sección 04: π* y su independencia
 * de π₀).
 *
 * Ejecuta 1 ó 3 cadenas en paralelo (intercaladas, mismo modelo) durante
 * `steps` pasos, SIN animación, y acumula las marginales de π*:
 *
 *   a) |E(G_t)| ∈ {0 … n(n−1)/2}
 *   b) nº de vértices en cada color
 *   c) posición de cada vértice en X   (ver nota abajo)
 *   d) estados completos más visitados (muestreados)
 *
 * Además calcula, en puntos de control equiespaciados, la distancia de
 * variación total entre las tres cadenas → la curva decreciente que verifica
 * la independencia de π₀.
 *
 * NOTA sobre (c): como n = m y p_t es SIEMPRE una biyección (la composición de
 * permutaciones la preserva), la ocupación de cada posición de X es
 * trivialmente 1. Por eso la marginal que se muestra es la de CADA VÉRTEXE:
 * P[p_t(v) = x], que sí depende de π*.
 *
 * Todo aquí es puro (sin React ni DOM) para poder correr dentro de un Worker.
 */

/** Clave compacta de un estado completo (para "estados más visitados"). */
export function stateKey(state) {
  const { n, adj, color, pos } = state;
  let bits = '';
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) bits += adj[i] & (1 << j) ? '1' : '0';
  }
  let colors = '';
  for (let v = 0; v < n; v++) colors += color[v].toString(36);
  let positions = '';
  for (let v = 0; v < n; v++) positions += pos[v].toString(36);
  return `${bits}|${colors}|${positions}`;
}

/** Reconstruye la tupla legible de una clave de estado. */
export function parseStateKey(key, n) {
  const [bits, colors, positions] = key.split('|');
  const edgeList = [];
  let cursor = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (bits[cursor++] === '1') edgeList.push([i, j]);
    }
  }
  return {
    edges: edgeList,
    colors: [...colors].map((c) => parseInt(c, 36)),
    positions: [...positions].map((c) => parseInt(c, 36)),
    edgeCount: edgeList.length,
  };
}

export function createAccumulator({ n, colorCount, m }) {
  const maxEdges = (n * (n - 1)) / 2;
  return {
    n,
    colorCount,
    m,
    maxEdges,
    samples: 0,
    edges: new Float64Array(maxEdges + 1),
    colorCounts: Array.from({ length: colorCount }, () => new Float64Array(n + 1)),
    positions: Array.from({ length: n }, () => new Float64Array(m + 1)),
    sumEdges: 0,
    sumEdges2: 0,
    sumColorCounts: new Float64Array(colorCount),
    sumColorCounts2: new Float64Array(colorCount),
    // Serie del promedio ergódico acumulado de |E|
    seriesT: [],
    seriesMean: [],
  };
}

/** Registra una muestra del estado (una vez superado el burn-in). */
export function recordSample(acc, state, obs) {
  acc.samples += 1;
  acc.edges[obs.edges] += 1;
  acc.sumEdges += obs.edges;
  acc.sumEdges2 += obs.edges * obs.edges;

  for (let i = 0; i < acc.colorCount; i++) {
    const value = obs.colorCounts[i];
    acc.colorCounts[i][value] += 1;
    acc.sumColorCounts[i] += value;
    acc.sumColorCounts2[i] += value * value;
  }
  for (let v = 0; v < acc.n; v++) acc.positions[v][state.pos[v]] += 1;
}

/** Convierte conteos en histograma normalizado {xs, counts, probs}. */
function toHistogram(counts) {
  const xs = [];
  const out = [];
  let total = 0;
  for (let i = 0; i < counts.length; i++) total += counts[i];
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > 0 || counts.length <= 32) {
      xs.push(i);
      out.push(counts[i]);
    }
  }
  return { xs, counts: out, probs: out.map((c) => (total > 0 ? c / total : 0)) };
}

/** Estadísticos bajo π* de un acumulador. */
export function summarize(acc) {
  const samples = acc.samples;
  const meanEdges = samples > 0 ? acc.sumEdges / samples : 0;
  const variance =
    samples > 1 ? Math.max(0, (acc.sumEdges2 - samples * meanEdges * meanEdges)) / (samples - 1) : 0;

  const meanColorCounts = Array.from(acc.sumColorCounts, (sum) =>
    samples > 0 ? sum / samples : 0
  );
  const stdColorCounts = Array.from(acc.sumColorCounts2, (sum2, i) => {
    if (samples < 2) return 0;
    const m = meanColorCounts[i];
    return Math.sqrt(Math.max(0, (sum2 - samples * m * m) / (samples - 1)));
  });

  return {
    samples,
    meanEdges,
    stdEdges: Math.sqrt(variance),
    meanColorCounts,
    stdColorCounts,
    edges: toHistogram(acc.edges),
    colors: acc.colorCounts.map(toHistogram),
    positions: acc.positions.map(toHistogram),
    series: { t: acc.seriesT, mean: acc.seriesMean },
  };
}

/** Distancia de variación total entre dos histogramas de conteos. */
export function tvCounts(a, b) {
  let totalA = 0;
  let totalB = 0;
  for (let i = 0; i < a.length; i++) {
    totalA += a[i];
    totalB += b[i];
  }
  if (totalA === 0 || totalB === 0) return totalA === totalB ? 0 : 1;
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc += Math.abs(a[i] / totalA - b[i] / totalB);
  return acc / 2;
}

function snapshot(acc) {
  return {
    samples: acc.samples,
    edges: Float64Array.from(acc.edges),
    colorCounts: acc.colorCounts.map((c) => Float64Array.from(c)),
    positions: acc.positions.map((c) => Float64Array.from(c)),
  };
}

/**
 * Crea un experimento Estacionaria.
 *
 * @param {object} args
 * @param {object} args.model      modelo de `createModel`
 * @param {Array}  args.conditions  estados iniciales π₀ (1 o 3)
 * @param {number} args.steps       T · pasos totales por cadena
 * @param {number} args.burnIn      B · pasos descartados al inicio
 * @param {number} args.seed        semilla (reproducible)
 * @param {number} [args.checkpoints] puntos de control para la curva TV(t)
 * @param {boolean} [args.trackTop]  ¿acumular los estados más visitados?
 * @param {number} [args.seriesStride] muestreo de la media ergódica
 */
export function createStationaryRun({
  model,
  conditions,
  steps,
  burnIn,
  seed,
  checkpoints = 60,
  trackTop = true,
  topStride = 1,
  maxTopKeys = 250000,
  seriesStride = 1,
}) {
  const { n, colorCount, sketch } = model;
  const m = sketch.size;
  const cleanBurnIn = Math.max(0, Math.min(burnIn, steps - 1));

  const chains = conditions.map((cond, c) => {
    const rng = createRng(seed + 997 * c + 1);
    return {
      cond,
      rng,
      state: createInitialState(
        {
          n,
          m,
          colorCount,
          graphPreset: cond.graphPreset,
          colorPreset: cond.colorPreset,
          positionPreset: cond.positionPreset ?? 'identity',
        },
        rng
      ),
      acc: createAccumulator({ n, colorCount, m }),
      top: new Map(),
    };
  });

  // Puntos de control de la curva TV(t): dentro de la ventana posterior a B
  const marks = [];
  if (checkpoints > 0 && steps > cleanBurnIn) {
    for (let i = 1; i <= checkpoints; i++) {
      marks.push(cleanBurnIn + Math.round(((steps - cleanBurnIn) * i) / checkpoints));
    }
  }
  let markCursor = 0;
  const snapshots = [];

  let t = 0;
  let finished = false;
  let cachedResult = null;

  /** Avanza `chunk` instantes (todas las cadenas un paso cada una). */
  function runChunk(chunk) {
    if (finished) return;
    for (let s = 0; s < chunk && t < steps; s++) {
      t += 1;
      const inWindow = t > cleanBurnIn;

      for (const chain of chains) {
        chain.state = model.step(chain.state, chain.rng);
        if (!inWindow) continue;

        const obs = computeObservables(chain.state, colorCount);
        recordSample(chain.acc, chain.state, obs);

        if (t % seriesStride === 0) {
          chain.acc.seriesT.push(t);
          chain.acc.seriesMean.push(chain.acc.sumEdges / chain.acc.samples);
        }

        if (trackTop && t % topStride === 0) {
          const key = stateKey(chain.state);
          const current = chain.top.get(key);
          if (current !== undefined) {
            // Los conteos de las claves registradas son EXACTOS.
            chain.top.set(key, current + 1);
          } else if (chain.top.size < maxTopKeys) {
            chain.top.set(key, 1);
          }
          // Al llegar a `maxTopKeys` no se registran claves nuevas: así la
          // memoria queda acotada con T = 10⁶. Se indica en la interfaz.
        }
      }

      if (markCursor < marks.length && t === marks[markCursor]) {
        snapshots.push(chains.map((chain) => snapshot(chain.acc)));
        markCursor += 1;
      }
    }

    if (t >= steps) finished = true;
  }

  function buildResult() {
    if (cachedResult) return cachedResult;

    // Curva TV(t): se comparan las cadenas de dos en dos en cada control
    const tv = { edges: [], colors: [], positions: [], max: [] };
    for (const snap of snapshots) {
      let maxEdges = 0;
      let sumColors = 0;
      let colorPairs = 0;
      let sumPositions = 0;
      let positionPairs = 0;

      for (let a = 0; a < snap.length; a++) {
        for (let b = a + 1; b < snap.length; b++) {
          const e = tvCounts(snap[a].edges, snap[b].edges);
          maxEdges = Math.max(maxEdges, e);

          for (let i = 0; i < colorCount; i++) {
            sumColors += tvCounts(snap[a].colorCounts[i], snap[b].colorCounts[i]);
            colorPairs += 1;
          }
          for (let v = 0; v < n; v++) {
            sumPositions += tvCounts(snap[a].positions[v], snap[b].positions[v]);
            positionPairs += 1;
          }
        }
      }

      const meanColors = colorPairs > 0 ? sumColors / colorPairs : 0;
      const meanPositions = positionPairs > 0 ? sumPositions / positionPairs : 0;
      tv.edges.push(maxEdges);
      tv.colors.push(meanColors);
      tv.positions.push(meanPositions);
      tv.max.push(Math.max(maxEdges, meanColors, meanPositions));
    }

    const seriesMarks = snapshots.map((snap) => (snap[0] ? snap[0].samples : 0));

    cachedResult = {
      steps,
      burnIn: cleanBurnIn,
      seed,
      checkpoints: marks,
      seriesMarks,
      chainLabels: chains.map((chain) => chain.cond.label),
      chains: chains.map((chain) => ({
        id: chain.cond.id,
        label: chain.cond.label,
        graphPreset: chain.cond.graphPreset,
        colorPreset: chain.cond.colorPreset,
        ...summarize(chain.acc),
        topStates: trackTop
          ? [...chain.top.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 20)
              .map(([key, count]) => ({
                key,
                count,
                probability: chain.acc.samples > 0 ? count / chain.acc.samples : 0,
                ...parseStateKey(key, n),
              }))
          : [],
      })),
      tv: {
        marks: seriesMarks,
        edges: tv.edges,
        colors: tv.colors,
        positions: tv.positions,
        max: tv.max,
        pairCount: Math.floor((conditions.length * (conditions.length - 1)) / 2),
      },
    };
    return cachedResult;
  }

  return {
    steps,
    conditions,
    checkpoints: marks,
    get t() {
      return t;
    },
    get progress() {
      return steps > 0 ? t / steps : 1;
    },
    get finished() {
      return finished;
    },
    runChunk,
    buildResult,
  };
}
