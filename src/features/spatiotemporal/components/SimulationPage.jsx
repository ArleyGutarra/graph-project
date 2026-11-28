import { useEffect, useMemo, useRef, useState } from 'react';
import { createInitialState, subscript } from '../domain/initialState';
import { displayedState } from '../domain/stepDetail';
import { createRng } from '../../../shared/math/rng';
import { useSimulation } from '../hooks/useSimulation';
import { checkHypotheses } from '../domain/hypotheses';
import { SKETCH_TYPES } from '../domain/sketch';
import ControlPanel from './ControlPanel';
import PlaybackBar from './PlaybackBar';
import GraphStage from './GraphStage';
import StationaryPanel from './StationaryPanel';
import { buildLayout } from './stageLayout';
import InspectorPanel from './InspectorPanel';
import TimeSeriesChart from './TimeSeriesChart';
import { colorOf, CONDITION_COLORS } from './theme';
import './simulation.css';
import './panel.css';
import './shell.css';
import './widgets.css';

const MODES = [
  { id: 'editor', label: '1. Configurar escenario (X, G₀)' },
  { id: 'simulation', label: '2. Simular y analizar' },
];

/** Ancho por defecto de la columna del Inspector (px). */
const DEFAULT_INSPECTOR_WIDTH = 380;

/** Por debajo de este umbral el arrastre cierra la columna. */
const INSPECTOR_CLOSE_AT = 150;

/** Tamaño máximo del croquis X (coincide con el deslizador "Tamaño de X"). */
const MAX_SKETCH_SIZE = 8;

const TOOLS = [
  { id: 'move', label: '✥ Mover' },
  { id: 'addNode', label: '+ Nodo' },
  { id: 'edge', label: '☍ Arista' },
  { id: 'paint', label: '✎ Pintar' },
  { id: 'delete', label: '✕ Borrar' },
];

const HINTS = {
  move:
    'Modo {layer} · Mantén el clic izquierdo y arrastra un nodo para colocarlo donde quieras: ' +
    'se mueve junto a su posición xᵢ (desde el croquis arrastras el xᵢ directamente). ' +
    'Con Shift lo sueltas sobre la xⱼ más cercana y reasignas p₀(vᵢ).',
  addNode: 'Modo {layer} · Haz clic en una posición libre del croquis para añadir un vértice a G₀.',
  edge: 'Modo {layer} · Haz clic en vᵢ y después en vⱼ para (des)conectar la arista {vᵢ, vⱼ}.',
  paint: 'Modo {layer} · Elige un color abajo y haz clic en un vértice para pintarlo.',
  delete: 'Modo {layer} · Haz clic en una arista para borrarla, o en un vértice para eliminarlo.',
};

function edgesOf(adj, n) {
  const edges = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) if (adj[i] & (1 << j)) edges.push([i, j]);
  }
  return edges;
}

/**
 * Página de simulación del modelo del póster.
 *
 * Estructura de presentación tomada de la maqueta `simulador-cimm-uni`:
 *
 *   cabecera  → marca + stepper (1 Configurar → 2 Simular) + acción
 *   vista 1   → CAPA ACTIVA (Grafo G₀ / Croquis X) + preset X + lienzo con
 *               las 5 herramientas, swatches y controles del mapa ·
 *               CONFIGURACIÓN INICIAL Y PARÁMETROS (3 tarjetas)
 *   vista 2   → chips (t, t⁻/t⁺, |E|) + visor + leyenda + transporte ·
 *               PANEL DE ANÁLISIS con pestañas (Gráficas / Estacionaria /
 *               Inspector de paso t) y tarjeta de estimación de π*
 *
 * Se conserva íntegro el diseño futurista: tema oscuro con acentos carmesí,
 * tipografía monoespaciada, tarjetas translúcidas y el fondo animado
 * `.step__bg` + `GraphBackdrop`.
 */
