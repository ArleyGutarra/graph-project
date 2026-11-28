import { emptySketchColorClasses, isSketchComplete, isSketchConnected } from './sketch';

/**
 * Hipótesis del Teorema (póster, secciones "Hipótesis" y "Teorema"):
 *
 *   X finito y conexo, X ≠ K_m, k ∈ (0,1), α > 0 y C^X_i ≠ ∅ ∀ i ∈ {1,…,c}.
 *
 * Si alguna falla, {D_t} puede dejar de ser irreducible/aperiódica y NO existe
 * una única π*. La interfaz muestra estas comprobaciones en lugar de impedir
 * que el usuario configure un caso inválido.
 *
 * `n` (vértices de G) no es una hipótesis del Teorema: es el invariante de
 * esta implementación de que p_t sea INYECTIVA (n ≤ m). Se comprueba igual
 * para avisar si el usuario consiguiera violarlo.
 *
 * @param {{ sketch: object, k: number, alpha: number, n?: number }} config
 * @returns {{ items: Array<{id: string, label: string, ok: boolean, detail: string}>, ok: boolean }}
 */
export function checkHypotheses({ sketch, k, alpha, n = sketch.size }) {
  const missing = emptySketchColorClasses(sketch);
  const complete = isSketchComplete(sketch);
  const connected = isSketchConnected(sketch);

  const items = [
    {
      id: 'connected',
      label: 'X conexo',
      ok: connected,
      detail: connected
        ? `${sketch.label} es conexo`
        : `${sketch.label} tiene componentes aisladas`,
    },
    {
      id: 'not-complete',
      label: 'X ≠ K_m',
      ok: !complete,
      detail: complete
        ? `${sketch.label} es el grafo completo: la hipótesis X ≠ K_m se viola`
        : `${sketch.label} no es completo`,
    },
    {
      id: 'k',
      label: 'k ∈ (0, 1)',
      ok: k > 0 && k < 1,
      detail:
        k > 0 && k < 1
          ? `k = ${k.toFixed(2)} ∈ (0,1)`
          : `k = ${k.toFixed(2)} está fuera de (0,1): P[v ∈ C₀] deja de ser estrictamente positiva`,
    },
    {
      id: 'alpha',
      label: 'α > 0',
      ok: alpha > 0,
      detail:
        alpha > 0
          ? `α = ${alpha.toFixed(1)} > 0`
          : `α = ${alpha.toFixed(1)} ≤ 0: con vértices aislados Σw puede anularse y C^X_i deja de pesar`,
    },
    {
      id: 'color-classes',
      label: 'C_i^X ≠ ∅ (i ≥ 1)',
      ok: missing.length === 0,
      detail:
        missing.length === 0
          ? `las ${sketch.colorCount} clases del croquis son no vacías`
          : `C^X_i = ∅ para i ∈ {${missing.join(', ')}}: con (c+1) = ${sketch.colorCount} > m = ${sketch.size} no todas las clases del croquis existen`,
    },
    {
      id: 'bijection',
      label: 'p_t inyectiva (n ≤ m)',
      ok: n <= sketch.size,
      detail:
        n <= sketch.size
          ? `n = ${n} ≤ m = ${sketch.size}: cada vértice ocupa una posición distinta de X` +
            (n < sketch.size ? ` (${sketch.size - n} posiciones libres)` : '')
          : `n = ${n} > m = ${sketch.size}: dos vértices compartirían posición y p_t dejaría de ser inyectiva`,
    },
  ];

  return { items, ok: items.every((item) => item.ok) };
}
