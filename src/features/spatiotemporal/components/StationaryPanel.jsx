import { useMemo, useState } from 'react';
import { useStationary } from '../hooks/useStationary';
import HistogramChart from './HistogramChart';
import { binsFromHistogram } from '../../../shared/chart/svgExport';
import TimeSeriesChart from './TimeSeriesChart';
import { CONDITION_COLORS, POSITION_COLORS, colorOf } from './theme';
import { subscript } from '../domain/initialState';
import { round } from '../../../shared/math/stats';

const STEP_PRESETS = [10_000, 100_000, 1_000_000];

function formatInt(value) {
  return new Intl.NumberFormat('es-PE').format(value);
}

function ProgressBar({ progress, label }) {
  const pct = Math.round(progress * 100);
  return (
    <div className="progress">
      <div className="progress__track">
        <div className="progress__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="progress__label">{label ?? `${pct}%`}</span>
    </div>
  );
}

/**
 * Pestaña "Estacionaria": verificación empírica y exacta del Teorema.
 *
 *  1 · Histogramas de las marginales de π*  (T pasos, burn-in, semilla)
 *  2 · Tres cadenas con distinto π₀ → histogramas superpuestos + TV(t)
 *  3 · Cálculo exacto para n = 3: Ω, P, irreducibilidad, aperiodicidad, π*
 *
 * Todo el cómputo ocurre en un Web Worker (barra de progreso + cancelar).
 */
