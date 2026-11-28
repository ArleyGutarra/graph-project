import { describe, expect, it } from 'vitest';
import { createSketch } from '../domain/sketch';
import { composePositions, positionChoices, stepPositions } from '../domain/kernels/displacement';
import { createRng } from '../../../shared/math/rng';

/** σ_t explícita = σ_n ∘ … ∘ σ_1 (misma lectura que el código). */
function explicitComposition(pos, targets) {
  const n = pos.length;
  const mapping = Array.from({ length: n }, (_, i) => i); // σ como función en posiciones
  for (let v = 0; v < n; v++) {
    const from = pos[v];
    const to = targets[v];
    if (from === to) continue;
    // τ ∘ σ: intercambiar las imágenes de `from` y `to`
    for (let p = 0; p < n; p++) {
      if (mapping[p] === from) mapping[p] = to;
      else if (mapping[p] === to) mapping[p] = from;
    }
  }
  return pos.map((p) => mapping[p]);
}

function isPermutation(values) {
  return new Set(values).size === values.length;
}

describe('composición de transposiciones', () => {
  it('σ_t siempre produce una permutación válida de [n]', () => {
    const rng = createRng(42);
    const sketch = createSketch({ type: 'cycle', size: 6, colorCount: 3 });

    for (let trial = 0; trial < 500; trial++) {
      const pos = Uint8Array.from(sketch.neighbors.map((_, i) => i));
      // barajar las posiciones iniciales
      for (let i = pos.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        const tmp = pos[i];
        pos[i] = pos[j];
        pos[j] = tmp;
      }

      const targets = new Uint8Array(pos.length);
      for (let v = 0; v < pos.length; v++) {
        const choices = positionChoices(pos[v], sketch);
        targets[v] = choices[rng.int(choices.length)];
      }

      const out = composePositions(pos, targets, sketch.size);
      expect(isPermutation([...out])).toBe(true);
    }
  });

  it('σ_t = σ_{n,t} ∘ … ∘ σ_{1,t} (orden de vértices 0 … n−1)', () => {
    const sketch = createSketch({ type: 'cycle', size: 6, colorCount: 3 });
    const rng = createRng(777);

    for (let trial = 0; trial < 300; trial++) {
      const pos = Uint8Array.from({ length: 6 }, (_, i) => (i + trial) % 6);
      const targets = new Uint8Array(6);
      for (let v = 0; v < 6; v++) {
        const choices = positionChoices(pos[v], sketch);
        targets[v] = choices[rng.int(choices.length)];
      }

      const out = composePositions(pos, targets, 6);
      expect([...out]).toEqual(explicitComposition([...pos], [...targets]));
    }
  });

  it('destino igual a la posición actual deja el estado intacto', () => {
    const pos = Uint8Array.from([0, 1, 2, 3, 4, 5]);
    const out = composePositions(pos, pos, 6);
    expect([...out]).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('un intercambio mutuo se cancela: (a b) ∘ (a b) = id', () => {
    const pos = Uint8Array.from([0, 1, 2, 3]);
    const targets = Uint8Array.from([1, 0, 2, 3]);
    const out = composePositions(pos, targets, 4);
    expect([...out]).toEqual([0, 1, 2, 3]);
  });
});

describe('soporte del desplazamiento', () => {
  it('el destino siempre pertenece a N_X(p) ∪ {p}', () => {
    const sketch = createSketch({ type: 'cycle', size: 6, colorCount: 3 });
    const rng = createRng(5);

    for (let from = 0; from < 6; from++) {
      const choices = positionChoices(from, sketch);
      const allowed = new Set([...sketch.neighbors[from], from]);
      expect(choices.length).toBe(sketch.neighbors[from].length + 1);
      for (let i = 0; i < 500; i++) {
        expect(allowed.has(choices[rng.int(choices.length)])).toBe(true);
      }
    }
  });

  it('stepPositions muestrea exactamente ese mismo soporte (y misma semilla)', () => {
    const sketch = createSketch({ type: 'path', size: 5, colorCount: 3 });
    const state = {
      n: 5,
      adj: new Int32Array(5),
      color: new Uint8Array(5),
      pos: Uint8Array.from([4, 3, 2, 1, 0]),
    };

    const a = stepPositions(state, sketch, createRng(11));
    const b = stepPositions(state, sketch, createRng(11));
    expect([...a.pos]).toEqual([...b.pos]);
    expect(isPermutation([...a.pos])).toBe(true);
  });
});
