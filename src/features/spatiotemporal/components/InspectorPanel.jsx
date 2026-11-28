import { subscript } from '../domain/initialState';
import { colorOf } from './theme';
import { fillColorWeights, normalizeWeights } from '../domain/kernels/colors';
import { formatCycles, permutationCycles } from '../domain/stepDetail';

function degreeOf(state, v) {
  let d = 0;
  for (let j = 0; j < state.n; j++) if (state.adj[v] & (1 << j)) d++;
  return d;
}

/**
 * Inspector de un paso t completo (idéntico a la maqueta):
 *
 *   1. DESPLAZAMIENTO (t−1)⁺ → t⁻
 *      · transposiciones σ_{i,t} propuestas por cada vértice
 *      · composición ordenada σ_t = σ_{n−1,t} ∘ ⋯ ∘ σ_{0,t}, en ciclos
 *      · mapeo de posiciones p_t = σ_t ∘ p_{t−1}
 *   2. ACTUALIZACIÓN DE ARISTAS t⁻ → t⁺
 *      · P[{vᵢ,vⱼ} ∈ E(G_t⁺)] con d⁻, adyacencia en X y el resultado
 *   3. COLORACIÓN t⁻ → t⁺
 *      · pesos wᵢ(v) = |N(v) ∩ Cᵢ|/d(v) + α·1{p(v) ∈ Cᵢ^X} y P[v ∈ Cᵢ]
 *
 * Usa exactamente las mismas funciones que los kernels, así que los números
 * que muestra son los que realmente muestrea la cadena.
 */
