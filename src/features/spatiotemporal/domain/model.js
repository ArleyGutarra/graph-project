import { stepEdges } from './kernels/edges';
import { stepColors } from './kernels/colors';
import { stepPositions } from './kernels/displacement';

/**
 * Modelo espacio-temporal del póster
 * "Ergodicidad y convergencia en redes espacio-temporales" (VI CIMM-UNI 2026).
 *
 * Un paso de la cadena D_t → D_{t+1} consta de dos fases:
 *
 *   1) t⁻ → t⁺   : aristas y colores se actualizan a partir del estado previo
 *                  (mismos grados d_t^-, mismas posiciones p_t, mismos colores
 *                  C^{t-}); ambos kernels son independientes entre sí.
 *   2) t⁺ → (t+1)⁻ : desplazamiento de posiciones.
 *
 * El estado es la 3-tupla (E(G), colores, posiciones) y se devuelve siempre
 * inmutable (nuevo objeto) para poder compararlo/renderizarlo en React.
 *
 * @param {{ sketch: object, k: number, alpha: number }} config
 *   k ∈ (0,1)   : probabilidad de re-adoptar el color 0 (término k·1{i=0}).
 *   α > 0       : bonificación por posición en C^X_i (además garantiza Σw > 0).
 */
export function createModel({ sketch, k, alpha }) {
  const params = { k, alpha };

  return {
    sketch,
    params,
    n: sketch.size, // n = m: los vértices ocupan biyectivamente las posiciones de X
    colorCount: sketch.colorCount,

    /** Aplica un paso completo a la cadena de Markov. */
    step(state, rng) {
      const edges = stepEdges(state, sketch, rng);
      const colors = stepColors(state, sketch, params, rng);
      const positions = stepPositions(state, sketch, rng);

      return {
        n: state.n,
        adj: edges.adj,
        color: colors.color,
        pos: positions.pos,
      };
    },
  };
}
