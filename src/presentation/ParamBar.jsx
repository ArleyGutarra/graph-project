import {
  GRAPH_PRESETS,
  POSITION_PRESETS,
  colorPresets,
} from '../features/spatiotemporal/domain/initialState';
import { SKETCH_TYPES } from '../features/spatiotemporal/domain/sketch';

/**
 * Barra de parámetros en HORIZONTAL (rejilla de 5 columnas × 2 filas):
 * la 4-tupla (X, {C^X_i}, k, α) + estado inicial + semilla.
 */
export default function ParamBar({ config, onModelParam, onReset }) {
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
    <section className="presentation__params" aria-label="Parámetros del modelo">
      <label className="field" htmlFor="p-type">
        <span className="field__label">Croquis X</span>
        <select id="p-type" value={config.sketchType} onChange={handleType}>
          {SKETCH_TYPES.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field" htmlFor="p-size">
        <span className="field__label">
          Tamaño m = n <strong>{config.sketchSize}</strong>
        </span>
        <input
          id="p-size"
          type="range"
          min={typeSpec.minSize}
          max={8}
          step={1}
          value={Math.max(config.sketchSize, typeSpec.minSize)}
          onChange={handleSize}
        />
      </label>

      <label className="field" htmlFor="p-colors">
        <span className="field__label">
          Colores c + 1 <strong>{config.colorCount}</strong>
        </span>
        <input
          id="p-colors"
          type="range"
          min={2}
          max={Math.min(4, config.sketchSize)}
          step={1}
          value={config.colorCount}
          onChange={handleColorCount}
        />
      </label>

      <label className="field" htmlFor="p-k">
        <span className="field__label">
          k <strong>{config.k.toFixed(2)}</strong>
        </span>
        <input
          id="p-k"
          type="range"
          min={0.05}
          max={0.95}
          step={0.05}
          value={config.k}
          onChange={(e) => onModelParam({ k: Number(e.target.value) })}
        />
      </label>

      <label className="field" htmlFor="p-alpha">
        <span className="field__label">
          α <strong>{config.alpha.toFixed(1)}</strong>
        </span>
        <input
          id="p-alpha"
          type="range"
          min={0.1}
          max={5}
          step={0.1}
          value={config.alpha}
          onChange={(e) => onModelParam({ alpha: Number(e.target.value) })}
        />
      </label>

      <label className="field" htmlFor="p-graph">
        <span className="field__label">Grafo G₀</span>
        <select
          id="p-graph"
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

      <label className="field" htmlFor="p-coloring">
        <span className="field__label">Coloración</span>
        <select
          id="p-coloring"
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

      <label className="field" htmlFor="p-positions">
        <span className="field__label">Posiciones p₀</span>
        <select
          id="p-positions"
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

      <label className="field" htmlFor="p-seed">
        <span className="field__label">
          Semilla <strong>{config.seed}</strong>
        </span>
        <input
          id="p-seed"
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
  );
}
