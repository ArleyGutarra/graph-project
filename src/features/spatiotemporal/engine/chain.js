import { createRng } from '../../../shared/math/rng';
import { createInitialState } from '../domain/initialState';
import { computeObservables } from '../domain/observables';
import { createStepDetail, statePlusOf } from '../domain/stepDetail';
import { HistoryBuffer } from './history';

/**
 * Cadena de Markov en vivo: mantiene el estado actual, el instante t, el
 * historial de observables, el DETALLE del último paso (transposiciones,
 * σ_t, probabilidades por par…) y una VENTANA DE FOTOGRAMAS que permite
 * retroceder (transporte |◀ ◀ −1 +1 ▶| y scrubber, tipo reproductor).
 *
 * La mutación ocurre aquí (fuera de React); la interfaz solo lee en cada render.
 *
 * ── Micro-estados t⁻ y t⁺ ──────────────────────────────────────────────────
 * El estado guardado es el t⁻ (tras el desplazamiento). El detalle permite
 * reconstruir el t⁺ (aristas y colores actualizados, posiciones aún de t⁻):
 *   `chain.plus`  → estado t⁺
 * ── Retroceder ─────────────────────────────────────────────────────────────
 * La trayectoria no se pre-computa entera: se guarda una foto por paso. Al
 * retroceder se descarta el futuro (el azar no puede deshacerse); a partir de
 * ahí la cadena sigue con el mismo generador hacia una rama nueva. `seek(t)`
 * devuelve false si t está fuera de la ventana retenida.
 *
 * @param {object} args
 * @param {object} args.model     modelo devuelto por createModel
 * @param {object} args.initial   presets { graphPreset, colorPreset, positionPreset, custom }
 * @param {number} args.seed      semilla del generador
 * @param {number} args.capacity  puntos máximos del historial de observables
 * @param {number} args.snapshotCapacity pasos retenidos para poder retroceder
 */
export function createChain({
  model,
  initial,
  seed,
  capacity = 1200,
  snapshotCapacity = 3000,
}) {
  const rng = createRng(seed);
  const { n } = model;

  let state = createInitialState(
    {
      n,
      m: model.sketch.size,
      colorCount: model.colorCount,
      ...initial,
    },
    rng
  );
  let t = 0;

  // Estado del paso anterior (para el Diff de la vista Simular)
  let previous = null;
  // Detalle del último paso (para el Inspector y los micro-pasos)
  let detail = null;

  const history = new HistoryBuffer(capacity);
  history.push(0, computeObservables(state, model.colorCount));

  let snapshots = [{ t: 0, state, detail: null }];
  let snapshotBase = 0;

  const retainWindow = () => {
    if (snapshots.length <= snapshotCapacity) return;
    const drop = Math.floor(snapshotCapacity / 2);
    snapshots = snapshots.slice(drop);
    snapshotBase = snapshots[0].t;
  };

  return {
    history,
    get state() {
      return state;
    },
    get previous() {
      return previous;
    },
    get detail() {
      return detail;
    },
    /** Estado t⁺ (aristas y colores del paso, posiciones de t⁻). */
    get plus() {
      return detail ? statePlusOf(state, detail) : state;
    },
    get t() {
      return t;
    },
    /** Instante más antiguo retenido (límite izquierdo del scrubber). */
    get minT() {
      return snapshotBase;
    },
    /** Instante más avanzado alcanzado (límite derecho del scrubber). */
    get maxT() {
      return snapshots[snapshots.length - 1].t;
    },

    /**
     * Avanza un paso y registra los observables.
     * @param {boolean} collectDetail guardar el detalle del paso (Inspector)
     */
    step(collectDetail = true) {
      const stepDetail = collectDetail ? createStepDetail(n, model.sketch.size) : null;
      previous = state;
      state = model.step(state, rng, stepDetail);
      t += 1;
      detail = stepDetail;
      snapshots.push({ t, state, detail: stepDetail });
      retainWindow();
      history.push(t, computeObservables(state, model.colorCount));
      return state;
    },

    /** Avanza `count` pasos; sólo se conserva el detalle del último. */
    stepBy(count) {
      for (let i = 0; i < count; i++) this.step(i === count - 1);
      return state;
    },

    /**
     * Salta al instante `target` dentro de la ventana retenida.
     * @returns {boolean} true si el salto se pudo hacer
     */
    seek(target) {
      if (!Number.isFinite(target)) return false;
      const wanted = Math.round(target);
      if (wanted < snapshotBase || wanted > t) return false;

      const index = wanted - snapshotBase;
      state = snapshots[index].state;
      detail = snapshots[index].detail;
      snapshots = snapshots.slice(0, index + 1);
      history.trimAfter(wanted);
      t = wanted;
      previous = index > 0 ? snapshots[index - 1].state : null;
      return true;
    },

    /** Vuelve al instante más antiguo retenido. */
    rewind() {
      return this.seek(snapshotBase);
    },
  };
}
