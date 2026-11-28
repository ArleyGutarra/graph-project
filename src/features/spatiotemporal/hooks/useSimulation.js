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
  // Reproducción (velocidad en pasos por segundo, como en la maqueta)
  speed: 2,
  subphase: 'plus', // micro-paso mostrado: 'minus' (t⁻) o 'plus' (t⁺)
  showDiff: true, // resaltar aristas añadidas/eliminadas en la vista Simular
  g0: null, // G₀ editado a mano con las herramientas de la vista Configurar
  // Vista
  windowSteps: 0, // ventana temporal de las series (0 = automática)
  fastSteps: 1000, // T del botón "Ejecutar T pasos rápido"
  // Experimento de ergodicidad
  chainsPerCondition: 10,
  experimentSteps: 3000,
};

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
  const [fastRun, setFastRun] = useState({ status: 'idle', progress: 0 });
  const fastRef = useRef({ active: false, total: 0, done: 0 });

  const sketch = useMemo(
    () =>
      createSketch({
        type: config.sketchType,
        size: config.sketchSize,
        colorCount: config.colorCount,
      }),
    [config.sketchType, config.sketchSize, config.colorCount]
  );

  // Vértices de G: si hay un G₀ editado, su longitud; si no, n = m.
  // Mantenerlos separados es lo que permite borrar/añadir vértices sin mover
  // el anillo de posiciones de X.
  const vertexCount = config.g0?.positions?.length ?? config.sketchSize;

  const model = useMemo(
    () => createModel({ sketch, k: config.k, alpha: config.alpha, n: vertexCount }),
    [sketch, config.k, config.alpha, vertexCount]
  );

  // `resetToken` obliga a reconstruir la cadena (botón "Reiniciar"); se
  // referencia dentro del memo para que exhaustive-deps lo acepte.
  const chain = useMemo(() => {
    void resetToken;
    return createChain({
      model,
      seed: config.seed,
      initial: {
        graphPreset: config.g0 ? 'custom' : config.graphPreset,
        colorPreset: config.g0 ? 'custom' : config.colorPreset,
        positionPreset: config.g0 ? 'custom' : config.positionPreset,
        custom: config.g0,
      },
    });
  }, [
    resetToken,
    model,
    config.seed,
    config.g0,
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

  /** Avanza `count` pasos de golpe (botones −5 / +5 del transporte). */
  const stepBy = useCallback(
    (count) => {
      if (count > 0) chain.stepBy(count);
      else if (count < 0) chain.seek(chain.t + count);
      tick();
    },
    [chain]
  );

  /** Salta a un instante concreto del scrubber. */
  const seek = useCallback(
    (target) => {
      if (chain.seek(target)) tick();
    },
    [chain]
  );

  /** Botón |◀ : vuelve al fotograma más antiguo retenido. */
  const rewind = useCallback(() => {
    if (chain.rewind()) tick();
  }, [chain]);

  const togglePlay = useCallback(() => setPlaying((value) => !value), []);

  const stop = useCallback(() => setPlaying(false), []);

  // --- Bucle de reproducción (velocidad en pasos por segundo) ---------------
  useEffect(() => {
    if (!playing) return undefined;

    let rafId = 0;
    let last = 0;
    let accumulated = 0;

    const loop = (now) => {
      rafId = requestAnimationFrame(loop);
      if (last === 0) {
        last = now;
        return;
      }
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      accumulated += dt * config.speed;

      const steps = Math.floor(accumulated);
      if (steps <= 0) return;
      accumulated -= steps;
      for (let i = 0; i < steps; i++) chain.step(i === steps - 1);
      tick();
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [playing, chain, config.speed]);

  // --- "Ejecutar T pasos rápido" -------------------------------------------
  // Avanza la cadena en vivo T pasos en trozos de ~20 ms: la barra de
  // progreso se actualiza y la interfaz no se congela.
  const runFast = useCallback((total) => {
    fastRef.current = { active: true, total, done: 0 };
    setFastRun({ status: 'running', progress: 0 });
  }, []);

  const cancelFast = useCallback(() => {
    fastRef.current.active = false;
    setFastRun((current) => ({ ...current, status: 'idle', progress: 0 }));
  }, []);

  useEffect(() => {
    if (fastRun.status !== 'running') return undefined;

    let rafId = 0;
    const loop = () => {
      const ref = fastRef.current;
      if (!ref.active) {
        setFastRun({ status: 'idle', progress: 0 });
        return;
      }

      const started = performance.now();
      while (performance.now() - started < 20 && ref.done < ref.total) {
        chain.step(false); // sin detalle: T puede ser 10⁶
        ref.done += 1;
      }

      if (ref.done >= ref.total) {
        ref.active = false;
        tick();
        setFastRun({ status: 'done', progress: 1 });
        return;
      }

      tick();
      setFastRun({ status: 'running', progress: ref.done / ref.total });
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [fastRun.status, chain]);

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
    vertexCount,
    chain,
    playing,
    togglePlay,
    stop,
    stepOnce,
    stepBy,
    seek,
    rewind,
    fastRun,
    runFast,
    cancelFast,
    conditions,
    experiment,
    runExperiment,
    clearExperiment,
  };
}
