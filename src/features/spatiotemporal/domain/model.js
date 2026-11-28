import { stepEdges } from './kernels/edges';
import { stepColors } from './kernels/colors';
import { stepPositions } from './kernels/displacement';

/**
 * Modelo espacio-temporal del póster
 * "Ergodicidad y convergencia en redes espacio-temporales" (VI CIMM-UNI 2026).
 *
 * ── ORDEN EXACTO DE LAS FASES DENTRO DE UN PASO ────────────────────────────
 *
 * El paso D_t → D_{t+1} tiene DOS sub-fases y no tres (SUPF1 del README):
 *
 *   FASE 1 · t⁻ → t⁺   (conexión/desconexión + recoloración)
 *     Ambas actualizaciones se calculan a partir del MISMO estado t⁻:
 *       - grados d_t^-(v)        (del grafo de t⁻)
 *       - colores C^{t-}         (de la coloración de t⁻)
 *       - posiciones p_t         (de las posiciones de t⁻)
 *     y se combinan al final en una sola tupla. Por tanto los kernels de
 *     aristas y de colores son condicionalmente INDEPENDIENTES dado el estado
 *     t⁻: ninguno ve el resultado del otro. Esto es lo que hace que
 *     P(S→S') factorice como producto de los tres kernels (base del cálculo
 *     exacto de `engine/exactStationary`).
 *
 *   FASE 2 · t⁺ → (t+1)⁻  (desplazamiento)
 *     Usa p_t (las posiciones de t⁻, NO las ya alteradas) y compone
 *     σ_t = σ_{n,t} ∘ … ∘ σ_{1,t}. El nuevo estado queda completo.
 *
 * ── TRATAMIENTO DE d_t^-(v) = 0 ────────────────────────────────────────────
 *
 *   · En el kernel de colores: convención 0/0 := 0 (un vértice aislado no
 *     aporta nada por su parte vecinal). Como α > 0 y toda posición de X
 *     tiene clase de color, Σ_i w_i(v) ≥ α > 0, así que la división
 *     w_i / Σw siempre está bien definida. Sólo si se viola α > 0 puede
 *     Σw = 0, y en ese caso `normalizeWeights` devuelve la uniforme.
 *   · En el kernel de aristas no hay ninguna división: d = 0 da
 *     (0+1)(0+1)/(n+1)² y 1 − 0·0/n² = 1.
 *
 * El estado es la 3-tupla (E(G), colores, posiciones) y se devuelve siempre
 * inmutable (nuevo objeto) para poder compararlo/renderizarlo en React.
 *
 * ── n y m son INDEPENDIENTES ────────────────────────────────────────────────
 *   n = vértices de G (lo que se edita en la vista Configurar)
 *   m = posiciones del croquis X (lo que dibuja el anillo)
 * Con n ≤ m los vértices ocupan posiciones distintas de X, así que BORRAR o
 * AÑADIR un vértice NO mueve nada: X conserva todas sus posiciones y los
 * vértices restantes se quedan donde estaban. (El póster sólo exige
 * p_t(v) ∈ V(X); la inyectividad es convención de esta implementación.)
 *
 * @param {{ sketch: object, k: number, alpha: number, n?: number }} config
 *   k ∈ (0,1)   : probabilidad de re-adoptar el color 0 (término k·1{i=0}).
 *   α > 0       : bonificación por posición en C^X_i (además garantiza Σw > 0).
 *   n           : vértices de G (por defecto m, el caso n = m).
 */
export function createModel({ sketch, k, alpha, n = sketch.size }) {
  const params = { k, alpha };

  return {
    sketch,
    params,
    n,
    colorCount: sketch.colorCount,

    /**
     * Aplica un paso completo a la cadena de Markov.
     *
     * @param {object} state  estado t⁻
     * @param {object} rng    generador
     * @param {object} [detail] si se pasa (crear con `createStepDetail`), los
     *   tres kernels rellenan el detalle del paso para el Inspector y para
     *   reconstruir el micro-estado t⁺.
     */
    step(state, rng, detail) {
      // FASE 1 (las tres lecturas parten del mismo `state` = t⁻)
      const edges = stepEdges(state, sketch, rng, detail);
      const colors = stepColors(state, sketch, params, rng, detail);
      // FASE 2
      const positions = stepPositions(state, sketch, rng, detail);

      return {
        n: state.n,
        adj: edges.adj,
        color: colors.color,
        pos: positions.pos,
      };
    },
  };
}
