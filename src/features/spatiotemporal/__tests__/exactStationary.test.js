import { beforeAll, describe, expect, it } from 'vitest';
import { createSketch } from '../domain/sketch';
import { createModel } from '../domain/model';
import { createInitialState } from '../domain/initialState';
import { createRng } from '../../../shared/math/rng';
import {
  MAX_EXACT_STATES,
  buildTransitionMatrix,
  checkAperiodic,
  checkIrreducible,
  createStateCodec,
  factorial,
  marginalsFromPi,
  matvec,
  permRank,
  permUnrank,
  powerStationary,
  residual,
  solveStationary,
  totalVariation,
  tvOverTime,
} from '../engine/exactStationary';
import { parseStateKey, stateKey, tvCounts, createAccumulator, recordSample, summarize } from '../engine/stationaryRun';

/** X = P₃: conexo, X ≠ K₃, con 2 ≤ (c+1) ≤ 3 ⇒ |Ω| dentro del límite. */
const sketch = createSketch({ type: 'path', size: 3, colorCount: 3 });
const model = createModel({ sketch, k: 0.5, alpha: 1 });
const codec = createStateCodec({ n: 3, colorCount: 3 });

let P;

beforeAll(() => {
  P = buildTransitionMatrix({ codec, sketch, params: model.params });
});

describe('espacio de estados Ω para n = 3', () => {
  it('|Ω| = 2³ · (c+1)³ · 3! = 1296 y respeta el límite', () => {
    expect(factorial(3)).toBe(6);
    expect(codec.size).toBe(8 * 3 ** 3 * 6);
    expect(codec.size).toBe(1296);
    expect(codec.size).toBeLessThanOrEqual(MAX_EXACT_STATES);
  });

  it('n = 4 excede el límite (se rechaza explícitamente)', () => {
    expect(() => createStateCodec({ n: 4, colorCount: 3 })).toThrow(/supera el límite/);
  });

  it('encode ∘ decode = identidad para todos los estados', () => {
    for (let index = 0; index < codec.size; index++) {
      const state = codec.decode(index);
      expect(codec.encode(state)).toBe(index);
      // Estructura válida: aristas simétricas sin bucles, colores válidos,
      // y posiciones biyectivas
      for (let i = 0; i < 3; i++) {
        expect(state.adj[i] & (1 << i)).toBe(0);
        for (let j = 0; j < 3; j++) {
          expect(Boolean(state.adj[i] & (1 << j))).toBe(Boolean(state.adj[j] & (1 << i)));
        }
        expect(state.color[i]).toBeLessThan(3);
      }
      expect(new Set(state.pos).size).toBe(3);
    }
  });

  it('rango de Lehmer: rank/unrank son inversos', () => {
    for (let rank = 0; rank < factorial(4); rank++) {
      const perm = permUnrank(rank, 4);
      expect(isPermutation(perm)).toBe(true);
      expect(permRank(perm)).toBe(rank);
    }
  });
});

