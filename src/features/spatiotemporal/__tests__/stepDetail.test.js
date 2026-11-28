import { describe, expect, it } from 'vitest';
import { createSketch } from '../domain/sketch';
import { createModel } from '../domain/model';
import { createInitialState } from '../domain/initialState';
import { createRng } from '../../../shared/math/rng';
import {
  createStepDetail,
  formatCycles,
  permutationCycles,
  statePlusOf,
} from '../domain/stepDetail';

const sketch = createSketch({ type: 'cycle', size: 6, colorCount: 3 });
const model = createModel({ sketch, k: 0.5, alpha: 1 });

function initial() {
  return createInitialState(
    {
      n: 6,
      m: 6,
      colorCount: 3,
      graphPreset: 'complete',
      colorPreset: 'unanimous1',
      positionPreset: 'identity',
    },
    createRng(2026)
  );
}

describe('detalle del paso (base del Inspector)', () => {
  it('es coherente con el estado resultante en cada uno de 50 pasos', () => {
    const rng = createRng(4242);
    let state = initial();

    for (let step = 0; step < 50; step++) {
      const detail = createStepDetail(6);
      const previous = state;
      state = model.step(state, rng, detail);

      // Fase de desplazamiento
      expect([...detail.posBefore]).toEqual([...previous.pos]);
      for (let v = 0; v < 6; v++) {
        expect(detail.targets[v]).toBeGreaterThanOrEqual(0);
        expect(sketch.choices[detail.posBefore[v]]).toContain(detail.targets[v]);
      }
      expect(new Set(detail.perm).size).toBe(6);
      // p_{t+1} = σ_t ∘ p_t
      expect([...state.pos]).toEqual([...detail.posBefore].map((p) => detail.perm[p]));

      // Fase de coloración
      expect([...detail.colorBefore]).toEqual([...previous.color]);
      expect([...detail.colorAfter]).toEqual([...state.color]);

      // Fase de aristas: cada par con su probabilidad y su resultado
      let pairs = 0;
      detail.pairs.forEach(([i, j], index) => {
        pairs += 1;
        expect(Boolean(state.adj[i] & (1 << j))).toBe(Boolean(detail.edgeNow[index]));
        expect(detail.edgeProb[index]).toBeGreaterThanOrEqual(0);
        expect(detail.edgeProb[index]).toBeLessThanOrEqual(1);
        expect(detail.edgeWas[index]).toBeLessThanOrEqual(1);
        expect(detail.edgeLinked[index]).toBeLessThanOrEqual(1);
      });
      expect(pairs).toBe(15);

      // Micro-estado t⁺: mismas posiciones que t⁻, aristas y colores ya nuevos
      const plus = statePlusOf(previous, detail);
      expect([...plus.pos]).toEqual([...previous.pos]);
      expect([...plus.color]).toEqual([...detail.colorAfter]);
      expect([...plus.adj]).toEqual([...state.adj]);
    }
  });

  it('sin detalle no se registra nada (la carrera rápida no paga ese coste)', () => {
    const rng = createRng(7);
    const state = model.step(initial(), rng);
    expect(state.adj).toBeInstanceOf(Int32Array);
    expect(state.color).toHaveLength(6);
  });
});

describe('ciclos de la composición σ_t', () => {
  it('descompone en ciclos disjuntos y formatea la fórmula', () => {
    // (0 1)(2 3 4) con 5 fijos (5)
    const perm = Uint8Array.from([1, 0, 3, 4, 2, 5]);
    const cycles = permutationCycles(perm);
    expect(cycles).toEqual([
      [0, 1],
      [2, 3, 4],
    ]);
    expect(formatCycles(cycles)).toBe('(x0 x1)(x2 x3 x4)');
  });

  it('la identidad no tiene ciclos y se escribe id', () => {
    expect(permutationCycles(Uint8Array.from([0, 1, 2, 3]))).toEqual([]);
    expect(formatCycles([])).toBe('id');
  });

  it('los ciclos de σ_t reconstruyen la permutación', () => {
    const perm = Uint8Array.from([3, 0, 1, 2, 5, 4]);
    const rebuilt = new Uint8Array(perm.length);
    for (let i = 0; i < perm.length; i++) rebuilt[i] = i;
    for (const cycle of permutationCycles(perm)) {
      const first = rebuilt[cycle[0]];
      for (let i = 0; i < cycle.length - 1; i++) rebuilt[cycle[i]] = rebuilt[cycle[i + 1]];
      rebuilt[cycle[cycle.length - 1]] = first;
    }
    expect([...rebuilt]).toEqual([...perm]);
  });
});

describe('estados iniciales personalizados (herramientas del lienzo)', () => {
  it('aplica aristas, colores y posiciones explícitos', () => {
    const state = createInitialState(
      {
        n: 6,
        m: 6,
        colorCount: 3,
        graphPreset: 'custom',
        colorPreset: 'custom',
        positionPreset: 'custom',
        custom: {
          edges: [
            [0, 2],
            [2, 5],
          ],
          colors: [0, 1, 2, 0, 1, 2],
          positions: [5, 4, 3, 2, 1, 0],
        },
      },
      createRng(1)
    );

    expect([...state.color]).toEqual([0, 1, 2, 0, 1, 2]);
    expect([...state.pos]).toEqual([5, 4, 3, 2, 1, 0]);
    expect(Boolean(state.adj[0] & (1 << 2))).toBe(true);
    expect(Boolean(state.adj[2] & (1 << 5))).toBe(true);
    // fila 0 = {2} · fila 2 = {0, 5} · fila 5 = {2}
    expect([...state.adj]).toEqual([4, 0, 33, 0, 0, 4]);
  });

  it('recorta posiciones fuera del rango y aristas inválidas', () => {
    const state = createInitialState(
      {
        n: 4,
        m: 4,
        colorCount: 3,
        graphPreset: 'custom',
        colorPreset: 'custom',
        positionPreset: 'custom',
        custom: { edges: [[0, 9], [1, 1], [2, 3]], colors: [9, -1, 2, 0], positions: [99, 1, 2, 3] },
      },
      createRng(1)
    );

    expect(Boolean(state.adj[2] & (1 << 3))).toBe(true);
    expect(Boolean(state.adj[0] & (1 << 3))).toBe(false); // arista fuera de rango
    expect([...state.color]).toEqual([2, 0, 2, 0]);
    expect(Math.max(...state.pos)).toBeLessThan(4);
  });
});
