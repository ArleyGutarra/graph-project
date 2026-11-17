import { createRng } from '../../../shared/math/rng';
import { createInitialState } from '../domain/initialState';
import { computeObservables } from '../domain/observables';
import { HistoryBuffer } from './history';

/**
 * Cadena de Markov en vivo: mantiene el estado actual, el instante t y el
 * historial de observables. La mutación ocurre aquí (fuera de React); la
 * interfaz solo lee el estado en cada render.
 *
 * @param {object} args
 * @param {object} args.model     modelo devuelto por createModel
 * @param {object} args.initial   presets { graphPreset, colorPreset, positionPreset }
 * @param {number} args.seed      semilla del generador
 * @param {number} args.capacity  puntos máximos del historial
 */
export function createChain({ model, initial, seed, capacity = 1200 }) {
  const rng = createRng(seed);

  let state = createInitialState(
    {
      n: model.n,
      m: model.sketch.size,
      colorCount: model.colorCount,
      ...initial,
    },
    rng
  );
  let t = 0;

  const history = new HistoryBuffer(capacity);
  history.push(0, computeObservables(state, model.colorCount));

  return {
    history,
    get state() {
      return state;
    },
    get t() {
      return t;
    },

    /** Avanza un paso de la cadena y registra los observables. */
    step() {
      state = model.step(state, rng);
      t += 1;
      history.push(t, computeObservables(state, model.colorCount));
      return state;
    },
  };
}