describe('matriz de transición P exacta', () => {
  it('todas las filas suman 1', () => {
    for (let i = 0; i < codec.size; i++) {
      let sum = 0;
      const row = i * codec.size;
      for (let j = 0; j < codec.size; j++) sum += P[row + j];
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it('no hay probabilidades negativas', () => {
    let min = Infinity;
    for (let k = 0; k < P.length; k++) if (P[k] < min) min = P[k];
    expect(min).toBeGreaterThanOrEqual(0);
  });

  it('la cadena es irreducible (conectividad fuerte)', () => {
    const check = checkIrreducible(P, codec.size);
    expect(check.ok).toBe(true);
    expect(check.reached).toBe(codec.size);
  });

  it('la cadena es aperiódica (existe un estado con P(S,S) > 0)', () => {
    const check = checkAperiodic(P, codec.size);
    expect(check.ok).toBe(true);
    expect(check.maxSelfLoop).toBeGreaterThan(0);
  });

  it('la comprobación de irreducibilidad detecta una matriz reducible', () => {
    const size = 3;
    const reducible = new Float64Array(size * size);
    reducible[0 * size + 0] = 1;
    reducible[1 * size + 1] = 0.5;
    reducible[1 * size + 2] = 0.5;
    reducible[2 * size + 2] = 1;
    expect(checkIrreducible(reducible, size).ok).toBe(false);
  });
});

describe('π* exacta', () => {
  it('es estacionaria: π*P = π* (residuo ≈ 0)', () => {
    const { pi, converged } = powerStationary(P, codec.size, { maxIter: 5000 });
    expect(converged).toBe(true);
    expect(residual(P, pi, codec.size)).toBeLessThan(1e-9);
    expect(totalVariation(matvec(pi, P, codec.size), pi)).toBeLessThan(1e-9);
  });

  it('Σ π*_i = 1 y π*_i ≥ 0', () => {
    const { pi } = powerStationary(P, codec.size, { maxIter: 5000 });
    let sum = 0;
    for (const value of pi) {
      expect(value).toBeGreaterThanOrEqual(0);
      sum += value;
    }
    expect(sum).toBeCloseTo(1, 10);
  });

  it('la iteración de potencia y la resolución directa dan la misma π*', () => {
    const { pi } = powerStationary(P, codec.size, { maxIter: 5000 });
    const direct = solveStationary(P, codec.size);
    expect(totalVariation(pi, direct)).toBeLessThan(1e-7);
  });

  it('π* no depende del estado inicial: TV(π₀Pᵗ, π*) → 0', () => {
    const { pi } = powerStationary(P, codec.size, { maxIter: 5000 });

    for (const preset of ['empty', 'complete', 'star']) {
      const state = createInitialState(
        {
          n: 3,
          m: 3,
          colorCount: 3,
          graphPreset: preset,
          colorPreset: 'unanimous1',
          positionPreset: 'identity',
        },
        createRng(3)
      );
      const pi0 = new Float64Array(codec.size);
      pi0[codec.encode(state)] = 1;

      const curve = tvOverTime(pi0, P, codec.size, pi, 300);
      expect(curve[0]).toBeGreaterThan(0);
      expect(curve[curve.length - 1]).toBeLessThan(1e-6);
      // La curva es decreciente en el régimen asintótico
      expect(curve[curve.length - 1]).toBeLessThan(curve[10]);
    }
  });

  it('las marginales de π* son distribuciones', () => {
    const { pi } = powerStationary(P, codec.size, { maxIter: 5000 });
    const { edges, colors, positions } = marginalsFromPi(pi, codec);

    const sumEdges = [...edges].reduce((a, b) => a + b, 0);
    expect(sumEdges).toBeCloseTo(1, 9);

    for (const marginal of [...colors, ...positions]) {
      expect([...marginal].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    }

    // p_t es biyectiva: en CADA estado hay exactamente un vértice en cada
    // posición, así que Σ_v P(p(v) = x) = 1 para toda posición x. (La
    // marginal de un vértice concreto NO tiene por qué ser uniforme.)
    for (let x = 0; x < 3; x++) {
      let occupancy = 0;
      for (const marginal of positions) occupancy += marginal[x];
      expect(occupancy).toBeCloseTo(1, 9);
    }
  });
});

describe('distancia de variación total', () => {
  it('TV(p, p) = 0, TV es simétrica y está acotada en [0, 1]', () => {
    const a = Float64Array.from([10, 0, 5, 5]);
    const b = Float64Array.from([5, 5, 5, 5]);
    expect(tvCounts(a, a)).toBe(0);
    expect(tvCounts(a, b)).toBeCloseTo(tvCounts(b, a), 12);
    expect(tvCounts(a, b)).toBeGreaterThan(0);
    expect(tvCounts(a, b)).toBeLessThanOrEqual(1);
  });

  it('los histogramas de conteos y de probabilidades dan la misma TV', () => {
    const counts = Float64Array.from([7, 3, 0]);
    const probs = Float64Array.from([0.7, 0.3, 0]);
    expect(tvCounts(counts, probs)).toBeLessThan(1e-15);
  });
});

describe('acumulador de muestreo', () => {
  it('los histogramas suman el número de muestras y las medias son coherentes', () => {
    const sketch6 = createSketch({ type: 'cycle', size: 6, colorCount: 3 });
    const model6 = createModel({ sketch: sketch6, k: 0.5, alpha: 1 });
    const rng = createRng(2026);

    let state = createInitialState(
      {
        n: 6,
        m: 6,
        colorCount: 3,
        graphPreset: 'complete',
        colorPreset: 'unanimous1',
        positionPreset: 'identity',
      },
      rng
    );

    const acc = createAccumulator({ n: 6, colorCount: 3, m: 6 });
    for (let t = 0; t < 400; t++) {
      state = model6.step(state, rng);
      const edges = countEdges(state);
      recordSample(acc, state, {
        edges,
        colorCounts: countColors(state, 3),
      });
    }

    const stats = summarize(acc);
    expect(stats.samples).toBe(400);

    const edgeTotal = stats.edges.counts.reduce((a, b) => a + b, 0);
    expect(edgeTotal).toBe(400);

    for (const histogram of stats.colors) {
      expect(histogram.counts.reduce((a, b) => a + b, 0)).toBe(400);
    }

    // Cada coloración reparte exactamente 6 vértices
    let totalVertices = 0;
    for (let i = 0; i < 3; i++) totalVertices += stats.meanColorCounts[i];
    expect(totalVertices).toBeCloseTo(6, 9);

    expect(stats.stdEdges).toBeGreaterThanOrEqual(0);
  });

  it('stateKey/parseStateKey son inversos', () => {
    const sketch6 = createSketch({ type: 'cycle', size: 6, colorCount: 3 });
    const state = {
      n: 6,
      adj: Int32Array.from([0b000010, 0b000010, 0, 0, 0, 0]),
      color: Uint8Array.from([0, 2, 1, 0, 2, 1]),
      pos: Uint8Array.from([5, 4, 3, 2, 1, 0]),
    };
    void sketch6;
    const key = stateKey(state);
    const parsed = parseStateKey(key, 6);
    expect(parsed.colors).toEqual([0, 2, 1, 0, 2, 1]);
    expect(parsed.positions).toEqual([5, 4, 3, 2, 1, 0]);
    expect(parsed.edgeCount).toBe(1);
  });
});

function isPermutation(values) {
  return new Set(values).size === values.length;
}

function countEdges(state) {
  let count = 0;
  for (let i = 0; i < state.n; i++) {
    for (let j = i + 1; j < state.n; j++) if (state.adj[i] & (1 << j)) count++;
  }
  return count;
}

function countColors(state, colorCount) {
  const counts = new Array(colorCount).fill(0);
  for (const value of state.color) counts[value]++;
  return counts;
}
