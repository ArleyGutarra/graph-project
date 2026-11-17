import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createSketch } from '../domain/sketch';
import { createModel } from '../domain/model';
import { buildConditions } from '../domain/initialState';
import { createChain } from '../engine/chain';
import { createErgodicExperiment } from '../engine/ergodicExperiment';

/** Parámetros por defecto (el ejemplo del póster: X = C₆, tres colores). */
export const DEFAULT_CONFIG = {
  // Modelo
  sketchType: 'cycle',
  sketchSize: 6,
  colorCount: 3, // = c + 1
  k: 0.5, // k ∈ (0,1)
  alpha: 1, // α > 0
  // Estado inicial de la cadena en vivo
  graphPreset: 'complete',
  colorPreset: 'unanimous0',
  positionPreset: 'identity',
  seed: 2026,
  // Reproducción
  speed: 3, // pasos por cuadro
  // Experimento de ergodicidad
  chainsPerCondition: 10,
  experimentSteps: 3000,
};

const FPS = 30;

/**
 * Orquestación de la simulación (capa de aplicación).
 *
 * - `config`       : parámetros editables desde la interfaz.
 * - `chain`        : cadena de Markov en vivo (objeto mutable fuera de React).
 * - `experiment`   : experimento multi-condición, ejecutado por trozos.
 *
 * Los objetos mutables viven en memo/ref; el estado de React solo guarda lo
 * necesario para volver a renderizar (esto evita copiar el historial a cada
 * cuadro).
 */
export function useSimulation() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [resetToken, setResetToken] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [, tick] = useReducer((count) => count + 1, 0);
  const [experiment, setExperiment] = useState({ status: 'idle', progress: 0, result: null });
  const experimentRef = useRef(null);

  const sketch = useMemo(
    () =>
      createSketch({
        type: config.sketchType,
        size: config.sketchSize,
        colorCount: config.colorCount,
      }),
    [config.sketchType, config.sketchSize, config.colorCount]
  );

  const model = useMemo(
    () => createModel({ sketch, k: config.k, alpha: config.alpha }),
    [sketch, config.k, config.alpha]
  );

  // `resetToken` obliga a reconstruir la cadena (botón "Reiniciar"); se
  // referencia dentro del memo para que exhaustive-deps lo acepte.
  const chain = useMemo(() => {
    void resetToken;
    return createChain({
      model,
      seed: config.seed,
      initial: {
        graphPreset: config.graphPreset,
        colorPreset: config.colorPreset,
        positionPreset: config.positionPreset,
      },
    });
  }, [
    resetToken,
    model,
    config.seed,
    config.graphPreset,
    config.colorPreset,
    config.positionPreset,
  ]);

  const conditions = useMemo(() => buildConditions(config.colorCount), [config.colorCount]);

  /** Cambia un parámetro del MODELO: además reinicia la cadena. */
  const setModelParam = useCallback((patch) => {
    setConfig((current) => ({ ...current, ...patch }));
    setResetToken((value) => value + 1);
  }, []);

  /** Cambia un parámetro de VISTA (no afecta al modelo ni a la cadena). */
  const setViewParam = useCallback((patch) => {
    setConfig((current) => ({ ...current, ...patch }));
  }, []);

  const reset = useCallback(() => setResetToken((value) => value + 1), []);

  const stepOnce = useCallback(() => {
    chain.step();
    tick();
  }, [chain]);

  const togglePlay = useCallback(() => setPlaying((value) => !value), []);

  const stop = useCallback(() => setPlaying(false), []);

  // --- Bucle de reproducción -------------------------------------------------
  useEffect(() => {
    if (!playing) return undefined;

    let rafId = 0;
    let last = 0;
    const interval = 1000 / FPS;

    const loop = (now) => {
      rafId = requestAnimationFrame(loop);
      if (now - last < interval) return;
      last = now;
      for (let i = 0; i < config.speed; i++) chain.step();
      tick();
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [playing, chain, config.speed]);

  // --- Experimento de ergodicidad -------------------------------------------
  const runExperiment = useCallback(() => {
    experimentRef.current = createErgodicExperiment({
      model,
      conditions,
      chainsPerCondition: config.chainsPerCondition,
      steps: config.experimentSteps,
      seed: config.seed + 1000,
    });
    setExperiment({ status: 'running', progress: 0, result: null });
  }, [model, conditions, config.chainsPerCondition, config.experimentSteps, config.seed]);

  const clearExperiment = useCallback(() => {
    experimentRef.current = null;
    setExperiment({ status: 'idle', progress: 0, result: null });
  }, []);

  useEffect(() => {
    if (experiment.status !== 'running') return undefined;

    let rafId = 0;
    // Termina en ~120 cuadros (~4 s) sin bloquear la interfaz.
    const chunk = Math.max(1, Math.ceil(config.experimentSteps / 120));

    const loop = () => {
      const exp = experimentRef.current;
      if (!exp) return;
      exp.runChunk(chunk);
      if (exp.finished) {
        setExperiment({ status: 'done', progress: 1, result: exp.buildResult() });
      } else {
        setExperiment({ status: 'running', progress: exp.progress, result: null });
        rafId = requestAnimationFrame(loop);
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [experiment.status, config.experimentSteps]);

  return {
    config,
    setModelParam,
    setViewParam,
    reset,
    sketch,
    model,
    chain,
    playing,
    togglePlay,
    stop,
    stepOnce,
    conditions,
    experiment,
    runExperiment,
    clearExperiment,
  };
}
