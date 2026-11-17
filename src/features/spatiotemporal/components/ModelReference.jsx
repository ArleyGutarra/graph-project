/**
 * Ficha de referencia: reglas del modelo tomadas del póster
 * "Ergodicidad y convergencia en redes espacio-temporales" (VI CIMM-UNI 2026).
 *
 * Se implementan las fórmulas de la versión final del póster; la fuente LaTeX
 * disponible en `public/document.tex` es un borrador con algunas erratas
 * (p. ej. el numerador de la regla de conexión repite el mismo grado y los
 * pesos de color carecen de la normalización w_i/Σw, sin la cual no es una
 * probabilidad).
 */
export default function ModelReference() {
  return (
    <section className="reference">
      <div className="reference__header">
        <h2>Modelo de referencia</h2>
        <a href="/document.tex" target="_blank" rel="noreferrer">
          document.tex (fuente del póster) ↗
        </a>
      </div>

      <div className="reference__grid">
        <article>
          <h3>1. Conexión y desconexión (t⁻ → t⁺)</h3>
          <p className="formula">
            {'{vᵢ,vⱼ} ∉ E(G⁻ₜ) ∧ {p(vᵢ),p(vⱼ)} ∈ E(X) ⟹ '}
            <strong>
              {'P[{vᵢ,vⱼ} ∈ E(G⁺ₜ)] = (d⁻(vᵢ)+1)(d⁻(vⱼ)+1) / (n+1)²'}
            </strong>
          </p>
          <p className="formula">
            {'{vᵢ,vⱼ} ∈ E(G⁻ₜ) ∧ {p(vᵢ),p(vⱼ)} ∉ E(X) ⟹ '}
            <strong>{'P[{vᵢ,vⱼ} ∈ E(G⁺ₜ)] = 1 − d⁻(vᵢ)·d⁻(vⱼ) / n²'}</strong>
          </p>
          <p className="reference__note">
            Los dos casos restantes no figuran en el póster y se completan de forma natural:
            una arista entre posiciones adyacentes se conserva (P = 1) y una no-arista entre
            posiciones no adyacentes no se crea (P = 0). Los grados se toman siempre del
            estado previo.
          </p>
        </article>

        <article>
          <h3>2. Coloración (t⁻ → t⁺)</h3>
          <p className="formula">
            <strong>wᵢ(v) = |N_G⁻(v) ∩ Cᵢ⁻| / d⁻(v) + α · 1{'{p(v) ∈ C^Xᵢ}'}</strong>
          </p>
          <p className="formula">
            <strong>{'P[v ∈ Cᵢ⁺] = k · 1{i = 0} + (1 − k) · wᵢ(v) / Σⱼ wⱼ(v)'}</strong>
          </p>
          <p className="reference__note">
            Convención 0/0 := 0 para vértices aislados. Como toda posición tiene una clase de
            color en X y α &gt; 0, se cumple Σⱼ wⱼ(v) ≥ α &gt; 0 y la probabilidad está bien
            definida. El coloreado se muestrea independientemente por vértice, por lo que
            {' {Cᵢ⁺}' } es una partición de V(G).
          </p>
        </article>

        <article>
          <h3>3. Desplazamiento (t⁺ → (t+1)⁻)</h3>
          <p className="formula">
            Cada vᵢ elige uniformemente xⱼ ∈ N_X(pₜ(vᵢ)) ∪ {'{pₜ(vᵢ)}'} y aplica la
            transposición σᵢ,ₜ = (pₜ(vᵢ) xⱼ) ∈ S_m.
          </p>
          <p className="formula">
            <strong>σₜ = σₙ,ₜ ∘ ⋯ ∘ σ₁,ₜ y pₜ₊₁ = σₜ ∘ pₜ</strong>
          </p>
          <p className="reference__note">
            Todas las transposiciones se construyen con las posiciones previas pₜ (por eso un
            intercambio mutuo entre dos vértices se cancela: (a b) ∘ (a b) = id).
          </p>
        </article>

        <article>
          <h3>Hipótesis y teorema</h3>
          <p className="reference__note">
            X finito, conexo y X ≠ K_m; k ∈ (0,1); α &gt; 0; C^Xᵢ ≠ ∅ para i = 1, …, c. Bajo
            estas condiciones {`{Dₜ}`} es una cadena de Markov finita, irreducible y
            aperiódica: existe una única distribución estacionaria π* y lim π₀Pᵗ = π* para
            cualquier π₀.
          </p>
          <p className="reference__note">
            Esta pantalla implementa el modelo tal cual y permite comprobar empíricamente esa
            independencia respecto del estado inicial (panel superior) así como la dependencia
            de π* respecto de la 4-tupla (X, {'{C^Xᵢ}'}, k, α).
          </p>
        </article>
      </div>
    </section>
  );
}
