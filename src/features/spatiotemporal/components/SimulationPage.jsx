import { subscript } from '../domain/initialState';
import { useSimulation } from '../hooks/useSimulation';
import ControlPanel from './ControlPanel';
import PlaybackBar from './PlaybackBar';
import GraphStage from './GraphStage';
import TimeSeriesChart from './TimeSeriesChart';
import ErgodicPanel from './ErgodicPanel';
import ModelReference from './ModelReference';
import { colorOf, CONDITION_COLORS } from './theme';
import './simulation.css';

/**
 * Página de simulación del modelo del póster.
 *
 * Arquitectura por capas:
 *   domain/   → modelo puro (kernels de aristas, colores y desplazamiento)
 *   engine/   → cadena de Markov en vivo + experimento de ergodicidad
 *   hooks/    → orquestación en React (useSimulation)
 *   components/ → presentación (SVG puro, sin dependencias externas)
 */
export default function SimulationPage() {
  const sim = useSimulation();
  const { config, chain, sketch, experiment, conditions } = sim;

  const state = chain.state;
  const t = chain.t;
  const points = chain.history.points;
  const latest = points[points.length - 1];

  const edgeSeries = [
    { label: '|E(G_t)|', color: CONDITION_COLORS[0], values: points.map((p) => p.edges) },
  ];

  const fractionSeries = Array.from({ length: sketch.colorCount }, (_, i) => ({
    label: `C${subscript(i)}`,
    color: colorOf(i),
    values: points.map((p) => p.colorFractions[i]),
  }));

  return (
    <main className="simulation">
      <aside className="simulation__sidebar">
        <ControlPanel
          config={config}
          onModelParam={sim.setModelParam}
          onViewParam={sim.setViewParam}
          onReset={sim.reset}
        />
      </aside>

      <div className="simulation__content">
        <section className="simulation__stage">
          <GraphStage state={state} sketch={sketch} t={t} observables={latest} />
          <PlaybackBar
            playing={sim.playing}
            onToggle={sim.togglePlay}
            onStep={sim.stepOnce}
            onReset={sim.reset}
            onStop={sim.stop}
          />
        </section>

        <section className="simulation__charts">
          <TimeSeriesChart
            title="Número de aristas a lo largo del tiempo"
            yLabel="aristas"
            t0={0}
            stride={chain.history.stride}
            series={edgeSeries}
          />
          <TimeSeriesChart
            title="Frecuencia de cada color"
            yLabel="frecuencia"
            yDomain={[0, 1]}
            t0={0}
            stride={chain.history.stride}
            series={fractionSeries}
          />
        </section>

        <ErgodicPanel
          config={config}
          onViewParam={sim.setViewParam}
          experiment={experiment}
          onRun={sim.runExperiment}
          onClear={sim.clearExperiment}
          colorCount={sketch.colorCount}
          conditions={conditions}
        />

        <ModelReference />
      </div>
    </main>
  );
}
