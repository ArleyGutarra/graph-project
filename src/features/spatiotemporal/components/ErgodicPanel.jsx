import { subscript } from '../domain/initialState';
import { mean, round } from '../../../shared/math/stats';
import { CONDITION_COLORS } from './theme';
import TimeSeriesChart from './TimeSeriesChart';
import HistogramChart from './HistogramChart';

/**
 * Experimento de ergodicidad: tres condiciones iniciales distintas corriendo
 * bajo el mismo modelo. Si la cadena converge a una única π*, las medias de
 * cada condición deben acercarse entre sí (independencia respecto de π₀).
 */
export default function ErgodicPanel({
  config,
  onViewParam,
  experiment,
  onRun,
  onClear,
  colorCount,
  conditions,
}) {
  const { status, progress, result } = experiment;

  return (
    <div className="experiment">
      <div className="experiment__header">
        <div>
          <h2 className="experiment__title">Experimento: invariancia respecto de π₀</h2>
          <p className="experiment__subtitle">
            Tres condiciones iniciales (figura del póster) corren en paralelo con el mismo
            (X, {`{C^X_i}`}, k, α). Si existe una única π*, sus medias coinciden al final.
          </p>
        </div>

        <div className="experiment__controls">
          <label className="field field--inline" htmlFor="chains">
            <span className="field__label">Cadenas/condición</span>
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

          <label className="field field--inline" htmlFor="steps">
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
            {status === 'running' ? 'Ejecutando…' : '▶ Ejecutar'}
          </button>
          <button className="button" type="button" onClick={onClear} disabled={status === 'idle'}>
            Limpiar
          </button>
        </div>
      </div>

      {status === 'running' ? (
        <div className="experiment__progress">
          <div
            className="experiment__progress-bar"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
          <span className="experiment__progress-label">
            {Math.round(progress * 100)}% · simulando {config.chainsPerCondition * conditions.length}{' '}
            cadenas
          </span>
        </div>
      ) : null}

      {status === 'idle' ? (
        <p className="experiment__hint">
          Pulsa <strong>Ejecutar</strong> para correr {config.experimentSteps} pasos por cadena.
          Se compararán |E(G_t)| y las frecuencias de color entre las tres condiciones.
        </p>
      ) : null}

      {status === 'done' && result ? (
        <div className="experiment__results">
          <div className="experiment__verdict">
            <div className="metric">
              <span className="metric__label">Dispersión entre condiciones en t = 0</span>
              <span className="metric__value">{round(result.spread.start, 2)} aristas</span>
            </div>
            <div className="metric">
              <span className="metric__label">Dispersión en la ventana final (mismo π*)</span>
              <span className="metric__value">
                {round(result.spread.final, 2)} aristas
                {result.spread.final < result.spread.start ? '  ↓' : ''}
              </span>
            </div>
            <div className="metric">
              <span className="metric__label">Cadenas · pasos · ventana final</span>
              <span className="metric__value">
                {result.chainsPerCondition} × {conditions.length} · {result.steps} ·{' '}
                {result.steps - result.windowStart}
              </span>
            </div>
          </div>

          <table className="sim-table">
            <thead>
              <tr>
                <th>Condición inicial</th>
                <th>⟨|E|⟩ ventana final</th>
                {Array.from({ length: colorCount }, (_, i) => (
                  <th key={i}>
                    ⟨frec. C{subscript(i)}⟩
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.conditions.map((cond, i) => (
                <tr key={cond.id}>
                  <td>
                    <i
                      className="sim-table__dot"
                      style={{ background: CONDITION_COLORS[i] }}
                    />
                    {cond.label}
                  </td>
                  <td>
                    {round(cond.meanEdges, 2)} ± {round(cond.stdEdges, 2)}
                  </td>
                  {cond.meanFractions.map((value, j) => (
                    <td key={j}>{round(value, 3)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="experiment__charts">
            <TimeSeriesChart
              title="Media de |E(G_t)| por condición inicial"
              yLabel="aristas"
              t0={0}
              stride={1}
              series={result.conditions.map((cond, i) => ({
                label: cond.label,
                color: CONDITION_COLORS[i],
                values: result.series[i].edges,
              }))}
            />

            {Array.from({ length: colorCount }, (_, color) => (
              <TimeSeriesChart
                key={color}
                title={`Frecuencia de C${subscript(color)} (media entre cadenas)`}
                yLabel="frecuencia"
                yDomain={[0, 1]}
                t0={0}
                stride={1}
                series={result.conditions.map((cond, i) => ({
                  label: cond.label,
                  color: CONDITION_COLORS[i],
                  values: result.series[i].colors[color],
                }))}
              />
            ))}

            <HistogramChart
              title={`Distribución de |E| en la ventana final (media ${round(mean(result.conditions.map((c) => c.meanEdges)), 2)} aristas)`}
              groups={result.conditions.map((cond, i) => ({
                label: cond.label,
                color: CONDITION_COLORS[i],
                histogram: cond.edgeHistogram,
              }))}
            />

            <TimeSeriesChart
              title="Dispersión entre condiciones (max − min de ⟨|E|⟩)"
              yLabel="aristas"
              t0={0}
              stride={1}
              series={[
                {
                  label: 'max − min entre π₀',
                  color: '#6b6b6b',
                  values: result.spread.values,
                },
              ]}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
