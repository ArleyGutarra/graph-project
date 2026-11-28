import { GRAPH_PRESETS, colorPresets } from '../domain/initialState';
import { SKETCH_TYPES } from '../domain/sketch';

const WINDOWS = [
  { value: 0, label: 'Automática' },
  { value: 100, label: 'Últimos 100 pasos' },
  { value: 300, label: 'Últimos 300 pasos' },
  { value: 600, label: 'Últimos 600 pasos' },
  { value: 1000, label: 'Últimos 1000 pasos' },
];

const TOPOLOGY_OPTIONS = [
  { id: '', label: '— Aplicar topología —' },
  { id: 'empty', label: 'Vacío (sin aristas)' },
  { id: 'complete', label: 'Completo Kₙ' },
  { id: 'star', label: 'Estrella K₁,ₙ₋₁' },
  { id: 'path', label: 'Camino Pₙ' },
];

/**
 * Panel derecho de la vista "1 · Configurar escenario", con las tres
 * tarjetas de la maqueta:
 *
 *   · Acciones rápidas para G₀   (p₀ idéntica, topología y coloración)
 *   · Parámetros del modelo      (la 4-tupla X, {Cᵢ^X}, k, α + T y semilla)
 *   · Validación de hipótesis    (avisos en vivo del Teorema 1)
 *
 * Se conserva el tema futurista actual (tarjetas translúcidas, monoespaciada,
 * acentos carmesí); sólo cambia la estructura de presentación.
 */
