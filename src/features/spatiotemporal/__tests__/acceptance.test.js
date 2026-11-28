import { describe, expect, it } from 'vitest';
import { createSketch } from '../domain/sketch';
import { createModel } from '../domain/model';
import { buildConditions } from '../domain/initialState';
import { createStationaryRun, tvCounts } from '../engine/stationaryRun';
import {
  buildTransitionMatrix,
  createStateCodec,
  marginalsFromPi,
  powerStationary,
  residual,
} from '../engine/exactStationary';

const T = 1_000_000;
const B = 100_000;

function runStationary({ type, size, colorCount, conditions, steps, burnIn, seed = 2026 }) {
  const sketch = createSketch({ type, size, colorCount });
  const model = createModel({ sketch, k: 0.5, alpha: 1 });
  const run = createStationaryRun({
    model,
    conditions,
    steps,
    burnIn,
    seed,
    checkpoints: 60,
    trackTop: false,
    seriesStride: Math.max(1, Math.round(steps / 400)),
  });
  while (!run.finished) run.runChunk(4096);
  return { sketch, model, result: run.buildResult() };
}

describe('Criterio 1 · histogramas estables con X = C₆, n = 6, T = 10⁶', () => {
  it(
    'media y desviación de |E| estables entre la primera y la segunda mitad',
    () => {
      const sketch = createSketch({ type: 'cycle', size: 6, colorCount: 3 });
      const model = createModel({ sketch, k: 0.5, alpha: 1 });
      const run = createStationaryRun({
        model,
        conditions: [buildConditions(3)[0]],
        steps: T,
        burnIn: B,
        seed: 2026,
        checkpoints: 60,
        trackTop: false,
        seriesStride: 2500,
      });
      while (!run.finished) run.runChunk(8192);

      const result = run.buildResult();
      const chain = result.chains[0];

      // a) muestras y histograma
      expect(chain.samples).toBe(T - B);
      const total = chain.edges.counts.reduce((a, b) => a + b, 0);
      expect(total).toBe(T - B);
      expect(chain.edges.xs[0]).toBe(0);
      expect(chain.edges.xs.at(-1)).toBeLessThanOrEqual(15);

      // b) media y desviación razonables y finitas
      expect(Number.isFinite(chain.meanEdges)).toBe(true);
      expect(chain.meanEdges).toBeGreaterThan(0);
      expect(chain.meanEdges).toBeLessThan(15);
      expect(chain.stdEdges).toBeGreaterThan(0);

      // c) estabilidad: el promedio de cada mitad de la ventana difiere poco
      const mean = chain.series.mean;
      const half = Math.floor(mean.length / 2);
      const first = mean.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const second = mean.slice(half).reduce((a, b) => a + b, 0) / (mean.length - half);
      expect(Math.abs(first - second)).toBeLessThan(0.5);

      // d) el promedio ergódico acumulado converge a la media empírica
      expect(Math.abs(mean.at(-1) - chain.meanEdges)).toBeLessThan(0.05);

      console.log(
        `[C1] ⟨|E|⟩ = ${chain.meanEdges.toFixed(3)} ± ${chain.stdEdges.toFixed(3)} · ` +
          `mitades ${first.toFixed(3)} / ${second.toFixed(3)} · ergódico ${mean.at(-1).toFixed(3)}`
      );
    },
    600_000
  );
});

describe('Criterio 2 · las 3 cadenas con distinto π₀ coinciden', () => {
  it(
    'TV final < 0.02 y curva TV(t) decreciente',
    () => {
      const { result } = runStationary({
        type: 'cycle',
        size: 6,
        colorCount: 3,
        conditions: buildConditions(3),
        steps: T,
        burnIn: B,
      });

      expect(result.chains).toHaveLength(3);
      for (const chain of result.chains) expect(chain.samples).toBe(T - B);

      const finalTv = result.tv.max.at(-1);
      const firstTv = result.tv.max[0];
      const meanFirst = result.tv.max
        .slice(0, 5)
        .reduce((a, b) => a + b, 0) / 5;

      console.log(
        `[C2] TV: primero ${firstTv.toFixed(4)} · media inicio ${meanFirst.toFixed(4)} · ` +
          `final ${finalTv.toFixed(4)} · |E| final ${result.tv.edges.at(-1).toFixed(4)}`
      );

      expect(finalTv).toBeLessThan(0.02);
      // Decrece claramente desde el arranque
      expect(finalTv).toBeLessThan(meanFirst);

      // Superposición: las medias de las 3 cadenas casi idénticas
      const means = result.chains.map((c) => c.meanEdges);
      const spread = Math.max(...means) - Math.min(...means);
      expect(spread).toBeLessThan(0.1);
    },
    600_000
  );
});

describe('Criterio 3 · π* exacta vs empírica con n = 3', () => {
  it(
    'TV(empírica, exacta) dentro del error de Monte Carlo',
    () => {
      const { result } = runStationary({
        type: 'path',
        size: 3,
        colorCount: 3,
        conditions: [buildConditions(3)[0]],
        steps: T,
        burnIn: B,
      });

      const sketch = createSketch({ type: 'path', size: 3, colorCount: 3 });
      const model = createModel({ sketch, k: 0.5, alpha: 1 });
      const codec = createStateCodec({ n: model.n, m: sketch.size, colorCount: model.colorCount });
      expect(codec.size).toBe(1296);

      const P = buildTransitionMatrix({ codec, sketch, params: model.params });
      const { pi, converged } = powerStationary(P, codec.size, { maxIter: 5000 });
      expect(converged).toBe(true);
      expect(residual(P, pi, codec.size)).toBeLessThan(1e-9);

      const exact = marginalsFromPi(pi, codec);
      const empirical = result.chains[0].edges;
      const tv = tvCounts(empirical.counts, exact.edges);

      console.log(`[C3] TV(empírica, exacta) = ${tv.toFixed(5)} · |Ω| = ${codec.size}`);

      expect(tv).toBeLessThan(0.02);
    },
    600_000
  );
});
