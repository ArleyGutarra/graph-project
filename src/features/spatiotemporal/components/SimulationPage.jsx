import { subscript } from '../domain/initialState';
import { useSimulation } from '../hooks/useSimulation';
import { round } from '../../../shared/math/stats';
import ControlPanel from './ControlPanel';
import ExperimentControls from './ExperimentControls';
import PlaybackBar from './PlaybackBar';
import GraphStage from './GraphStage';
import TimeSeriesChart from './TimeSeriesChart';
import HistogramChart from './HistogramChart';
import ModelReference from './ModelReference';
import { colorOf, CONDITION_COLORS } from './theme';
import './simulation.css';

/**
 * Página de simulación del modelo del póster, con la disposición de la maqueta
 * pensada para una pantalla de laptop (1366×768):
 *
 *   fila 1 → escenario (izq., grafo grande) + dos gráficas de series (der.)
 *   fila 2 → métricas de dispersión + tabla de condiciones + histograma
 *   fila 3 → barra de controles horizontal a pie de página
 *
 * Arquitectura por capas:
 *   domain/    → modelo puro (kernels de aristas, colores y desplazamiento)
 *   engine/    → cadena de Markov en vivo + experimento de ergodicidad
 *   hooks/     → orquestación en React (useSimulation)
 *   components/ → presentación (SVG puro, sin dependencias externas)
 */
export default function SimulationPage() {
  const sim = useSimulation();
  const { config, chain, sketch, experiment, conditions } = sim;

  const state = chain.state;
  const t = chain.t;
  const points = chain.history.points;
  const latest = points[points.length - 1];
  const result = experiment.result;

  const edgeSeries = [
    { label: '|E(G_t)|', color: CONDITION_COLORS[0], values: points.map((p) => p.edges) },
  ];

  const fractionSeries = Array.from({ length: sketch.colorCount }, (_, i) => ({
    label: `C${subscript(i)}`,
    color: colorOf(i),
    values: points.map((p) => p.colorFractions[i]),
  }));

  const frequencyHeader = Array.from({ length: sketch.colorCount }, (_, i) => (
    <span key={i}>
      {i > 0 ? ' / ' : ''}C{subscript(i)}
    </span>
  ));

  return (
    <main className="simulation">
      {/* ---------- Fila 1 · escenario + gráficas ---------- */}

      <section className="simulation__stage cell--stage">
        <GraphStage state={state} sketch={sketch} t={t} observables={latest} />
        <PlaybackBar
          playing={sim.playing}
          onToggle={sim.togglePlay}
          onStep={sim.stepOnce}
          onReset={sim.reset}
          onStop={sim.stop}
        />
      </section>

      <section className="cell--charts">
        <TimeSeriesChart
          title="Número de aristas a lo largo del tiempo"
          yLabel="aristas"
          t0={0}
          stride={chain.history.stride}
          series={edgeSeries}
          height={95}
        />
        <TimeSeriesChart
          title="Frecuencia de cada color"
          yLabel="frecuencia"
          yDomain={[0, 1]}
          t0={0}
          stride={chain.history.stride}
          series={fractionSeries}
          height={95}
        />
      </section>

      {/* ---------- Fila 2 · resultados del experimento ---------- */}

      <section className="cell--metrics">
        <div className="metric">
          <span className="metric__label">Dispersión entre condiciones en t = 0</span>
          <span className="metric__value">
            {result ? `${round(result.spread.start, 2)} aristas` : '—'}
          </span>
        </div>

        <div className="metric">
          <span className="metric__label">Dispersión en la ventana final (mismo π*)</span>
          <span className="metric__value">
            {result ? `${round(result.spread.final, 2)} aristas` : '—'}
            {result && result.spread.final < result.spread.start ? ' ↓' : ''}
          </span>
        </div>

        <p className="metrics__note">
          Tres π₀ distintos bajo el mismo modelo: si la cadena es irreducible y aperiódica, las
          medias coinciden al final.
          {result ? (
            <span className="metrics__meta">
              {result.chainsPerCondition} × {conditions.length} cadenas · {result.steps} pasos ·
              ventana final de {result.steps - result.windowStart}
            </span>
          ) : null}
        </p>
      </section>

      <section className="cell--table">
        <ExperimentControls
          config={config}
          onViewParam={sim.setViewParam}
          experiment={experiment}
          onRun={sim.runExperiment}
          onClear={sim.clearExperiment}
        />

        {result ? (
          <table className="sim-table">
            <thead>
              <tr>
                <th>Condición inicial Π₀</th>
                <th>⟨|E|⟩ ± Σ</th>
                <th colSpan={sketch.colorCount}>Frecuencias {frequencyHeader}</th>
              </tr>
            </thead>
            <tbody>
              {result.conditions.map((cond, i) => (
                <tr key={cond.id}>
                  <td>
                    <i className="sim-table__dot" style={{ background: CONDITION_COLORS[i] }} />
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
        ) : (
          <p className="cell__hint">
            Pulsa <strong>▶ Ejecutar</strong> para correr {config.experimentSteps} pasos por cadena
            en cada una de las tres condiciones iniciales.
          </p>
        )}
      </section>

      <section className="cell--hist">
        <HistogramChart
          title="Distribución de |E| en la ventana final (mismo π* desde π₀ distintos)"
          height={132}
          groups={conditions.map((cond, i) => ({
            label: cond.label,
            color: CONDITION_COLORS[i],
            histogram: result
              ? result.conditions[i].edgeHistogram
              : { xs: [], counts: [] },
          }))}
        />
      </section>

      {/* ---------- Fila 3 · barra de controles ---------- */}

      <section className="cell--controls">
        <ControlPanel
          config={config}
          onModelParam={sim.setModelParam}
          onViewParam={sim.setViewParam}
          onReset={sim.reset}
        />
      </section>

      {/* ---------- Ficha del modelo ---------- */}

      <section className="cell--reference">
        <ModelReference />
      </section>
    </main>
  );
}