export default function ControlPanel({
  config,
  sketch,
  vertexCount = sketch.size,
  hypotheses,
  fastRun,
  onModelParam,
  onViewParam,
  onGraphParam,
  onReset,
  onFastRun,
  onCancelFast,
  onIdentityPositions,
  onApplyTopology,
  onApplyColors,
}) {
  const colorOptions = colorPresets(config.colorCount);
  const typeSpec = SKETCH_TYPES.find((s) => s.id === config.sketchType) ?? SKETCH_TYPES[0];
  const failures = hypotheses?.items.filter((item) => !item.ok) ?? [];

  return (
    <div className="config-cards">
      <section className="config-card">
        <header className="config-card__head">
          <h3>Acciones rápidas para G₀</h3>
          <span className="config-card__badge">
            m = <strong>{sketch.size}</strong> · n = <strong>{vertexCount}</strong>
          </span>
        </header>

        <div className="config-card__body">
          <button
            className="button button--primary config-card__wide"
            type="button"
            onClick={onIdentityPositions}
          >
            ✓ p₀(vᵢ) = xᵢ (Igual que Croquis)
          </button>

          <div className="config-card__grid2">
            <label className="field" htmlFor="apply-topology">
              <span className="field__label">
                Topología rápida de G₀
                <em>{labelOf(GRAPH_PRESETS, config.graphPreset, config.g0)}</em>
              </span>
              <select
                id="apply-topology"
                value=""
                onChange={(event) => {
                  if (event.target.value) onApplyTopology(event.target.value);
                }}
              >
                {TOPOLOGY_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field" htmlFor="apply-colors">
              <span className="field__label">
                Coloración inicial Cᵢ⁰
                <em>{labelOf(colorOptions, config.colorPreset, config.g0)}</em>
              </span>
              <select
                id="apply-colors"
                value=""
                onChange={(event) => {
                  if (event.target.value) onApplyColors(event.target.value);
                }}
              >
                <option value="">— Aplicar colores —</option>
                {colorOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="config-card__note">
            {config.g0
              ? 'G₀ editado a mano: las herramientas del lienzo (Mover · +Nodo · Arista · Pintar · Borrar) fijan los valores iniciales.'
              : 'Elige un preset o edita G₀ directamente en el lienzo de la izquierda.'}
          </p>
        </div>

        <div className="config-card__actions">
          <button className="button button--primary" type="button" onClick={onReset}>
            ↺ Reiniciar cadena
          </button>
          <button
            className="button"
            type="button"
            onClick={fastRun?.status === 'running' ? onCancelFast : onFastRun}
          >
            {fastRun?.status === 'running'
              ? `■ Cancelar (${Math.round((fastRun.progress ?? 0) * 100)}%)`
              : '⏭ Ejecutar T pasos rápido'}
          </button>
        </div>
      </section>

      <section className="config-card">
        <header className="config-card__head">
          <h3>Parámetros del modelo</h3>
          <span className="config-card__badge">
            (c+1) = <strong>{config.colorCount}</strong>
          </span>
        </header>

        <div className="config-card__body config-card__body--grid">
          <label className="field" htmlFor="sketch-size">
            <span className="field__label">
              Tamaño de X (m) <strong>{config.sketchSize}</strong>
            </span>
            <input
              id="sketch-size"
              type="range"
              min={typeSpec.minSize}
              max={8}
              step={1}
              value={Math.max(config.sketchSize, typeSpec.minSize)}
              onChange={(e) => onGraphParam?.({ sketchSize: Number(e.target.value) })}
            />
          </label>

          <label className="field" htmlFor="color-count">
            <span className="field__label">
              Colores (c + 1) <strong>{config.colorCount}</strong>
            </span>
            <input
              id="color-count"
              type="range"
              min={2}
              max={5}
              step={1}
              value={config.colorCount}
              onChange={(e) => onModelParam({ colorCount: Number(e.target.value) })}
            />
          </label>

          <label className="field" htmlFor="param-k">
            <span className="field__label">
              Neutralidad k <strong>{config.k.toFixed(2)}</strong>
            </span>
            <input
              id="param-k"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={config.k}
              onChange={(e) => onModelParam({ k: Number(e.target.value) })}
            />
          </label>

          <label className="field" htmlFor="param-alpha">
            <span className="field__label">
              Sesgo territorial α <strong>{config.alpha.toFixed(1)}</strong>
            </span>
            <input
              id="param-alpha"
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={config.alpha}
              onChange={(e) => onModelParam({ alpha: Number(e.target.value) })}
            />
          </label>

          <label className="field" htmlFor="fast-steps">
            <span className="field__label">Iteraciones totales (T)</span>
            <input
              id="fast-steps"
              type="number"
              min={100}
              step={100}
              value={config.fastSteps}
              onChange={(e) =>
                onViewParam({ fastSteps: Math.max(100, Number(e.target.value) || 100) })
              }
            />
          </label>

          <label className="field" htmlFor="seed">
            <span className="field__label">Semilla PRNG</span>
            <input
              id="seed"
              type="number"
              min={0}
              step={1}
              value={config.seed}
              onChange={(e) => onModelParam({ seed: Number(e.target.value) || 0 })}
            />
          </label>

          <label className="field" htmlFor="window-steps">
            <span className="field__label">Ventana de tiempo</span>
            <select
              id="window-steps"
              value={config.windowSteps}
              onChange={(e) => onViewParam({ windowSteps: Number(e.target.value) })}
            >
              {WINDOWS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="config-card">
        <header className="config-card__head">
          <h3>Validación de hipótesis (Teorema 1)</h3>
          <span className={`config-card__badge ${hypotheses?.ok ? 'is-ok' : 'is-bad'}`}>
            {hypotheses?.ok ? '✓ aplicable' : '✗ no aplicable'}
          </span>
        </header>

        <div className="config-card__body">
          <div className="validator-grid" role="status" aria-live="polite">
            {(hypotheses?.items ?? []).map((item) => (
              <span
                key={item.id}
                className={`validator-item ${item.ok ? 'is-ok' : 'is-bad'}`}
                title={item.detail}
              >
                <strong>{item.ok ? '✓' : '✗'}</strong> {item.label}
              </span>
            ))}
          </div>

          <p className={`hypotheses__summary ${hypotheses?.ok ? 'is-ok' : 'is-bad'}`}>
            {hypotheses?.ok
              ? '{D_t} es finita, irreducible y aperiódica ⇒ existe una única π* y lím π₀Pᵗ = π* para cualquier π₀.'
              : `Hipótesis violada → la convergencia a una π* única NO está garantizada: ${failures
                  .map((f) => f.detail)
                  .join(' · ')}`}
          </p>
        </div>
      </section>
    </div>
  );
}

function labelOf(list, id, edited) {
  if (edited) return 'editada';
  const found = list.find((option) => option.id === id);
  return found ? found.label : '';
}
