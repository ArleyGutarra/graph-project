import HistogramChart from '../features/spatiotemporal/components/HistogramChart';
import { CONDITION_COLORS } from '../features/spatiotemporal/components/theme';
import { round } from '../shared/math/stats';

/**
 * Franja inferior del experimento de ergodicidad (horizontal):
 *   métricas | tabla de resultados | histograma final
 *
 * @param {object|null} props.result  resultado de createErgodicExperiment
 */
export default function ExperimentStrip({ status, progress, result }) {
  const running = status === 'running' && !result;

  return (
    <section className="presentation__experiment">
      <div className="presentation__metrics">
        <div className="result-metric">
          <div className="result-metric__label">Dispersión entre condiciones en t = 0</div>
          <div className="result-metric__value">
            {result ? `${round(result.spread.start, 2)} aristas` : '…'}
          </div>
        </div>
        <div className="result-metric">
          <div className="result-metric__label">Dispersión en la ventana final (misma π*)</div>
          <div className="result-metric__value">
            {result ? `${round(result.spread.final, 2)} aristas ↓` : '…'}
          </div>
        </div>
        <p className="presentation__note">
          {running
            ? `Calculando experimento… ${Math.round(progress * 100)} %`
            : 'Tres π₀ distintos bajo el mismo modelo: si la cadena es irreducible y aperiódica, las medias coinciden al final.'}
        </p>
      </div>

      <table className="result-table">
        <thead>
          <tr>
            <th>Condición inicial π₀</th>
            <th>⟨|E|⟩ ± σ</th>
            <th>Frecuencias C₀ / C₁ / C₂</th>
          </tr>
        </thead>
        <tbody>
          {result ? (
            result.conditions.map((cond, i) => (
              <tr key={cond.id}>
                <td>
                  <i className="result-table__dot" style={{ background: CONDITION_COLORS[i] }} />
                  {cond.label}
                </td>
                <td>
                  {round(cond.meanEdges, 2)} ± {round(cond.stdEdges, 2)}
                </td>
                <td>{cond.meanFractions.map((v) => round(v, 2)).join(' / ')}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3}>calculando las tres trayectorias…</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="presentation__histogram">
        {result ? (
          <HistogramChart
            title="Distribución de |E| en la ventana final (mismo π* desde π₀ distintos)"
            height={125}
            groups={result.conditions.map((cond, i) => ({
              label: cond.label,
              color: CONDITION_COLORS[i],
              histogram: cond.edgeHistogram,
            }))}
          />
        ) : (
          <div className="result-loading">calculando la distribución…</div>
        )}
      </div>
    </section>
  );
}
