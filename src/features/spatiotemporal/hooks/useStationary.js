import { useCallback, useEffect, useRef, useState } from 'react';

const EMPTY_RUN = { status: 'idle', progress: 0, t: 0, result: null, error: null };
const EMPTY_EXACT = { status: 'idle', phase: null, progress: 0, result: null, error: null };

/**
 * Orquesta el Web Worker del modo Estacionaria.
 *
 * Devuelve dos trabajos independientes identificados por `key`
 * ('stationary' → π* con una cadena, 'independence' → las 3 cadenas del
 * póster) y el cálculo exacto, cada uno con su progreso y su cancelación.
 * El hilo principal nunca ejecuta el bucle: sólo renderiza.
 */
export function useStationary() {
  const workerRef = useRef(null);
  const [runs, setRuns] = useState({ stationary: EMPTY_RUN, independence: EMPTY_RUN });
  const [exact, setExact] = useState(EMPTY_EXACT);

  const handleMessage = useCallback((event) => {
    const message = event.data;
    switch (message.type) {
      case 'run:progress':
        setRuns((current) => ({
          ...current,
          [message.key]: {
            ...current[message.key],
            status: 'running',
            progress: message.progress,
            t: message.t,
          },
        }));
        break;
      case 'run:done':
        setRuns((current) => ({
          ...current,
          [message.key]: {
            status: 'done',
            progress: 1,
            t: message.result.steps,
            result: message.result,
            error: null,
          },
        }));
        break;
      case 'run:cancelled':
        setRuns((current) => ({
          ...current,
          [message.key]: { ...current[message.key], status: 'idle', progress: 0 },
        }));
        break;
      case 'run:error':
        setRuns((current) => ({
          ...current,
          [message.key]: { ...current[message.key], status: 'error', error: message.message },
        }));
        break;
      case 'exact:progress':
        setExact((current) => ({
          ...current,
          status: 'running',
          phase: message.phase,
          progress: message.progress,
          iterations: message.iterations ?? current.iterations,
          delta: message.delta ?? current.delta,
        }));
        break;
      case 'exact:done':
        setExact({ status: 'done', phase: 'done', progress: 1, result: message.result, error: null });
        break;
      case 'exact:error':
        setExact((current) => ({ ...current, status: 'error', error: message.message }));
        break;
      default:
        break;
    }
  }, []);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const worker = new Worker(new URL('../engine/stationary.worker.js', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = handleMessage;
      worker.onerror = (event) => {
        const message = event?.message ?? 'Error en el worker del modo Estacionaria';
        setRuns((current) => ({
          stationary: { ...current.stationary, status: 'error', error: message },
          independence: { ...current.independence, status: 'error', error: message },
        }));
        setExact((current) => ({ ...current, status: 'error', error: message }));
      };
      workerRef.current = worker;
    }
    return workerRef.current;
  }, [handleMessage]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    []
  );

  const startRun = useCallback(
    (key, payload) => {
      setRuns((current) => ({
        ...current,
        [key]: { ...EMPTY_RUN, status: 'running' },
      }));
      getWorker().postMessage({ type: 'run', key, payload });
    },
    [getWorker]
  );

  const cancelRun = useCallback(
    (key) => {
      getWorker().postMessage({ type: 'cancel', key });
    },
    [getWorker]
  );

  const startExact = useCallback(
    (payload) => {
      setExact({ ...EMPTY_EXACT, status: 'running', phase: 'matrix' });
      getWorker().postMessage({ type: 'exact', payload });
    },
    [getWorker]
  );

  const cancelExact = useCallback(() => getWorker().postMessage({ type: 'cancel' }), [getWorker]);

  const resetExact = useCallback(() => setExact(EMPTY_EXACT), []);

  const anyRunning =
    exact.status === 'running' ||
    runs.stationary.status === 'running' ||
    runs.independence.status === 'running';

  return { runs, exact, anyRunning, startRun, cancelRun, startExact, cancelExact, resetExact };
}
