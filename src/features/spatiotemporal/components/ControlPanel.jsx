import { GRAPH_PRESETS, POSITION_PRESETS, colorPresets, subscript } from '../domain/initialState';
import { SKETCH_TYPES } from '../domain/sketch';

/**
 * Panel de parámetros: la 4-tupla (X, {C^X_i}, k, α) + estado inicial.
 * Los cambios de parámetros del modelo reinician la cadena (para que siga
 * siendo homogénea); los de vista no.
 */
export default function ControlPanel({ config, onModelParam, onViewParam, onReset }) {
  const colorOptions = colorPresets(config.colorCount);
  const typeSpec = SKETCH_TYPES.find((s) => s.id === config.sketchType) ?? SKETCH_TYPES[0];

  const handleType = (event) => {
    const type = event.target.value;
    const spec = SKETCH_TYPES.find((s) => s.id === type);
    onModelParam({ sketchType: type, sketchSize: Math.max(config.sketchSize, spec.minSize) });
  };

  const handleSize = (event) => {
    const size = Number(event.target.value);
    onModelParam({ sketchSize: size, colorCount: Math.min(config.colorCount, size) });
  };

  const handleColorCount = (event) => {
    onModelParam({ colorCount: Math.min(Number(event.target.value), config.sketchSize) });
  };

  return (
    <div className="panel">
      <section className="panel__section">
        <h3 className="panel__title">Croquis X</h3>

        <label className="field" htmlFor="sketch-type">
          <span className="field__label">Forma</span>
          <select id="sketch-type" value={config.sketchType} onChange={handleType}>
            {SKETCH_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field" htmlFor="sketch-size">
          <span className="field__label">
            Tamaño m = n <strong>{config.sketchSize}</strong>
          </span>
          <input
            id="sketch-size"
            type="range"
            min={typeSpec.minSize}
            max={8}
            step={1}
            value={Math.max(config.sketchSize, typeSpec.minSize)}
            onChange={handleSize}
          />
        </label>

        <label className="field" htmlFor="color-count">
          <span className="field__label">
            Colores c + 1 = <strong>{config.colorCount}</strong>
          </span>
          <input
            id="color-count"
            type="range"
            min={2}
            max={Math.min(4, config.sketchSize)}
            step={1}
            value={config.colorCount}
            onChange={handleColorCount}
          />
        </label>
      </section>

      <section className="panel__section">
        <h3 className="panel__title">Parámetros (k, α)</h3>

        <label className="field" htmlFor="param-k">
          <span className="field__label">
            k = <strong>{config.k.toFixed(2)}</strong> <em>k ∈ (0,1)</em>
          </span>
          <input
            id="param-k"
            type="range"
            min={0.05}
            max={0.95}
            step={0.05}
            value={config.k}
            onChange={(e) => onModelParam({ k: Number(e.target.value) })}
          />
        </label>

        <label className="field" htmlFor="param-alpha">
          <span className="field__label">
            α = <strong>{config.alpha.toFixed(1)}</strong> <em>α &gt; 0</em>
          </span>
          <input
            id="param-alpha"
            type="range"
            min={0.1}
            max={5}
            step={0.1}
            value={config.alpha}
            onChange={(e) => onModelParam({ alpha: Number(e.target.value) })}
          />
        </label>
      </section>

      <section className="panel__section">
        <h3 className="panel__title">Estado inicial π₀</h3>

        <label className="field" htmlFor="initial-graph">
          <span className="field__label">Grafo G₀</span>
          <select
            id="initial-graph"
            value={config.graphPreset}
            onChange={(e) => onModelParam({ graphPreset: e.target.value })}
          >
            {GRAPH_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field" htmlFor="initial-color">
          <span className="field__label">Coloración</span>
          <select
            id="initial-color"
            value={config.colorPreset}
            onChange={(e) => onModelParam({ colorPreset: e.target.value })}
          >
            {colorOptions.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field" htmlFor="initial-position">
          <span className="field__label">Posiciones p₀</span>
          <select
            id="initial-position"
            value={config.positionPreset}
            onChange={(e) => onModelParam({ positionPreset: e.target.value })}
          >
            {POSITION_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field" htmlFor="seed">
          <span className="field__label">Semilla</span>
          <input
            id="seed"
            type="number"
            min={0}
            step={1}
            value={config.seed}
            onChange={(e) => onModelParam({ seed: Number(e.target.value) || 0 })}
          />
        </label>

        <button className="button button--primary" type="button" onClick={onReset}>
          ↺ Reiniciar cadena
        </button>
      </section>

      <section className="panel__section">
        <h3 className="panel__title">Reproducción</h3>

        <label className="field" htmlFor="speed">
          <span className="field__label">
            Velocidad <strong>{config.speed}</strong> pasos/cuadro
          </span>
          <input
            id="speed"
            type="range"
            min={1}
            max={10}
            step={1}
            value={config.speed}
            onChange={(e) => onViewParam({ speed: Number(e.target.value) })}
          />
        </label>
      </section>

      <p className="panel__hint">
        Los colores disponibles son C₀ … C{subscript(config.colorCount - 1)}; el coloreado del
        croquis C^X_i se asigna en round-robin para que C^X_i ≠ ∅.
      </p>
    </div>
  );
}
