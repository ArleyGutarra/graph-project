import { createModel } from '../domain/model';
import { createSketch } from '../domain/sketch';
import { createInitialState } from '../domain/initialState';
import { createRng } from '../../../shared/math/rng';
import {
  buildTransitionMatrix,
  checkAperiodic,
  checkIrreducible,
  createStateCodec,
  marginalsFromPi,
  powerStationary,
  residual,
  solveStationary,
  tvOverTime,
} from './exactStationary';
import { createStationaryRun, tvCounts } from './stationaryRun';

/**
 * Worker del modo "Estacionaria".
 *
 * Todo lo pesado (10⁵–10⁶ pasos, construcción de P exacta, iteración de
 * potencia) ocurre AQUÍ, fuera del hilo principal, para que la interfaz nunca
 * se congele. La comunicación es por postMessage:
 *
 *   → { type: 'run',    payload }   lanza la simulación empírica
 *   → { type: 'exact',  payload }   calcula π* exacta para n = 3
 *   → { type: 'cancel' }           detiene el trabajo en curso
 *
 *   ← { type: 'run:progress' | 'run:done' | 'run:cancelled' }
 *   ← { type: 'exact:progress' | 'exact:done' }
 *   ← { type: 'error', message }
 */

let cancelled = false;
let job = null;

self.onmessage = (event) => {
  const { type, key, payload } = event.data;
  if (type === 'cancel') {
    cancelled = true;
    return;
  }
  try {
    cancelled = false;
    job = type;
    if (type === 'run') runSimulation(payload, key);
    else if (type === 'exact') runExact(payload);
  } catch (error) {
    const message = error?.message ?? String(error);
    self.postMessage({
      type: job === 'exact' ? 'exact:error' : 'run:error',
      key,
      message,
    });
  }
};

/**
 * `n` (vértices de G) viene del payload porque puede ser menor que `m`
 * (posiciones de X) cuando el usuario borró vértices en la vista Configurar.
 * Si no llega, se asume el caso n = m.
 */
function buildModel(payload) {
  const sketch = createSketch(payload.sketchConfig);
  const model = createModel({
    sketch,
    k: payload.params.k,
    alpha: payload.params.alpha,
    n: payload.n ?? sketch.size,
  });
  return { sketch, model };
}

/** Ejecuta T pasos (1 ó 3 cadenas) con presupuesto de tiempo por enfoque. */
function runSimulation(payload, key) {
  const { model } = buildModel(payload);
  const run = createStationaryRun({
    model,
    conditions: payload.conditions,
    steps: payload.steps,
    burnIn: payload.burnIn,
    seed: payload.seed,
    checkpoints: payload.checkpoints ?? 60,
    trackTop: payload.trackTop ?? true,
    topStride: payload.topStride ?? 1,
    seriesStride: payload.seriesStride ?? Math.max(1, Math.round(payload.steps / 400)),
  });

  const SLICE_MS = 24;

  const tick = () => {
    if (cancelled) {
      self.postMessage({ type: 'run:cancelled', key });
      return;
    }

    const started = performance.now();
    while (performance.now() - started < SLICE_MS) {
      run.runChunk(256);
      if (run.finished) break;
    }

    if (run.finished) {
      self.postMessage({ type: 'run:done', key, result: run.buildResult() });
      return;
    }

    self.postMessage({ type: 'run:progress', key, progress: run.progress, t: run.t });
    setTimeout(tick, 0);
  };

  setTimeout(tick, 0);
}

/**
 * π* exacta: enumera Ω, construye P con los kernels del modelo, verifica
 * irreducibilidad y aperiodicidad y resuelve π·P = π.
 */
function runExact(payload) {
  const { sketch, model } = buildModel(payload);
  const codec = createStateCodec({ n: model.n, m: sketch.size, colorCount: model.colorCount });

  self.postMessage({ type: 'exact:progress', phase: 'matrix', progress: 0 });
  const P = buildTransitionMatrix({
    codec,
    sketch,
    params: model.params,
    onProgress: (done, total) => {
      if (cancelled) throw new Error('Cálculo exacto cancelado.');
      self.postMessage({
        type: 'exact:progress',
        phase: 'matrix',
        progress: total > 0 ? done / total : 0,
      });
    },
  });

  if (cancelled) throw new Error('Cálculo exacto cancelado.');

  self.postMessage({ type: 'exact:progress', phase: 'checks', progress: 0 });
  const irreducible = checkIrreducible(P, codec.size);
  const aperiodic = checkAperiodic(P, codec.size);

  self.postMessage({ type: 'exact:progress', phase: 'power', progress: 0 });
  let { pi, iterations, delta, converged } = powerStationary(P, codec.size, {
    maxIter: 20000,
    shouldStop: () => cancelled,
    onProgress: (it, d) =>
      self.postMessage({
        type: 'exact:progress',
        phase: 'power',
        progress: Math.min(0.99, it / 20000),
        iterations: it,
        delta: d,
      }),
  });

  if (cancelled) throw new Error('Cálculo exacto cancelado.');

  let method = 'power';
  let error = residual(P, pi, codec.size);
  if (!converged || error > 1e-9) {
    // Resolución directa del sistema π·P = π (autovector izquierdo exacto)
    pi = solveStationary(P, codec.size);
    method = 'direct';
    error = residual(P, pi, codec.size);
    converged = error <= 1e-8;
  }

  // π₀ elegido: la primera condición inicial (π₀⁽¹⁾), masa unitaria
  const first = payload.conditions[0];
  const initialState = createInitialState(
    {
      n: codec.n,
      m: sketch.size,
      colorCount: codec.colorCount,
      graphPreset: first?.graphPreset ?? 'empty',
      colorPreset: first?.colorPreset ?? 'unanimous1',
      positionPreset: 'identity',
    },
    createRng(1)
  );
  const pi0Index = codec.encode(initialState);
  const pi0 = new Float64Array(codec.size);
  pi0[pi0Index] = 1;

  const marginals = marginalsFromPi(pi, codec);
  const tvCurve = tvOverTime(pi0, P, codec.size, pi, payload.tvSteps ?? 120);

  // TV entre π* exacta y π* empírica (la misma distribución de referencia)
  const comparison =
    payload.empiricalEdges && payload.empiricalEdges.length === marginals.edges.length
      ? tvCounts(payload.empiricalEdges, marginals.edges)
      : null;

  self.postMessage({
    type: 'exact:done',
    result: {
      size: codec.size,
      matrixBytes: P.length * 8,
      irreducible,
      aperiodic,
      iterations,
      delta,
      converged,
      method,
      residual: error,
      marginals,
      tvCurve,
      comparison,
    },
  });
}
