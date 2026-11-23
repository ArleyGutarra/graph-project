import { subscript } from '../domain/initialState';
import { useSimulation } from '../hooks/useSimulation';
import ControlPanel from './ControlPanel';
import PlaybackBar from './PlaybackBar';
import GraphStage from './GraphStage';
import TimeSeriesChart from './TimeSeriesChart';
import ModelReference from './ModelReference';
import { colorOf, CONDITION_COLORS } from './theme';
import './simulation.css';

/**
 * Página de simulación del modelo del póster, con la disposición de la maqueta
 * dimensionada para una pantalla de laptop (1366×768):
 *
 *   fila 1 → escenario (izq., grafo grande) + dos gráficas de series (der.)
 *   fila 2 → barra de controles horizontal
 *   fila 3 → ficha del modelo
 *
 * Solo se muestra la simulación en vivo; el experimento de ergodicidad vive en
 * `engine/ergodicExperiment.js` (sin interfaz por ahora).
 *
 * Arquitectura por capas:
 *   domain/    → modelo puro (kernels de aristas, colores y desplazamiento)
 *   engine/    → cadena de Markov en vivo + experimento de ergodicidad
 *   hooks/     → orquestación en React (useSimulation)
 *   components/ → presentación (SVG puro, sin dependencias externas)
 */
export default function SimulationPage() {
  const sim = useSimulation();
  const { config, chain, sketch } = sim;

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
          height={151}
        />
        <TimeSeriesChart
          title="Frecuencia de cada color"
          yLabel="frecuencia"
          yDomain={[0, 1]}
          t0={0}
          stride={chain.history.stride}
          series={fractionSeries}
          height={151}
        />
      </section>

      {/* ---------- Fila 2 · barra de controles ---------- */}

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
