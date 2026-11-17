import { useEffect, useRef, useState } from 'react';
import { useSimulation } from '../features/spatiotemporal/hooks/useSimulation';
import GraphStage from '../features/spatiotemporal/components/GraphStage';
import PlaybackBar from '../features/spatiotemporal/components/PlaybackBar';
import TimeSeriesChart from '../features/spatiotemporal/components/TimeSeriesChart';
import { colorOf, CONDITION_COLORS } from '../features/spatiotemporal/components/theme';
import { subscript } from '../features/spatiotemporal/domain/initialState';
import ParamBar from './ParamBar';
import ExperimentStrip from './ExperimentStrip';

const WIDTH = 1024;
const HEIGHT = 768;

function fitScale() {
  return Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
}

/**
 * Presentación 1024 × 768 (4:3): SOLO la simulación, dispuesta en
 * horizontal — cabecera, luego [escenario | series temporales],
 * después la franja del experimento y la barra de parámetros.
 *
 * Arranca sola: reproduce la cadena y lanza el experimento.
 * Teclas: F = pantalla completa.
 */
export default function PresentationScreen() {
  const sim = useSimulation();
  const [scale, setScale] = useState(() =>
    typeof window === 'undefined' ? 1 : fitScale()
  );
  const startedRef = useRef(false);

  useEffect(() => {
    const fit = () => setScale(fitScale());
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // Arranque único: animar la cadena y lanzar el experimento de ergodicidad.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    sim.togglePlay();
    sim.runExperiment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'f' || event.key === 'F') toggleFullscreen();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const { config, chain, sketch, experiment } = sim;
  const state = chain.state;
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
    <div className="deck-viewport">
      <div className="deck" style={{ transform: `scale(${scale})` }}>
        <div className="presentation">
          <header className="presentation__header">
            <span className="presentation__led" aria-hidden="true" />
            <h1>Ergodicidad y convergencia en redes espacio-temporales</h1>
            <span className="presentation__badge">VI CIMM-UNI · 2026</span>
            <button
              className="presentation__fs"
              type="button"
              onClick={toggleFullscreen}
              aria-label="Pantalla completa (F)"
              title="Pantalla completa (F)"
            >
              ⛶
            </button>
          </header>

          {/* Fila principal: escenario | series temporales */}
          <div className="presentation__main">
            <section className="simulation__stage presentation__stage" aria-label="Escenario">
              <GraphStage state={state} sketch={sketch} t={chain.t} observables={latest} />
              <PlaybackBar
                playing={sim.playing}
                onToggle={sim.togglePlay}
                onStep={sim.stepOnce}
                onReset={sim.reset}
                onStop={sim.stop}
              />
            </section>

            <section className="presentation__charts" aria-label="Series temporales">
              <TimeSeriesChart
                title="Número de aristas a lo largo del tiempo"
                yLabel="aristas"
                t0={0}
                stride={chain.history.stride}
                height={100}
                series={edgeSeries}
              />
              <TimeSeriesChart
                title="Frecuencia de cada color"
                yLabel="frec."
                yDomain={[0, 1]}
                t0={0}
                stride={chain.history.stride}
                height={100}
                series={fractionSeries}
              />
            </section>
          </div>

          {/* Franja del experimento de ergodicidad */}
          <ExperimentStrip
            status={experiment.status}
            progress={experiment.progress}
            result={experiment.result}
          />

          {/* Barra de parámetros en horizontal */}
          <ParamBar config={config} onModelParam={sim.setModelParam} onReset={sim.reset} />
        </div>
      </div>
    </div>
  );
}
