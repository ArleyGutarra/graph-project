/**
 * Controles del experimento de ergodicidad (invariancia respecto de π₀).
 * Va en la cabecera de la celda de la tabla, para no consumir una fila entera.
 */
export default function ExperimentControls({ config, onViewParam, experiment, onRun, onClear }) {
  const { status, progress } = experiment;

  return (
    <div className="experiment">
      <div className="experiment__row">
        <span className="experiment__title">Invariancia respecto de π₀</span>

        <label className="field field--mini" htmlFor="chains">
          <span className="field__label">Cadenas</span>
          <select
            id="chains"
            value={config.chainsPerCondition}
            onChange={(e) => onViewParam({ chainsPerCondition: Number(e.target.value) })}
          >
            {[4, 10, 20, 40].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="field field--mini" htmlFor="steps">
          <span className="field__label">Pasos</span>
          <select
            id="steps"
            value={config.experimentSteps}
            onChange={(e) => onViewParam({ experimentSteps: Number(e.target.value) })}
          >
            {[1000, 3000, 6000].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <button
          className="button button--primary"
          type="button"
          onClick={onRun}
          disabled={status === 'running'}
        >
          {status === 'running' ? `${Math.round(progress * 100)}%` : '▶ Ejecutar'}
        </button>

        <button className="button" type="button" onClick={onClear} disabled={status === 'idle'}>
          Limpiar
        </button>
      </div>

      {status === 'running' ? (
        <div className="experiment__progress">
          <div
            className="experiment__progress-bar"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
          <span className="experiment__progress-label">
            simulando {config.chainsPerCondition} × 3 cadenas
          </span>
        </div>
      ) : null}
    </div>
  );
}