export default function SimulationPage() {
  const sim = useSimulation();
  const { config, chain, sketch, conditions } = sim;

  const [mode, setMode] = useState('editor');
  const [view, setView] = useState('graph');
  // Columna del Inspector de paso t: anchura en px (0 = cerrada). Se abre y
  // cierra arrastrando el divisor "↔" (o con doble clic / teclado sobre él).
  const [inspectorWidth, setInspectorWidth] = useState(DEFAULT_INSPECTOR_WIDTH);
  const analysisRef = useRef(null);
  const resizeRef = useRef(null); // pointerId durante el arrastre del divisor
  const [selected, setSelected] = useState(null);
  const [tool, setTool] = useState('move');
  const [paintColor, setPaintColor] = useState(1);

  const t = chain.t;
  const points = chain.history.points;

  // --- Estado inicial G₀ (lo que se edita en la vista 1) --------------------
  const editorState = useMemo(() => {
    const rng = createRng(config.seed);
    return createInitialState(
      {
        n: config.g0?.positions?.length ?? sketch.size,
        m: sketch.size,
        colorCount: sketch.colorCount,
        graphPreset: config.g0 ? 'custom' : config.graphPreset,
        colorPreset: config.g0 ? 'custom' : config.colorPreset,
        positionPreset: config.g0 ? 'custom' : config.positionPreset,
        custom: config.g0,
      },
      rng
    );
  }, [
    config.g0,
    config.graphPreset,
    config.colorPreset,
    config.positionPreset,
    config.seed,
    sketch,
  ]);

  const snapshotG0 = () => ({
    edges: edgesOf(editorState.adj, editorState.n),
    colors: Array.from(editorState.color),
    positions: Array.from(editorState.pos),
    // Nombre visible de cada vértice (sólo presentacional; el índice sigue
    // siendo la identidad usada por las aristas y por el Inspector).
    labels: Array.from(
      { length: editorState.n },
      (_, i) => config.g0?.labels?.[i] ?? String(i)
    ),
  });

  // Estado que se dibuja: G₀ en la vista 1, el micro-paso t⁻/t⁺ en la vista 2.
  // Es la MISMA función que usa GraphStage, así que la etiqueta |E(G)| y el
  // lienzo nunca se contradicen.
  const displayed =
    mode === 'editor'
      ? editorState
      : displayedState({
          state: chain.state,
          previous: chain.previous,
          detail: chain.detail,
          subphase: config.subphase,
        });
  const shownEdges = edgesOf(displayed.adj, displayed.n).length;

  // Posiciones de X todavía sin ocupar: limitan al botón "+" y al teclado.
  const occupied = new Set(displayed.pos);
  let freeSlots = 0;
  for (let i = 0; i < sketch.size; i++) if (!occupied.has(i)) freeSlots += 1;

  const commitG0 = (next, patch = {}) =>
    applyGraphChange({
      g0: next,
      graphPreset: 'custom',
      colorPreset: 'custom',
      positionPreset: 'custom',
      ...patch,
    });

  // --- Historial de ediciones del grafo (Ctrl+Z / Ctrl+Y) -------------------
  // Cada modificación de G₀ o de X empuja una instantánea de la configuración
  // del grafo; Deshacer la restaura y Rehacer vuelve a aplicarla.
  const [history, setHistory] = useState({ past: [], future: [] });

  const graphSnapshot = () => ({
    g0: config.g0,
    graphPreset: config.graphPreset,
    colorPreset: config.colorPreset,
    positionPreset: config.positionPreset,
    sketchType: config.sketchType,
    sketchSize: config.sketchSize,
    layout: config.layout,
  });

  const applyGraphChange = (patch) => {
    setHistory((h) => ({
      past: [...h.past, graphSnapshot()].slice(-200),
      future: [],
    }));
    sim.setModelParam(patch);
  };

  const undo = () => {
    if (!history.past.length) return;
    const previous = history.past[history.past.length - 1];
    setHistory({
      past: history.past.slice(0, -1),
      future: [graphSnapshot(), ...history.future].slice(0, 200),
    });
    sim.setModelParam(previous);
  };

  const redo = () => {
    if (!history.future.length) return;
    const next = history.future[0];
    setHistory({
      past: [...history.past, graphSnapshot()].slice(-200),
      future: history.future.slice(1),
    });
    sim.setModelParam(next);
  };

  // --- Herramientas del lienzo ---------------------------------------------
  const handleDrop = (vertex, target) => {
    const g0 = snapshotG0();
    g0.positions[vertex] = target;
    commitG0(g0);
  };

  const addVertex = (target) => {
    const g0 = snapshotG0();
    const used = new Set(g0.positions);

    // Posiciones libres de X: el que se pulsó si está libre, o la primera.
    let free = Number.isInteger(target) && !used.has(target) ? target : -1;
    if (free < 0) {
      free = 0;
      while (used.has(free) && free < sketch.size) free += 1;
    }

    // Si X está llena se agranda el croquis (m → m+1) en vez de compartir la
    // misma posición. Es el ÚNICO caso en que el anillo se reubica: BORRAR
    // nunca toca X, así que al quitar vértices el dibujo se queda como está.
    let patch = null;
    if (free >= sketch.size) {
      if (sketch.size >= MAX_SKETCH_SIZE) return;
      free = sketch.size; // la posición recién creada
      patch = { sketchSize: sketch.size + 1 };
    }

    g0.positions.push(free);
    g0.colors.push(g0.colors.length % config.colorCount);
    g0.labels.push(String(g0.labels.length));
    applyGraphChange({ g0, ...(patch ?? {}) });
  };

  const handleBackground = (target) => {
    if (tool !== 'addNode') return;
    addVertex(target);
  };

  /**
   * Arrastre libre: se mueven las coordenadas de la posición xᵢ, no su índice.
   * Es un parámetro de DIBUJO (no afecta a la cadena), pero se registra en el
   * historial para que Ctrl+Z lo deshaga como cualquier otra edición.
   */
  const handleMovePosition = (index, point) => {
    const next = buildLayout(sketch.size, config.layout).map((p) => ({ ...p }));
    next[index] = point;
    applyGraphChange({ layout: next });
  };

  const renameVertex = (vertex, name) => {
    const g0 = snapshotG0();
    g0.labels[vertex] = name;
    commitG0(g0);
  };

  const handleNodeAction = (vertex, action) => {
    const g0 = snapshotG0();

    if (action === 'paint') {
      g0.colors[vertex] = paintColor;
      commitG0(g0);
      return;
    }

    if (action === 'delete') {
      // n y m son independientes: se quita el vértice pero X conserva todas
      // sus posiciones, así que NADA del dibujo se mueve (ni el anillo, ni la
      // posición de los demás vértices). Los índices se recomprimen, pero los
      // nombres visibles van en `labels` y no cambian.
      if (g0.colors.length <= 2) return;

      const positions = g0.positions.filter((_, i) => i !== vertex);
      const colors = g0.colors.filter((_, i) => i !== vertex);
      const edges = g0.edges
        .filter(([a, b]) => a !== vertex && b !== vertex)
        .map(([a, b]) => [a > vertex ? a - 1 : a, b > vertex ? b - 1 : b]);

      applyGraphChange({
        g0: { edges, colors, positions, labels: g0.labels.filter((_, i) => i !== vertex) },
      });
    }
  };

  const handleEdgeAction = (a, b, action) => {
    const g0 = snapshotG0();
    const key = [Math.min(a, b), Math.max(a, b)];
    const index = g0.edges.findIndex(([x, y]) => x === key[0] && y === key[1]);

    if (action === 'delete') {
      if (index >= 0) g0.edges.splice(index, 1);
    } else if (index >= 0) {
      g0.edges.splice(index, 1);
    } else {
      g0.edges.push(key);
    }
    commitG0(g0);
  };

  // --- Atajos de teclado de la vista 1 (Grafo inicial) ----------------------
  //   Supr / Retroceso → quita el vértice seleccionado
  //   + (o =)          → añade un vértice en la primera posición libre
  //   Ctrl+Z / Ctrl+Y  → deshacer / rehacer las modificaciones del grafo
  // Se ignoran cuando el foco está en un campo de texto (renombrado incluido).
  const shortcutRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    shortcutRef.current = {
      mode,
      selected,
      add: addVertex,
      remove: (vertex) => handleNodeAction(vertex, 'delete'),
      undo,
      redo,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
    };
  });

  useEffect(() => {
    const handler = (event) => {
      const context = shortcutRef.current;
      if (!context || context.mode !== 'editor') return;

      // El componente sigue montado mientras navegas por la portada o los
      // fundamentos (el paso sólo queda `hidden`): no se actúa allí.
      if (rootRef.current?.closest('[hidden]')) return;

      const target = event.target;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'SELECT' ||
        tag === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }
      const mod = event.ctrlKey || event.metaKey;
      if (mod && (event.key === 'z' || event.key === 'Z')) {
        event.preventDefault();
        if (event.shiftKey) context.redo();
        else context.undo();
        return;
      }
      if (mod && (event.key === 'y' || event.key === 'Y')) {
        event.preventDefault();
        context.redo();
        return;
      }
      if (mod || event.altKey) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (context.selected === null || context.selected === undefined) return;
        event.preventDefault();
        context.remove(context.selected);
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        context.add(null);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const identityPositions = () => {
    const g0 = snapshotG0();
    g0.positions = Array.from({ length: editorState.n }, (_, i) => i);
    commitG0(g0, { positionPreset: 'identity' });
  };

  const applyTopology = (id) => {
    const rng = createRng(config.seed);
    const probe = createInitialState(
      {
        n: sketch.size,
        m: sketch.size,
        colorCount: sketch.colorCount,
        graphPreset: id,
        colorPreset: 'unanimous0',
        positionPreset: 'identity',
      },
      rng
    );
    const g0 = snapshotG0();
    g0.edges = edgesOf(probe.adj, probe.n);
    commitG0(g0, { graphPreset: id });
  };

  const applyColors = (id) => {
    const rng = createRng(config.seed);
    const probe = createInitialState(
      {
        n: sketch.size,
        m: sketch.size,
        colorCount: sketch.colorCount,
        graphPreset: 'empty',
        colorPreset: id,
        positionPreset: 'identity',
      },
      rng
    );
    const g0 = snapshotG0();
    g0.colors = Array.from(probe.color);
    commitG0(g0, { colorPreset: id });
  };

  // --- Ventana temporal / zoom ---------------------------------------------
  const windowSteps = config.windowSteps ?? 0;
  const visible =
    windowSteps > 0 && points.length
      ? points.filter((point) => point.t >= points[points.length - 1].t - windowSteps)
      : points;
  const t0 = visible.length ? visible[0].t : 0;

  const zoom = (direction) => {
    const span = visible.length ? visible[visible.length - 1].t - visible[0].t : 100;
    const next =
      direction > 0
        ? Math.max(20, Math.round(span / 1.5))
        : Math.min(5000, Math.round(span * 1.5));
    sim.setViewParam({ windowSteps: next });
  };

  const edgeSeries = [
    { label: '|E(G_t)|', color: CONDITION_COLORS[0], values: visible.map((p) => p.edges) },
  ];

  const fractionSeries = Array.from({ length: sketch.colorCount }, (_, i) => ({
    label: `C${subscript(i)}`,
    color: colorOf(i),
    values: visible.map((p) => p.colorFractions[i]),
  }));

  // --- Estimación empírica de π* (segunda mitad de la trayectoria) ---------
  const estimate = (() => {
    if (points.length < 2) return null;
    const slice = points.slice(Math.floor(points.length / 2));
    if (!slice.length) return null;
    const meanEdges = slice.reduce((acc, p) => acc + p.edges, 0) / slice.length;
    const meanColors = Array.from({ length: sketch.colorCount }, (_, i) =>
      slice.reduce((acc, p) => acc + p.colorFractions[i], 0) / slice.length
    );
    return { meanEdges, meanColors, from: slice[0].t, to: slice[slice.length - 1].t };
  })();

  const hypotheses = checkHypotheses({
    sketch,
    k: config.k,
    alpha: config.alpha,
    n: sim.vertexCount,
  });

  const inspectorOpen = inspectorWidth > 0;

  /** Reabre la columna si está cerrada (p. ej. al pulsar un vértice). */
  const openInspector = () =>
    setInspectorWidth((w) => (w > 0 ? w : DEFAULT_INSPECTOR_WIDTH));

  const clampInspector = (next, containerWidth) => {
    if (!Number.isFinite(next) || next < INSPECTOR_CLOSE_AT) return 0;
    const max = Math.max(300, containerWidth - 340);
    return Math.min(Math.max(next, 300), max);
  };

  const startResize = (event) => {
    event.preventDefault();
    resizeRef.current = event.pointerId;
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      /* sin captura de puntero (jsdom): el arrastre sigue funcionando */
    }
  };

  const onResizeMove = (event) => {
    if (resizeRef.current === null || !analysisRef.current) return;
    const rect = analysisRef.current.getBoundingClientRect();
    if (!rect.width) return;
    // Distancia del cursor al borde derecho del panel = ancho del Inspector.
    setInspectorWidth(clampInspector(rect.right - event.clientX, rect.width));
  };

  const endResize = (event) => {
    if (resizeRef.current === null) return;
    resizeRef.current = null;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      /* idempotente */
    }
  };

  const toggleInspector = () =>
    setInspectorWidth((w) => (w > 0 ? 0 : DEFAULT_INSPECTOR_WIDTH));

  const onSplitterKey = (event) => {
    const width = analysisRef.current?.getBoundingClientRect().width || 900;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? -24 : 24;
      setInspectorWidth((w) => clampInspector((w || 300) + delta, width));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setInspectorWidth(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setInspectorWidth(DEFAULT_INSPECTOR_WIDTH);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleInspector();
    }
  };

  const generateRun = () => {
    sim.reset();
    setMode('simulation');
    if (!sim.playing) sim.togglePlay();
  };

  const openEditor = () => {
    setMode('editor');
    sim.stop();
  };

  const layerLabel = view === 'croquis' ? 'Croquis X (Mapa)' : 'Grafo inicial G₀';

  return (
    <main
      className={`simulation${mode === 'simulation' && inspectorOpen ? ' has-inspector' : ''}`}
      ref={rootRef}
    >
      {/* ---------- Cabecera global ---------- */}
      <header className="sim-header cell--header">
        <div className="brand">
          <span className="brand__badge">UNI</span>
          <div className="brand__text">
            <h1>Ergodicidad y convergencia en redes espacio-temporales</h1>
            <p>VI CIMM-UNI 2026 · Facultad de Ciencias · Escuela Profesional de Matemática</p>
          </div>
        </div>

        <nav className="stepper" aria-label="Flujo de trabajo">
          {MODES.map((item, index) => (
            <span className="stepper__group" key={item.id}>
              {index > 0 ? <span className="stepper__arrow">→</span> : null}
              <button
                type="button"
                className={`stepper__button${mode === item.id ? ' is-active' : ''}`}
                aria-pressed={mode === item.id}
                onClick={() => (item.id === 'editor' ? openEditor() : setMode('simulation'))}
              >
                {item.label}
              </button>
            </span>
          ))}
        </nav>

        <div className="sim-header__actions">
          {!hypotheses.ok ? (
            <span className="sim-header__alert" title="Revisa las hipótesis en la tarjeta 3">
              ✗ hipótesis violadas
            </span>
          ) : null}
          <button className="button button--primary" type="button" onClick={generateRun}>
            ▶ Generar trayectoria
          </button>
        </div>
      </header>

      {/* ---------- Escenario ---------- */}
      <section className="simulation__stage cell--stage">
        {mode === 'editor' ? (
          <>
            <div className="panel__head">
              <div className="panel__head-left">
                <span className="panel__title">Capa activa</span>
                <div className="stage__view" role="group" aria-label="Capa activa">
                  {['croquis', 'graph'].map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`stage__view-button${view === id ? ' is-active' : ''}`}
                      aria-pressed={view === id}
                      onClick={() => setView(id)}
                    >
                      {id === 'croquis' ? 'Croquis X (Mapa)' : 'Grafo Inicial G₀'}
                    </button>
                  ))}
                </div>
              </div>

              <label className="panel__preset" htmlFor="preset-x">
                <span>Preset X:</span>
                <select
                  id="preset-x"
                  value={config.sketchType}
                  onChange={(event) => {
                    const type = event.target.value;
                    const spec = SKETCH_TYPES.find((s) => s.id === type);
                    applyGraphChange({
                      sketchType: type,
                      sketchSize: Math.max(config.sketchSize, spec.minSize),
                      g0: null,
                    });
                  }}
                >
                  {SKETCH_TYPES.map((spec) => (
                    <option key={spec.id} value={spec.id}>
                      {spec.label}
                      {spec.id === 'cycle' ? ' (UNI)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <GraphStage
              state={editorState}
              sketch={sketch}
              t={0}
              view={view}
              mode="editor"
              tool={tool}
              selected={selected}
              onSelect={setSelected}
              onNodeAction={handleNodeAction}
              onEdgeAction={handleEdgeAction}
              onDrop={handleDrop}
              onBackground={handleBackground}
              onViewChange={setView}
              labels={config.g0?.labels}
              onRename={renameVertex}
              layout={config.layout}
              onMovePosition={handleMovePosition}
              mapSrc={config.mapSrc}
              mapOpacity={config.mapOpacity ?? 0.9}
              mapEnabled={config.mapEnabled !== false}
            />

            <p className="stage__hint">{HINTS[tool].replace('{layer}', layerLabel)}</p>
            <p className="stage__hint">
              <span className="stage__shortcuts">
                arrastra = mover xᵢ libre · Shift + arrastra = reasignar p₀(vᵢ) · doble clic =
                renombrar · Supr = quitar · + = añadir (
                {freeSlots > 0 ? `${freeSlots} posiciones libres en X` : 'X al tope: m crecerá'}
                ) · Ctrl+Z / Ctrl+Y = deshacer / rehacer
              </span>
            </p>

            {/* Herramientas */}
            <div className="toolbar">
              <div className="toolbar__group" role="group" aria-label="Herramientas">
                {TOOLS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`toolbar__button${tool === item.id ? ' is-active' : ''}`}
                    aria-pressed={tool === item.id}
                    onClick={() => setTool(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="toolbar__group" role="group" aria-label="Historial de ediciones">
                <button
                  className="toolbar__button"
                  type="button"
                  onClick={undo}
                  disabled={!history.past.length}
                  title="Deshacer (Ctrl+Z)"
                >
                  ↶ Deshacer
                </button>
                <button
                  className="toolbar__button"
                  type="button"
                  onClick={redo}
                  disabled={!history.future.length}
                  title="Rehacer (Ctrl+Y)"
                >
                  ↷ Rehacer
                </button>
              </div>

              {tool === 'paint' ? (
                <div className="toolbar__swatches" role="group" aria-label="Color a pintar">
                  {Array.from({ length: sketch.colorCount }, (_, i) => (
                    <button
                      key={`sw-${i}`}
                      type="button"
                      className={`swatch${paintColor === i ? ' is-active' : ''}`}
                      aria-pressed={paintColor === i}
                      onClick={() => setPaintColor(i)}
                    >
                      <i style={{ background: colorOf(i) }} />
                      C{subscript(i)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Controles del mapa */}
            <div className="toolbar toolbar--map">
              <label className="playback__option">
                <input
                  type="checkbox"
                  checked={config.mapEnabled !== false}
                  onChange={(event) => sim.setViewParam({ mapEnabled: event.target.checked })}
                />
                Mapa UNI de fondo
              </label>

              <input
                className="toolbar__opacity"
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={config.mapOpacity ?? 0.9}
                onChange={(event) => sim.setViewParam({ mapOpacity: Number(event.target.value) })}
                aria-label="Opacidad del mapa"
              />

              <label className="toolbar__upload">
                Subir mapa propio (.png/.jpg)
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) sim.setViewParam({ mapSrc: URL.createObjectURL(file) });
                  }}
                />
              </label>
            </div>
          </>
        ) : (
          <>
            <div className="panel__head">
              <div className="panel__head-left chips">
                <span className="chip mono">
                  t = <strong>{t}</strong> / {Math.max(chain.maxT, config.fastSteps)}
                </span>

                <div className="stage__view" role="group" aria-label="Micro-paso">
                  <button
                    type="button"
                    className={`stage__view-button${config.subphase !== 'plus' ? ' is-active' : ''}`}
                    aria-pressed={config.subphase !== 'plus'}
                    onClick={() => sim.setViewParam({ subphase: 'minus' })}
                  >
                    t⁻ Desplazamiento
                  </button>
                  <button
                    type="button"
                    className={`stage__view-button${config.subphase === 'plus' ? ' is-active' : ''}`}
                    aria-pressed={config.subphase === 'plus'}
                    onClick={() => sim.setViewParam({ subphase: 'plus' })}
                  >
                    t⁺ Actualización
                  </button>
                </div>

                <span className="chip mono">
                  |E(G)| = <strong>{shownEdges}</strong>
                </span>
              </div>

              <div className="stage__view" role="group" aria-label="Vista del escenario">
                {['graph', 'croquis'].map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`stage__view-button${view === id ? ' is-active' : ''}`}
                    aria-pressed={view === id}
                    onClick={() => setView(id)}
                  >
                    {id === 'graph' ? 'Grafo G' : 'Croquis X'}
                  </button>
                ))}
              </div>
            </div>

            <GraphStage
              state={chain.state}
              previous={chain.previous}
              detail={chain.detail}
              sketch={sketch}
              t={t}
              view={view}
              mode="simulation"
              subphase={config.subphase}
              showDiff={config.showDiff}
              selected={selected}
              onSelect={(vertex) => {
                setSelected(vertex);
                openInspector();
              }}
              onViewChange={setView}
              layout={config.layout}
              mapSrc={config.mapSrc}
              mapOpacity={config.mapOpacity ?? 0.9}
              mapEnabled={config.mapEnabled !== false}
            />

            <p className="stage__hint">
              {config.subphase === 'plus'
                ? 't⁺: aristas y colores ya actualizados, posiciones todavía de t⁻.'
                : 't⁻: estado tras el desplazamiento, antes de la actualización.'}{' '}
              Haz clic en un vértice para abrir su ficha en el Inspector.
            </p>

            <PlaybackBar
              playing={sim.playing}
              t={t}
              minT={chain.minT}
              maxT={chain.maxT}
              speed={config.speed}
              subphase={config.subphase}
              showDiff={config.showDiff}
              fastSteps={config.fastSteps}
              fastRunning={sim.fastRun.status === 'running'}
              onToggle={sim.togglePlay}
              onStep={sim.stepOnce}
              onStepBy={sim.stepBy}
              onSeek={sim.seek}
              onRewind={sim.rewind}
              onForward={() => sim.seek(chain.maxT)}
              onReset={sim.reset}
              onStop={sim.stop}
              onSpeed={(value) => sim.setViewParam({ speed: value })}
              onSubphase={(value) => sim.setViewParam({ subphase: value })}
              onShowDiff={(value) => sim.setViewParam({ showDiff: value })}
            />
          </>
        )}
      </section>

      {/* ---------- Panel lateral ---------- */}
      <aside className="cell--side">
        {mode === 'editor' ? (
          <div className="panel panel--config">
            <div className="panel__head">
              <span className="panel__title">Configuración inicial y parámetros</span>
              <span className="chip mono">
                m = <strong>{sketch.size}</strong> · n = <strong>{sim.vertexCount}</strong>
              </span>
            </div>

            <div className="panel__body">
              <ControlPanel
                config={config}
                sketch={sketch}
                vertexCount={sim.vertexCount}
                hypotheses={hypotheses}
                fastRun={sim.fastRun}
                onModelParam={sim.setModelParam}
                onViewParam={sim.setViewParam}
                onGraphParam={applyGraphChange}
                onReset={sim.reset}
                onFastRun={() => sim.runFast(config.fastSteps ?? 1000)}
                onCancelFast={sim.cancelFast}
                onIdentityPositions={identityPositions}
                onApplyTopology={applyTopology}
                onApplyColors={applyColors}
              />
            </div>
          </div>
        ) : (
          <div className="panel panel--analysis">
            <div className="panel__head">
              <span className="panel__title">Panel de análisis</span>
              <span className="panel__hint">
                Gráficas + Estacionaria en una sola sección · arrastra ↔ para abrir o cerrar el
                Inspector
              </span>
            </div>

            <div className="analysis" ref={analysisRef}>
              <div className="analysis__main">
                <h2 className="analysis__section">Gráficas de evolución</h2>
                <div className="panel__stack">
                  <TimeSeriesChart
                    title="Número de aristas a lo largo del tiempo |E(Gₜ)|"
                    hint="Rueda: zoom · Clic: saltar a t"
                    yLabel="aristas"
                    t0={t0}
                    stride={chain.history.stride}
                    series={edgeSeries}
                    integer
                    height={215}
                    exportName="aristas-vs-t"
                    onZoom={zoom}
                    onSeek={(target) => sim.seek(target)}
                  />
                  <TimeSeriesChart
                    title="Frecuencia de cada color Cᵢ en Gₜ"
                    hint="Proporción en [0, 1]"
                    yLabel="frecuencia"
                    yDomain={[0, 1]}
                    t0={t0}
                    stride={chain.history.stride}
                    series={fractionSeries}
                    height={215}
                    exportName="frecuencia-colores"
                    onZoom={zoom}
                    onSeek={(target) => sim.seek(target)}
                  />

                  <section className="estimate-card">
                    <header className="estimate-card__head">
                      <h3>
                        Estimación empírica de π*
                        {estimate ? ` (desde t = ${estimate.from} hasta ${estimate.to})` : ''}
                      </h3>
                    </header>

                    {estimate ? (
                      <>
                        <p className="estimate-card__line">
                          Prom. |E(G)|: <strong>{estimate.meanEdges.toFixed(2)}</strong> · Actual:{' '}
                          <strong>{shownEdges}</strong>
                        </p>
                        <div className="estimate-card__colors">
                          {estimate.meanColors.map((value, i) => (
                            <span key={`est-${i}`}>
                              <i style={{ background: colorOf(i) }} />
                              C{subscript(i)}: {(value * 100).toFixed(1)}%
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="estimate-card__line">
                        Reproduce la trayectoria para estimar π* sobre su segunda mitad.
                      </p>
                    )}
                  </section>
                </div>

                <h2 className="analysis__section">
                  Estacionaria π* · verificación empírica y exacta del Teorema
                </h2>
                <StationaryPanel
                  sketch={sketch}
                  config={config}
                  conditions={conditions}
                  params={{ k: config.k, alpha: config.alpha }}
                  handlers={{
                    onSeed: (seed) => sim.setModelParam({ seed }),
                    // El cálculo exacto necesita n = m = 3: se fija el croquis
                    // y se parte de un G₀ de 3 vértices (editado o no).
                    onExactParams: (patch) => sim.setModelParam({ ...patch, g0: null }),
                  }}
                />
              </div>

              <div
                className="analysis__splitter"
                role="separator"
                aria-orientation="vertical"
                aria-label="Redimensionar el Inspector de paso t"
                aria-valuenow={inspectorWidth}
                tabIndex={0}
                title={
                  inspectorOpen
                    ? 'Arrastra → para cerrar el Inspector · doble clic para alternar'
                    : 'Arrastra ← para abrir el Inspector · doble clic para alternar'
                }
                onPointerDown={startResize}
                onPointerMove={onResizeMove}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                onDoubleClick={toggleInspector}
                onKeyDown={onSplitterKey}
              >
                <span className="analysis__grip" aria-hidden="true">
                  ↔
                </span>
              </div>

              {inspectorOpen ? (
                <div className="analysis__inspector" style={{ width: inspectorWidth }}>
                  <div className="analysis__inspector-head">
                    <span className="panel__title">Inspector de paso t</span>
                    <button
                      type="button"
                      className="analysis__close"
                      onClick={() => setInspectorWidth(0)}
                      title="Cerrar el Inspector (también puedes arrastrar el divisor)"
                      aria-label="Cerrar el Inspector"
                    >
                      ✕
                    </button>
                  </div>
                  <InspectorPanel
                    state={chain.state}
                    previous={chain.previous}
                    detail={chain.detail}
                    sketch={sketch}
                    params={{ k: config.k, alpha: config.alpha }}
                    selected={selected}
                    onSelect={setSelected}
                    t={t}
                    subphase={config.subphase}
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </aside>
    </main>
  );
}