export default function InspectorPanel({
  state,
  previous,
  detail,
  sketch,
  params,
  selected,
  onSelect,
  t,
  subphase = 'plus',
}) {
  const colorCount = sketch.colorCount;
  const vertexCount = state.n;

  if (!detail || !previous) {
    return (
      <div className="inspector">
        <p className="inspector__empty">
          El detalle del paso aparece <strong>después del primer avance</strong> de la cadena
          (t = {t}). Pulsa <strong>▶ Reproducir</strong>, <strong>+1 ›</strong> o{' '}
          <strong>+5 »</strong> para registrar las transposiciones, la composición σ_t y las
          probabilidades de cada arista.
        </p>
        <div className="inspector__quick">
          {Array.from({ length: vertexCount }, (_, v) => (
            <button
              key={v}
              type="button"
              className={`inspector__quick-button${selected === v ? ' is-active' : ''}`}
              onClick={() => onSelect?.(v)}
            >
              v{subscript(v)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const cycles = permutationCycles(detail.perm);
  const stepIndex = Math.max(0, t - 1);
  const vertex = selected ?? 0;

  // --- Sección 3: pesos del vértice seleccionado ---------------------------
  const weights = new Float64Array(colorCount);
  const probs = new Float64Array(colorCount);
  fillColorWeights(previous, sketch, params, vertex, weights);
  normalizeWeights(weights, params, probs);
  const d = degreeOf(previous, vertex);
  const position = previous.pos[vertex];
  const territory = sketch.colors[position];
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const maxWeight = Math.max(...weights, 1e-9);

  const neighbors = [];
  for (let j = 0; j < vertexCount; j++) {
    if (j !== vertex && (previous.adj[vertex] & (1 << j))) neighbors.push(j);
  }

  return (
    <div className="inspector">
      {/* ---------- 1 · Desplazamiento ---------- */}
      <section className="inspector__block">
        <header className="inspector__head">
          <h3>
            <span className="inspector__num">1.</span> Desplazamiento ({stepIndex})⁺ → {t}⁻
          </h3>
          <span className="inspector__meta">
            {`σ_t = σ_{${vertexCount - 1}},t ∘ ⋯ ∘ σ_{0,t} · orden 0…${vertexCount - 1}`}
          </span>
        </header>

        <p className="inspector__caption">
          Transposiciones individuales propuestas por cada nodo:
        </p>
        <div className="inspector__chips">
          {Array.from({ length: vertexCount }, (_, v) => {
            const from = detail.posBefore[v];
            const to = detail.targets[v];
            return (
              <span className="chip-card" key={`tr-${v}`}>
                <span className="chip-card__formula">
                  σ{subscript(v)},{t} = {from === to ? 'id' : `(x${from} x${to})`}
                </span>
                <em>v{subscript(v)}</em>
              </span>
            );
          })}
        </div>

        <p className="inspector__caption">Composición ordenada (ciclos disjuntos):</p>
        <div className="chip-card chip-card--wide">
          <span className="chip-card__formula">
            σ{t} = σ{vertexCount - 1},{t} ∘ ⋯ ∘ σ{0},{t} = {formatCycles(cycles)} ∈ S
            {sketch.size}
          </span>
        </div>

        <p className="inspector__caption">
          Mapeo de posiciones p{t} = σ{t} ∘ p{stepIndex}:
        </p>
        <div className="inspector__chips">
          {Array.from({ length: vertexCount }, (_, v) => (
            <span className="chip-card" key={`map-${v}`}>
              <span className="chip-card__formula">
                v{subscript(v)} : x{subscript(detail.posBefore[v])} → x
                {subscript(detail.perm[detail.posBefore[v]])}
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* ---------- 2 · Actualización de aristas ---------- */}
      <section className="inspector__block">
        <header className="inspector__head">
          <h3>
            <span className="inspector__num">2.</span> Actualización de aristas {t}⁻ → {t}⁺
          </h3>
          <span className="inspector__meta">
            d⁻ usa los grados de {stepIndex}⁻ · X = {sketch.label}
          </span>
        </header>

        <div className="inspector__events">
          {detail.pairs.map(([i, j], index) => {
            const was = detail.edgeWas[index];
            const now = detail.edgeNow[index];
            const linked = detail.edgeLinked[index];
            const prob = detail.edgeProb[index];
            return (
              <div className={`event-row ${was === now ? 'is-quiet' : 'is-change'}`} key={`e-${i}-${j}`}>
                <span className="event-row__formula">
                  P[{'{'}v{subscript(i)}, v{subscript(j)}{'}'} ∈ E(G{subscript(t)}⁺)] ={' '}
                  <strong>{prob.toFixed(3)}</strong>
                </span>
                <span className="event-row__meta">
                  d⁻ = {detail.edgeDegI[index]} · {detail.edgeDegJ[index]} · posiciones{' '}
                  {linked ? '∈' : '∉'} E(X)
                </span>
                <span className={`badge ${now ? 'badge--ok' : 'badge--muted'}`}>
                  {was === 0 && now === 1
                    ? 'Se conectó'
                    : was === 1 && now === 0
                      ? 'Se desconectó'
                      : now
                        ? 'Conectó'
                        : 'No conectó'}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- 3 · Coloración ---------- */}
      <section className="inspector__block">
        <header className="inspector__head">
          <h3>
            <span className="inspector__num">3.</span> Coloración {t}⁻ → {t}⁺ · vértice{' '}
            <button type="button" className="inspector__vselect" onClick={() => onSelect?.(vertex)}>
              v{subscript(vertex)}
            </button>
          </h3>
          <span className="inspector__meta">wᵢ(v) = |N(v) ∩ Cᵢ| / d(v) + α · 1{`{p(v) ∈ Cᵢ^X}`}</span>
        </header>

        <div className="inspector__quick">
          {Array.from({ length: vertexCount }, (_, v) => (
            <button
              key={v}
              type="button"
              className={`inspector__quick-button${vertex === v ? ' is-active' : ''}`}
              onClick={() => onSelect?.(v)}
            >
              <i style={{ background: colorOf(previous.color[v]) }} />v{subscript(v)}
            </button>
          ))}
        </div>

        <div className="inspector__grid">
          <div className="inspector__cell">
            <span className="inspector__label">Color actual (t⁻)</span>
            <span className="inspector__value">C{subscript(previous.color[vertex])}</span>
          </div>
          <div className="inspector__cell">
            <span className="inspector__label">Grado d⁻(v)</span>
            <span className="inspector__value">{d}</span>
          </div>
          <div className="inspector__cell">
            <span className="inspector__label">Posición pₜ(v)</span>
            <span className="inspector__value">x{subscript(position)}</span>
          </div>
          <div className="inspector__cell">
            <span className="inspector__label">Territorio C^X</span>
            <span className="inspector__value">
              <i className="inspector__swatch" style={{ background: colorOf(territory) }} />
              C{subscript(territory)}
            </span>
          </div>
        </div>

        <table className="inspector__table">
          <thead>
            <tr>
              <th>i</th>
              <th>col.</th>
              <th>|N ∩ Cᵢ|</th>
              <th>wᵢ(v)</th>
              <th>P[v ∈ Cᵢ]</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: colorCount }, (_, i) => {
              const social = d > 0 ? countIn(previous, vertex, i) / d : 0;
              return (
                <tr key={`w-${i}`}>
                  <td>{i}</td>
                  <td>
                    <i className="inspector__swatch" style={{ background: colorOf(i) }} />
                  </td>
                  <td>{d > 0 ? countIn(previous, vertex, i) : '—'}</td>
                  <td>
                    <span className="inspector__bar">
                      <span
                        className="inspector__bar-fill"
                        style={{
                          width: `${(weights[i] / maxWeight) * 100}%`,
                          background: colorOf(i),
                        }}
                      />
                      {weights[i].toFixed(3)}
                    </span>
                    <em>
                      {social.toFixed(3)}
                      {i === territory ? ` + ${params.alpha.toFixed(1)}` : ''}
                    </em>
                  </td>
                  <td className="inspector__prob">
                    <strong>{(probs[i] * 100).toFixed(2)}%</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="inspector__sum">
          Σᵢ wᵢ(v) = <strong>{weightTotal.toFixed(4)}</strong>
          {weightTotal <= 0 ? ' (degenerado: se usa la uniforme)' : ''} · α ={' '}
          {params.alpha.toFixed(1)} · k = {params.k.toFixed(2)}
          {d === 0 ? ' · vértice aislado (0/0 := 0)' : ''}
        </div>

        <div className="inspector__neighbors">
          <span className="inspector__label">Vecinos N(v) = {neighbors.length}</span>
          {neighbors.length === 0 ? (
            <span className="inspector__none">sin vecinos</span>
          ) : (
            neighbors.map((j) => (
              <button
                key={`nb-${j}`}
                type="button"
                className="inspector__neighbor"
                onClick={() => onSelect?.(j)}
              >
                <i style={{ background: colorOf(previous.color[j]) }} />v{subscript(j)}
              </button>
            ))
          )}
        </div>

        <p className="inspector__caption">
          Micro-estado mostrado: <strong>{subphase === 'plus' ? 't⁺ (actualizado)' : 't⁻ (desplazado)'}</strong>
        </p>
      </section>
    </div>
  );
}

function countIn(state, v, color) {
  let count = 0;
  for (let j = 0; j < state.n; j++) {
    if (state.adj[v] & (1 << j)) {
      if (state.color[j] === color) count += 1;
    }
  }
  return count;
}
