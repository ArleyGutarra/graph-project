import { describe, expect, it } from 'vitest';
import { createSketch } from '../domain/sketch';
import { createModel } from '../domain/model';
import { createInitialState } from '../domain/initialState';
import { createRng } from '../../../shared/math/rng';
import { edgeProbability } from '../domain/kernels/edges';
import { colorProbabilities } from '../domain/kernels/colors';

const N = 6;

describe('probabilidades de conexión / desconexión (póster)', () => {
  it('caso 1: ausente ∧ posiciones adyacentes ⇒ (d_i+1)(d_j+1)/(n+1)²', () => {
    for (const [di, dj] of [
      [0, 0],
      [0, 3],
      [5, 5],
      [2, 4],
    ]) {
      expect(edgeProbability(false, true, di, dj, N)).toBeCloseTo(
        ((di + 1) * (dj + 1)) / (N + 1) ** 2,
        15
      );
    }
  });

  it('caso 2: presente ∧ posiciones NO adyacentes ⇒ 1 − d_i·d_j/n²', () => {
    for (const [di, dj] of [
      [0, 0],
      [1, 2],
      [5, 5],
    ]) {
      expect(edgeProbability(true, false, di, dj, N)).toBeCloseTo(
        1 - (di * dj) / N ** 2,
        15
      );
    }
  });

  it('completación: ausente ∧ no adyacente ⇒ 0 (X es el ancla) y la permanencia aplica a todo par presente', () => {
    expect(edgeProbability(false, false, 3, 4, N)).toBe(0);
    // La fórmula de permanencia se aplica también cuando las posiciones sí son
    // adyacentes: es lo que garantiza la irreducibilidad (ver nota en edges.js).
    expect(edgeProbability(true, true, 3, 4, N)).toBeCloseTo(1 - (3 * 4) / N ** 2, 15);
    expect(edgeProbability(true, true, 0, 0, N)).toBe(1);
  });

  it('todas las probabilidades quedan en [0, 1] para cualquier grado', () => {
    for (let n = 2; n <= 8; n++) {
      for (let di = 0; di <= n - 1; di++) {
        for (let dj = 0; dj <= n - 1; dj++) {
          for (const linked of [true, false]) {
            for (const present of [true, false]) {
              const p = edgeProbability(present, linked, di, dj, n);
              expect(p).toBeGreaterThanOrEqual(0);
              expect(p).toBeLessThanOrEqual(1);
            }
          }
        }
      }
    }
  });

  it('d(v) = 0 no produce división por cero', () => {
    expect(edgeProbability(false, true, 0, 0, N)).toBeCloseTo(1 / (N + 1) ** 2, 15);
    expect(edgeProbability(true, false, 0, 0, N)).toBe(1);
  });
});

describe('probabilidades de coloración', () => {
  const sketch = createSketch({ type: 'cycle', size: 6, colorCount: 3 });

  function stateWith({ graphPreset, colorPreset }) {
    const rng = createRng(7);
    return createInitialState(
      {
        n: 6,
        m: sketch.size,
        colorCount: sketch.colorCount,
        graphPreset,
        colorPreset,
        positionPreset: 'identity',
      },
      rng
    );
  }

  it('Σ_i P[v ∈ C_i] = 1 para todo vértice y todo estado de prueba', () => {
    const cases = [
      { graphPreset: 'complete', colorPreset: 'unanimous0' },
      { graphPreset: 'empty', colorPreset: 'unanimous1' },
      { graphPreset: 'star', colorPreset: 'unanimous2' },
      { graphPreset: 'random', colorPreset: 'alternating' },
      { graphPreset: 'path', colorPreset: 'random' },
    ];

    for (const params of [
      { k: 0.5, alpha: 1 },
      { k: 0.05, alpha: 0.1 },
      { k: 0.95, alpha: 5 },
      { k: 0, alpha: 1 },
      { k: 1, alpha: 1 },
    ]) {
      const model = createModel({ sketch, ...params });
      for (const spec of cases) {
        const state = stateWith(spec);
        for (let v = 0; v < 6; v++) {
          const probs = colorProbabilities(state, sketch, model.params, v);
          const sum = probs.reduce((acc, p) => acc + p, 0);
          expect(sum).toBeCloseTo(1, 12);
          for (const p of probs) {
            expect(p).toBeGreaterThanOrEqual(0);
            expect(p).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('k·1{i=0} hace que P[v ∈ C₀] ≥ k', () => {
    const model = createModel({ sketch, k: 0.7, alpha: 1 });
    const state = stateWith({ graphPreset: 'random', colorPreset: 'alternating' });
    for (let v = 0; v < 6; v++) {
      const probs = colorProbabilities(state, sketch, model.params, v);
      expect(probs[0]).toBeGreaterThanOrEqual(0.7 - 1e-12);
    }
  });

  it('caso degenerado α = 0 y d = 0: devuelve la uniforme (nunca NaN)', () => {
    const model = createModel({ sketch, k: 0.5, alpha: 0 });
    const state = stateWith({ graphPreset: 'empty', colorPreset: 'unanimous0' });
    for (let v = 0; v < 6; v++) {
      const probs = colorProbabilities(state, sketch, model.params, v);
      for (const p of probs) {
        expect(Number.isFinite(p)).toBe(true);
        expect(p).toBeCloseTo(1 / sketch.colorCount, 12);
      }
    }
  });

  it('la coloración resultante es siempre una partición de V(G)', () => {
    const model = createModel({ sketch, k: 0.5, alpha: 1 });
    const rng = createRng(1234);
    let state = stateWith({ graphPreset: 'random', colorPreset: 'alternating' });

    for (let step = 0; step < 500; step++) {
      state = model.step(state, rng);
      expect(state.color).toHaveLength(6);
      for (let v = 0; v < 6; v++) {
        expect(state.color[v]).toBeGreaterThanOrEqual(0);
        expect(state.color[v]).toBeLessThan(sketch.colorCount);
      }
      // Cada posición de X lleva exactamente un vértice (biyección)
      expect(new Set(state.pos).size).toBe(6);
    }
  });
});

describe('generador reproducible', () => {
  it('misma semilla ⇒ misma secuencia', () => {
    const a = createRng(2026);
    const b = createRng(2026);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('semillas distintas ⇒ secuencias distintas', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('los valores caen en [0, 1)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 10000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