export default function StationaryPanel({ sketch, config, conditions, params, handlers }) {
  const { runs, exact, anyRunning, startRun, cancelRun, startExact, cancelExact } = useStationary();

  const [steps, setSteps] = useState(100_000);
  const [burnIn, setBurnIn] = useState(10_000);
  const [epsilon, setEpsilon] = useState(0.02);
  const [trackTop, setTrackTop] = useState(true);

  const topStride = Math.max(1, Math.ceil(steps / 100_000));
  const sketchConfig = {
    type: config.sketchType,
    size: config.sketchSize,
    colorCount: config.colorCount,
  };
  // Vértices de G (n) frente a posiciones de X (m): el worker los recibe por
  // separado, porque el cálculo exacto y el rango de |E| dependen de n, no de m.
  const vertexCount = config.g0?.positions?.length ?? sketch.size;

  const buildPayload = (selectedConditions) => ({
    sketchConfig,
    n: vertexCount,
    params,
    conditions: selectedConditions,
    steps,
    burnIn,
    seed: config.seed,
    checkpoints: 60,
    trackTop,
    topStride,
  });

  const singleRun = runs.stationary;
  const tripleRun = runs.independence;

  const exactEligible = vertexCount === 3 && sketch.size === 3 && sketch.colorCount <= 3;

  const runExact = () => {
    const empiricalCounts = singleRun.result?.chains?.[0]?.edges?.counts;
    startExact({
      sketchConfig,
      n: vertexCount,
      params,
      conditions,
      empiricalEdges: empiricalCounts,
      tvSteps: 120,
    });
  };

  // --- Series derivadas de los resultados ---------------------------------
  const singleChain = singleRun.result?.chains?.[0];

  const colorSeries = useMemo(() => {
    const source = singleChain ?? tripleRun.result?.chains?.[0];
    if (!source) return [];
    return source.colors.map((histogram, i) => ({
      label: `C${subscript(i)}`,
      color: colorOf(i),
      bins: binsFromHistogram(histogram),
    }));
  }, [singleChain, tripleRun.result]);

  const positionSeries = useMemo(() => {
    const source = singleChain ?? tripleRun.result?.chains?.[0];
    if (!source) return [];
    return source.positions.map((histogram, v) => ({
      label: `v${v}`,
      color: POSITION_COLORS[v % POSITION_COLORS.length],
      bins: binsFromHistogram(histogram),
    }));
  }, [singleChain, tripleRun.result]);

  const independenceSeries = useMemo(() => {
    if (!tripleRun.result) return [];
    return tripleRun.result.chains.map((chain, i) => ({
      label: chain.label.replace(/^π₀[^:]*:\s*/, ''),
      color: CONDITION_COLORS[i % CONDITION_COLORS.length],
      bins: binsFromHistogram(chain.edges),
    }));
  }, [tripleRun.result]);

  const tvResult = tripleRun.result;
  const tvStride = useMemo(() => {
    const marks = tvResult?.tv?.marks ?? [];
    return marks.length > 1 ? Math.max(1, Math.round((marks[1] - marks[0]) || 1)) : 1;
  }, [tvResult]);

  const tvSeries = useMemo(() => {
    if (!tvResult) return [];
    return [
      { label: 'TV · |E|', color: CONDITION_COLORS[0], values: tvResult.tv.edges },
      { label: 'TV · colores', color: CONDITION_COLORS[1], values: tvResult.tv.colors },
      { label: 'TV · posiciones', color: CONDITION_COLORS[2], values: tvResult.tv.positions },
    ];
  }, [tvResult]);

  const finalTv = tvResult?.tv?.max?.length
    ? tvResult.tv.max[tvResult.tv.max.length - 1]
    : null;
  const converged = finalTv !== null && finalTv < epsilon;

  const ergodic = singleChain?.series;
  const ergodicStride = ergodic && ergodic.t.length > 1 ? ergodic.t[1] - ergodic.t[0] : 1;

  const exactResult = exact.result;
  const empiricalForExact = singleChain?.edges;

  return (
    <div className="stationary">
      {/* ---------- Parámetros + disparadores ---------- */}
      <section className="stationary__bar">
        <label className="field field--inline" htmlFor="stat-steps">
          <span className="field__label">
            Pasos T <strong>{formatInt(steps)}</strong>
          </span>
          <input
            id="stat-steps"
            type="number"
            min={1000}
            step={1000}
            value={steps}
            onChange={(e) => setSteps(Math.max(1000, Number(e.target.value) || 1000))}
          />
        </label>

        <div className="stationary__presets" role="group" aria-label="Presets de T">
          {STEP_PRESETS.map((value) => (
            <button
              key={value}
              type="button"
              className={`stationary__preset${steps === value ? ' is-active' : ''}`}
              onClick={() => {
                setSteps(value);
                setBurnIn((b) => Math.min(b, Math.floor(value / 10)));
              }}
            >
              10^{Math.round(Math.log10(value))}
            </button>
          ))}
        </div>

        <label className="field field--inline" htmlFor="stat-burn">
          <span className="field__label">
            Burn-in B <strong>{formatInt(burnIn)}</strong>
          </span>
          <input
            id="stat-burn"
            type="number"
            min={0}
            step={1000}
            value={burnIn}
            onChange={(e) => setBurnIn(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>

        <label className="field field--inline" htmlFor="stat-eps">
          <span className="field__label">
            ε (TV) <strong>{epsilon.toFixed(3)}</strong>
          </span>
          <input
            id="stat-eps"
            type="number"
            min={0.001}
            max={0.5}
            step={0.005}
            value={epsilon}
            onChange={(e) => setEpsilon(Number(e.target.value) || 0.02)}
          />
        </label>

        <label className="field field--inline" htmlFor="stat-seed">
          <span className="field__label">
            Semilla <strong>{config.seed}</strong>
          </span>
          <input
            id="stat-seed"
            type="number"
            min={0}
            step={1}
            value={config.seed}
            onChange={(e) => handlers.onSeed(Number(e.target.value) || 0)}
          />
        </label>

        <label className="stationary__check">
          <input
            type="checkbox"
            checked={trackTop}
            onChange={(e) => setTrackTop(e.target.checked)}
          />
          Registrar estados más visitados
        </label>

        <div className="stationary__actions">
          <button
            className="button button--primary"
            type="button"
            disabled={anyRunning}
            onClick={() => startRun('stationary', buildPayload([conditions[0]]))}
          >
            ▶ Calcular π* (1 cadena)
          </button>
          <button
            className="button"
            type="button"
            disabled={anyRunning}
            onClick={() => startRun('independence', buildPayload(conditions))}
          >
            ▶ 3 cadenas con π₀ distinto
          </button>
          <button
            className="button"
            type="button"
            disabled={singleRun.status !== 'running' && tripleRun.status !== 'running'}
            onClick={() => {
              if (singleRun.status === 'running') cancelRun('stationary');
              if (tripleRun.status === 'running') cancelRun('independence');
            }}
          >
            ■ Cancelar
          </button>
        </div>
      </section>

      {(singleRun.status === 'running' || tripleRun.status === 'running') && (
        <section className="stationary__progress">
          <ProgressBar
            progress={singleRun.status === 'running' ? singleRun.progress : tripleRun.progress}
            label={`${
              singleRun.status === 'running'
                ? `π* · t = ${formatInt(singleRun.t)} / ${formatInt(steps)}`
                : `3 cadenas · t = ${formatInt(tripleRun.t)} / ${formatInt(steps)}`
            }`}
          />
        </section>
      )}

      {singleRun.error || tripleRun.error ? (
        <p className="stationary__error">{singleRun.error ?? tripleRun.error}</p>
      ) : null}

      {/* ---------- 1 · marginales de π* ---------- */}
      {singleChain ? (
        <section className="stationary__block">
          <header className="stationary__head">
            <h3>
              1 · Distribución estacionaria π* — X = {sketch.label}, m = {sketch.size}, n ={' '}
              {vertexCount}, (c+1) = {sketch.colorCount}, k = {params.k.toFixed(2)}, α ={' '}
              {params.alpha.toFixed(1)}
            </h3>
            <span className="stationary__meta">
              {formatInt(singleChain.samples)} muestras tras B = {formatInt(burnIn)} · semilla{' '}
              {config.seed}
            </span>
          </header>

          <div className="stationary__stats">
            <div className="stat">
              <span className="stat__label">⟨|E(G)|⟩ bajo π*</span>
              <span className="stat__value">
                {round(singleChain.meanEdges, 3)} ± {round(singleChain.stdEdges, 3)}
              </span>
            </div>
            <div className="stat">
              <span className="stat__label">Rango de |E|</span>
              <span className="stat__value">0 … {(vertexCount * (vertexCount - 1)) / 2}</span>
            </div>
            {singleChain.meanColorCounts.map((value, i) => (
              <div className="stat" key={`c-${i}`}>
                <span className="stat__label">
                  ⟨#vértices en C{subscript(i)}⟩
                </span>
                <span className="stat__value">
                  {round(value, 3)} ± {round(singleChain.stdColorCounts[i], 3)}
                </span>
              </div>
            ))}
            <div className="stat">
              <span className="stat__label">Ocupación por posición de X</span>
              <span className="stat__value">1 · 1 · … (p_t es biyectiva)</span>
            </div>
          </div>

          <div className="stationary__grid">
            <HistogramChart
              title="Histograma de |E(G_t)| bajo π*"
              subtitle={`Máximo teórico ${((vertexCount * (vertexCount - 1)) / 2)} aristas`}
              series={[
                {
                  label: 'π* empírica',
                  color: CONDITION_COLORS[0],
                  bins: binsFromHistogram(singleChain.edges),
                },
              ]}
              xLabel="número de aristas |E|"
              yLabel="probabilidad"
              exportName="pi-estacionaria-aristas"
              exportCsv={{
                header: ['aristas', 'probabilidad'],
                rows: singleChain.edges.xs.map((x, i) => [
                  x,
                  round(singleChain.edges.probs[i], 8),
                ]),
              }}
            />

            <HistogramChart
              title="Histograma del número de vértices por color"
              series={colorSeries}
              xLabel="número de vértices en el color"
              yLabel="probabilidad"
              exportName="pi-estacionaria-colores"
              exportCsv={{
                header: ['color', 'n_vertices', 'probabilidad'],
                rows: singleChain.colors.flatMap((histogram, i) =>
                  histogram.xs.map((x, k) => [i, x, round(histogram.probs[k], 8)])
                ),
              }}
            />

            <HistogramChart
              title="Posición de cada vértice en X"
              subtitle="P[p_t(v) = x] por vértice v (la ocupación por nodo es siempre 1: biyección)"
              series={positionSeries}
              xLabel="posición x de X"
              yLabel="probabilidad"
              exportName="pi-estacionaria-posiciones"
              exportCsv={{
                header: ['vertice', 'posicion', 'probabilidad'],
                rows: singleChain.positions.flatMap((histogram, v) =>
                  histogram.xs.map((x, k) => [v, x, round(histogram.probs[k], 8)])
                ),
              }}
            />
          </div>

          {ergodic && ergodic.t.length > 1 ? (
            <TimeSeriesChart
              title="Promedio ergódico acumulado de |E| vs t (convergencia a π*)"
              series={[
                {
                  label: '⟨|E|⟩ ergódico',
                  color: CONDITION_COLORS[0],
                  values: ergodic.mean,
                },
              ]}
              t0={ergodic.t[0]}
              stride={ergodicStride}
              integer
              yLabel="aristas"
              exportName="media-ergodica"
            />
          ) : null}

          {trackTop && singleChain.topStates.length > 0 ? (
            <details className="stationary__details">
              <summary>
                Estados más visitados (top {singleChain.topStates.length}, muestreo cada{' '}
                {topStride} pasos)
              </summary>
              <table className="stat-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>|E|</th>
                    <th>Colores</th>
                    <th>Posiciones</th>
                    <th>Visitas</th>
                    <th>P(S)</th>
                  </tr>
                </thead>
                <tbody>
                  {singleChain.topStates.map((state, index) => (
                    <tr key={state.key}>
                      <td>{index + 1}</td>
                      <td>{state.edgeCount}</td>
                      <td>{state.colors.join('')}</td>
                      <td>{state.positions.join('')}</td>
                      <td>{formatInt(state.count)}</td>
                      <td>{(state.probability * 100).toFixed(3)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ) : null}
        </section>
      ) : (
        <p className="stationary__hint">
          Ejecuta <strong>Calcular π*</strong> para obtener los histogramas estacionarios.
        </p>
      )}

      {/* ---------- 2 · independencia de π₀ ---------- */}
      <section className="stationary__block">
        <header className="stationary__head">
          <h3>2 · Invariancia frente a π₀ — tres cadenas, el mismo modelo</h3>
          {finalTv !== null ? (
            <span className={`stationary__badge ${converged ? 'is-ok' : 'is-warn'}`}>
              {converged
                ? `✓ convergió · TV final ${finalTv.toFixed(4)} < ε = ${epsilon.toFixed(3)}`
                : `✗ TV final ${finalTv.toFixed(4)} ≥ ε = ${epsilon.toFixed(3)}`}
            </span>
          ) : null}
        </header>

        {conditions.map((condition, i) => (
          <div className="stationary__condition" key={condition.id}>
            <i style={{ background: CONDITION_COLORS[i % CONDITION_COLORS.length] }} />
            <span>{condition.label}</span>
            <em>
              {condition.graphPreset === 'empty'
                ? 'grafo vacío K̄ₙ'
                : condition.graphPreset === 'star'
                  ? 'estrella K₁,ₙ₋₁'
                  : 'completo Kₙ'}
            </em>
          </div>
        ))}

        {config.colorCount < 3 ? (
          <p className="stationary__warn">
            Aviso: con (c+1) = {config.colorCount}, menor que 3, no existen los tres colores C₁,
            C₂ y C₀ del póster; las condiciones se adaptan a los colores disponibles.
          </p>
        ) : null}

        {tripleRun.result ? (
          <>
            <div className="stationary__grid">
              <HistogramChart
                title="Histogramas de |E| superpuestos (las 3 cadenas)"
                series={independenceSeries}
                xLabel="número de aristas |E|"
                yLabel="probabilidad"
                exportName="invariancia-aristas"
                exportCsv={{
                  header: ['cadena', 'aristas', 'probabilidad'],
                  rows: tripleRun.result.chains.flatMap((chain) =>
                    chain.edges.xs.map((x, k) => [
                      chain.label,
                      x,
                      round(chain.edges.probs[k], 8),
                    ])
                  ),
                }}
              />

              <div className="stationary__panel">
                <table className="stat-table">
                  <thead>
                    <tr>
                      <th>Cadena</th>
                      <th>⟨|E|⟩ ± σ</th>
                      <th>muestras</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tripleRun.result.chains.map((chain, i) => (
                      <tr key={chain.id}>
                        <td>
                          <i
                            className="dot"
                            style={{ background: CONDITION_COLORS[i % CONDITION_COLORS.length] }}
                          />
                        </td>
                        <td>
                          {round(chain.meanEdges, 3)} ± {round(chain.stdEdges, 3)}
                        </td>
                        <td>{formatInt(chain.samples)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="stationary__stats stationary__stats--tight">
                  {tripleRun.result.chains.map((chain) => (
                    <div className="stat" key={`col-${chain.id}`}>
                      <span className="stat__label">
                        {chain.label.replace(/^π₀[^:]*:\s*/, '')} · colores
                      </span>
                      <span className="stat__value">
                        {chain.meanColorCounts.map((v) => round(v, 2)).join(' · ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <TimeSeriesChart
              title="Distancia de variación total entre cadenas vs t"
              subtitle={`TV entre histogramas (máximo de los ${tripleRun.result.tv.pairCount} pares) · ε = ${epsilon.toFixed(3)}`}
              series={tvSeries}
              t0={tripleRun.result.tv.marks[0] ?? burnIn}
              stride={tvStride}
              yDomain={[0, Math.max(0.05, Math.ceil(Math.max(...(tvResult.tv.max.length ? tvResult.tv.max : [0.05])) * 20) / 20)]}
              yLabel="TV"
              exportName="tv-entre-cadenas"
            />
          </>
        ) : tripleRun.status === 'running' ? (
          <ProgressBar progress={tripleRun.progress} />
        ) : (
          <p className="stationary__hint">
            Ejecuta <strong>3 cadenas con π₀ distinto</strong> para ver la curva TV decreciente y
            la superposición de histogramas.
          </p>
        )}
      </section>

      {/* ---------- 3 · cálculo exacto ---------- */}
      <section className="stationary__block">
        <header className="stationary__head">
          <h3>3 · Cálculo exacto para n = 3 (π* por iteración de potencia)</h3>
          <div className="stationary__actions">
            {!exactEligible ? (
              <button
                className="button"
                type="button"
                disabled={anyRunning}
                onClick={() =>
                  handlers.onExactParams({
                    sketchType: 'path',
                    sketchSize: 3,
                    colorCount: Math.min(3, config.colorCount),
                  })
                }
              >
                Fijar X = P₃, n = 3
              </button>
            ) : null}
            <button
              className="button button--primary"
              type="button"
              disabled={anyRunning || !exactEligible}
              onClick={runExact}
            >
              ▶ Calcular π* exacta
            </button>
            <button
              className="button"
              type="button"
              disabled={exact.status !== 'running'}
              onClick={cancelExact}
            >
              ■ Cancelar
            </button>
          </div>
        </header>

        {!exactEligible ? (
          <p className="stationary__warn">
            El cálculo exacto requiere n = 3 y (c+1) ≤ 3: con n = 4, |Ω| = 124 416 estados y
            construir P exigiría ~5·10¹⁰ operaciones, no es viable en el navegador. Pulsa
            <strong> Fijar X = P₃, n = 3</strong> para aplicar esos parámetros.
          </p>
        ) : null}

        {exact.status === 'running' ? (
          <ProgressBar
            progress={exact.progress}
            label={
              exact.phase === 'matrix'
                ? `Construyendo P… ${Math.round(exact.progress * 100)}%`
                : exact.phase === 'checks'
                  ? 'Verificando irreducibilidad y aperiodicidad…'
                  : `Iteración de potencia · ${formatInt(exact.iterations ?? 0)} iteraciones, Δ = ${
                      exact.delta ? exact.delta.toExponential(2) : '—'
                    }`
            }
          />
        ) : null}

        {exact.error ? <p className="stationary__error">{exact.error}</p> : null}

        {exactResult ? (
          <>
            <div className="stationary__stats">
              <div className="stat">
                <span className="stat__label">|Ω|</span>
                <span className="stat__value">{formatInt(exactResult.size)} estados</span>
              </div>
              <div className="stat">
                <span className="stat__label">Matriz P</span>
                <span className="stat__value">
                  {formatInt(exactResult.size)}² · {(exactResult.matrixBytes / 1048576).toFixed(1)} MB
                </span>
              </div>
              <div className="stat">
                <span className="stat__label">Irreducible</span>
                <span className={`stat__value ${exactResult.irreducible.ok ? 'is-ok' : 'is-bad'}`}>
                  {exactResult.irreducible.ok
                    ? `✓ (${exactResult.irreducible.reached}/${exactResult.irreducible.size} alcanzables)`
                    : `✗ (${exactResult.irreducible.reached}/${exactResult.irreducible.size})`}
                </span>
              </div>
              <div className="stat">
                <span className="stat__label">Aperiódica</span>
                <span className={`stat__value ${exactResult.aperiodic.ok ? 'is-ok' : 'is-bad'}`}>
                  {exactResult.aperiodic.ok
                    ? `✓ max P(S,S) = ${exactResult.aperiodic.maxSelfLoop.toFixed(4)}`
                    : '✗ sin lazos'}
                </span>
              </div>
              <div className="stat">
                <span className="stat__label">Método</span>
                <span className="stat__value">
                  {exactResult.method === 'power'
                    ? `iteración de potencia (${formatInt(exactResult.iterations)} its.)`
                    : 'sistema π·P = π (eliminación de Gauss)'}
                </span>
              </div>
              <div className="stat">
                <span className="stat__label">Residuo ‖πP − π‖₁</span>
                <span className="stat__value">{exactResult.residual.toExponential(2)}</span>
              </div>
              {exactResult.comparison !== null ? (
                <div className="stat">
                  <span className="stat__label">TV(π* empírica, π* exacta)</span>
                  <span
                    className={`stat__value ${
                      exactResult.comparison < 0.02 ? 'is-ok' : 'is-warn'
                    }`}
                  >
                    {exactResult.comparison.toFixed(5)}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="stationary__grid">
              <HistogramChart
                title="π* exacta vs π* empírica — |E|"
                subtitle={`n = 3, X = ${sketch.label}, k = ${params.k.toFixed(2)}, α = ${params.alpha.toFixed(1)}`}
                series={[
                  ...(empiricalForExact
                    ? [
                        {
                          label: 'Empírica',
                          color: CONDITION_COLORS[0],
                          bins: binsFromHistogram(empiricalForExact),
                        },
                      ]
                    : []),
                  {
                    label: 'Exacta π*',
                    color: CONDITION_COLORS[2],
                    bins: exactResult.marginals.edges
                      .map((p, x) => ({ x, p }))
                      .filter((bin) => bin.p > 0),
                  },
                ]}
                xLabel="número de aristas |E|"
                yLabel="probabilidad"
                exportName="pi-exacta-vs-empirica"
                exportCsv={{
                  header: ['aristas', 'empirica', 'exacta'],
                  rows: exactResult.marginals.edges.map((p, x) => [
                    x,
                    empiricalForExact ? round(empiricalForExact.probs[x] ?? 0, 8) : '',
                    round(p, 8),
                  ]),
                }}
              />

              <HistogramChart
                title="π* exacta — número de vértices por color"
                series={exactResult.marginals.colors.map((values, i) => ({
                  label: `C${subscript(i)}`,
                  color: colorOf(i),
                  bins: values
                    .map((p, x) => ({ x, p }))
                    .filter((bin) => bin.p > 0),
                }))}
                xLabel="número de vértices en el color"
                yLabel="probabilidad"
                exportName="pi-exacta-colores"
                exportCsv={{
                  header: ['color', 'n_vertices', 'probabilidad'],
                  rows: exactResult.marginals.colors.flatMap((values, i) =>
                    values.map((p, x) => [i, x, round(p, 8)])
                  ),
                }}
              />
            </div>

            <TimeSeriesChart
              title="TV(π₀ · Pᵗ, π*) vs t para π₀⁽¹⁾"
              subtitle="Convergencia exacta a la distribución estacionaria única"
              series={[
                {
                  label: 'TV(π₀Pᵗ, π*)',
                  color: CONDITION_COLORS[0],
                  values: exactResult.tvCurve,
                },
              ]}
              t0={0}
              stride={1}
              yDomain={[0, 1]}
              yLabel="TV"
              exportName="tv-exacta"
            />
          </>
        ) : exact.status === 'idle' && exactEligible ? (
          <p className="stationary__hint">
            Se enumera Ω = 2^3 · (c+1)³ · 3! = {formatInt(8 * config.colorCount ** 3 * 6)} estados,
            se construye P reutilizando los kernels del modelo y se resuelve π·P = π.
          </p>
        ) : null}
      </section>
    </div>
  );
}
