import { createRng } from '../../../shared/math/rng';
import { createInitialState } from '../domain/initialState';
import { computeObservables } from '../domain/observables';
import { integerHistogram, mean, spread, std } from '../../../shared/math/stats';

/**
 * Experimento de ergodicidad (póster, sección 04).
 *
 * Lanza `chainsPerCondition` cadenas independientes para cada condición inicial
 * π₀ distinta (Kₙ+C₁, K₁,ₙ₋₁+C₂, Kₙ+C₀), todas bajo el MISMO modelo
 * (X, {C^X_i}, k, α). Si la cadena es irreducible y aperiódica existe una
 * única π* y las medias por condición deben converger a los mismos valores,
 * es decir, el equilibrio no depende del estado inicial.
 *
 * Se ejecuta por trozos (`runChunk`) para poder avanzarla desde
 * requestAnimationFrame sin bloquear la interfaz.
 */
export function createErgodicExperiment({
  model,
  conditions,
  chainsPerCondition = 10,
  steps = 3000,
  seed = 1,
  finalWindow = 0.25,
}) {
  const { n, colorCount, sketch } = model;

  // --- Cadenas (estado + acumuladores de la ventana final) -------------------
  const chains = [];
  conditions.forEach((cond, c) => {
    for (let r = 0; r < chainsPerCondition; r++) {
      const rng = createRng(seed + 97 * c + 13 * r + 1);
      chains.push({
        cond: c,
        rng,
        state: createInitialState(
          {
            n,
            m: sketch.size,
            colorCount,
            graphPreset: cond.graphPreset,
            colorPreset: cond.colorPreset,
            positionPreset: 'identity',
          },
          rng
        ),
        sumEdges: 0,
        sumColors: new Float64Array(colorCount),
        count: 0,
      });
    }
  });

  // --- Series (media entre cadenas, en cada instante t) ----------------------
  const series = conditions.map(() => ({
    edges: [],
    colors: Array.from({ length: colorCount }, () => []),
  }));
  const spreadEdges = []; // max − min de las medias de |E| entre condiciones
  const windowSamples = conditions.map(() => []); // |E| de la ventana final

  const windowStart = Math.floor(steps * (1 - finalWindow));
  let t = 0;
  let finished = false;
  let cachedResult = null;

  // Media de |E| de cada condición en t = 0 (para medir el olvido de π₀)
  const initialMeans = conditions.map((_, c) =>
    computeObservables(chains.find((ch) => ch.cond === c).state, colorCount).edges
  );

  /** Avanza `chunk` instantes globales (todas las cadenas, un paso cada una). */
  function runChunk(chunk) {
    if (finished) return;
    for (let s = 0; s < chunk && t < steps; s++) {
      for (const chain of chains) chain.state = model.step(chain.state, chain.rng);
      t += 1;

      const accEdges = new Float64Array(conditions.length);
      const accColors = conditions.map(() => new Float64Array(colorCount));
      const counts = new Float64Array(conditions.length);

      for (const chain of chains) {
        const obs = computeObservables(chain.state, colorCount);
        const c = chain.cond;
        accEdges[c] += obs.edges;
        counts[c] += 1;
        for (let i = 0; i < colorCount; i++) accColors[c][i] += obs.colorFractions[i];

        if (t > windowStart) {
          chain.sumEdges += obs.edges;
          chain.count += 1;
          for (let i = 0; i < colorCount; i++) chain.sumColors[i] += obs.colorFractions[i];
          windowSamples[c].push(obs.edges);
        }
      }

      const means = [];
      for (let c = 0; c < conditions.length; c++) {
        const meanEdges = accEdges[c] / counts[c];
        means.push(meanEdges);
        series[c].edges.push(meanEdges);
        for (let i = 0; i < colorCount; i++) {
          series[c].colors[i].push(accColors[c][i] / counts[c]);
        }
      }
      spreadEdges.push(spread(means));
    }

    if (t >= steps) finished = true;
  }

  /** Estadísticos finales (se calculan una sola vez, al terminar). */
  function buildResult() {
    if (cachedResult) return cachedResult;

    const early = spreadEdges.slice(0, Math.max(1, Math.floor(steps * 0.1)));
    const late = spreadEdges.slice(Math.floor(steps * 0.9));

    const byCondition = conditions.map((cond, c) => {
      const edgeMeans = [];
      const colorMeans = Array.from({ length: colorCount }, () => []);
      for (const chain of chains) {
        if (chain.cond !== c || chain.count === 0) continue;
        edgeMeans.push(chain.sumEdges / chain.count);
        for (let i = 0; i < colorCount; i++) colorMeans[i].push(chain.sumColors[i] / chain.count);
      }
      return {
        ...cond,
        meanEdges: mean(edgeMeans),
        stdEdges: std(edgeMeans),
        meanFractions: colorMeans.map((values) => mean(values)),
        edgeHistogram: integerHistogram(windowSamples[c]),
        samples: windowSamples[c].length,
      };
    });

    const windowMeans = byCondition.map((cond) => cond.meanEdges);

    cachedResult = {
      steps,
      t,
      chainsPerCondition,
      windowStart,
      finalWindow,
      series,
      spread: {
        start: spread(initialMeans), // dispersión entre condiciones en t = 0
        final: spread(windowMeans), // dispersión entre medias de la ventana final
        early: mean(early),
        late: mean(late),
        values: spreadEdges, // serie temporal (max − min de ⟨|E|⟩) por instante
      },
      conditions: byCondition,
    };
    return cachedResult;
  }

  return {
    steps,
    conditions,
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
