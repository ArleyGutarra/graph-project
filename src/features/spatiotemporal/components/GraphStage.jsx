import { useMemo, useRef, useState } from 'react';
import { subscript } from '../domain/initialState';
import {
  CANVAS,
  buildLayout,
  clampToCanvas,
  isDrag,
  nearestPosition,
} from './stageLayout';
import { colorOf, labelColorFor } from './theme';
import { displayedState } from '../domain/stepDetail';

/** Mapa del campus (croquis.jpg) publicado en `public/`. */
const MAP_SRC = `${import.meta.env.BASE_URL}croquis.jpg`;

/**
 * Escenario con dos vistas conmutables y dos modos de uso:
 *
 *  - `view = 'graph'`    → el grafo temporal G dibujado SOBRE el croquis X.
 *  - `view = 'croquis'`  → el mapa del campus a sangre con E(X) encima.
 *
 *  - `mode = 'editor'`   → vista 1 "Configurar escenario": las 5 herramientas
 *      (Mover, +Nodo, Arista, Pintar, Borrar) emiten eventos semánticos
 *      (`onDrop`, `onBackground`, `onNodeAction`, `onEdgeAction`) y la
 *      asignación concreta de G₀ la decide el componente contenedor.
 *  - `mode = 'simulation'` → vista 2: sólo selección de vértice + Diff.
 *
 * Los micro-estados t⁻ / t⁺ se resuelven aquí: `previous` es t⁻ y el detalle
 * del paso reconstruye t⁺ (mismas posiciones, aristas y colores ya
 * actualizados), de modo que el conmutador sólo cambia esas dos cosas.
 */
export default function GraphStage({
  state,
  previous,
  detail,
  sketch,
  t,
  view = 'graph',
  mode = 'simulation',
  tool = 'move',
  subphase = 'plus',
  showDiff = false,
  selected,
  onSelect,
  onNodeAction,
  onEdgeAction,
  onDrop,
  onMovePosition,
  onBackground,
  onViewChange,
  onRename,
  labels,
  layout: storedLayout,
  mapSrc,
  mapOpacity = 1,
  mapEnabled = true,
}) {
  const svgRef = useRef(null);
  // Arrastre: `vertex` es null cuando se arrastra una posición desde el croquis.
  const [drag, setDrag] = useState(null); // { vertex, position, start, shift }
  const [pointerPos, setPointerPos] = useState(null); // cursor durante el arrastre
  const [hoverPos, setHoverPos] = useState(null); // posición candidata
  const [pendingNode, setPendingNode] = useState(null); // 1er clic de "Arista"
  const [renaming, setRenaming] = useState(null); // { vertex, value }

  const isCroquis = view === 'croquis';
  const isEditor = mode === 'editor';
  const m = sketch.size;

  // --- Micro-estado mostrado ------------------------------------------------
  // t⁻ = `previous` (estado de partida del último paso) · t⁺ = reconstruido.
  // Se usa la MISMA función en SimulationPage para las etiquetas t / |E(G)|.
  const shown = displayedState({ state, previous, detail, mode, subphase });

  let shownEdges = 0;
  for (let i = 0; i < shown.n; i++) {
    for (let j = i + 1; j < shown.n; j++) if (shown.adj[i] & (1 << j)) shownEdges += 1;
  }

  // Lienzo 500×400 dimensionado para que el grafo llame la atención desde el
  // fondo de la sala: círculo de ~320 px de diámetro sobre pantalla, con nodos
  // de ~46 px. Todo cabe en la altura de una laptop (1366×768) sin scroll.
  const ring = 30;
  const node = 22;
  // En la vista Croquis los nodos van más pequeños: lo que interesa es ver el
  // comportamiento del grafo dentro del mapa, no el tamaño del nodo.
  const croquisNode = 17;

  // Disposición de los xᵢ: el anillo por defecto, o la que fije el arrastre.
  const layout = useMemo(() => buildLayout(m, storedLayout), [m, storedLayout]);

  // Coordenadas vivas: mientras mantienes el clic, el nodo Y su aro xᵢ siguen
  // al cursor (el modelo no cambia, sólo las coordenadas de dibujo). Con Shift
  // no se mueve nada: sólo se reasigna p₀(v) al soltar.
  const dragging = drag !== null && pointerPos !== null && !drag.shift;
  const nodeCoord = (v) =>
    dragging && drag.vertex === v ? pointerPos : layout[shown.pos[v]];
  const markerCoord = (i) => (dragging && drag.position === i ? pointerPos : layout[i]);

  // --- Aristas del estado mostrado + Diff -----------------------------------
  const graphEdges = [];
  const addedEdges = [];
  const removedEdges = [];
  const diffBase = isEditor || !showDiff || subphase !== 'plus' ? null : previous;

  for (let i = 0; i < shown.n; i++) {
    for (let j = i + 1; j < shown.n; j++) {
      const present = (shown.adj[i] & (1 << j)) !== 0;
      const key = `${i}-${j}`;
      const a = nodeCoord(i);
      const b = nodeCoord(j);

      if (present) {
        graphEdges.push({ key, a, b, i, j });
        if (diffBase && !(diffBase.adj[i] & (1 << j))) addedEdges.push({ key, a, b });
      } else if (diffBase && diffBase.adj[i] & (1 << j)) {
        removedEdges.push({ key, a: layout[diffBase.pos[i]], b: layout[diffBase.pos[j]] });
      }
    }
  }

  // --- Conversión de coordenadas del ratón a coordenadas del SVG ------------
  /**
   * Ratón → coordenadas del lienzo. El SVG lleva viewBox fijo 500×400 y se
   * escala uniformemente (`height: auto`), así que la relación lineal es
   * exacta. Sin caja (jsdom u elemento oculto) no hay arrastre posible.
   */
  const toSvgPoint = (event) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS.width,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS.height,
    };
  };

  /**
   * Captura el puntero para que el arrastre no se pierda al salir del SVG.
   * En entornos sin puntero real (jsdom) la llamada puede lanzar: se ignora.
   */
  const capturePointer = (id) => {
    try {
      svgRef.current?.setPointerCapture?.(id);
    } catch {
      /* sin soporte de captura: el arrastre sigue funcionando */
    }
  };

  const releasePointer = (id) => {
    try {
      svgRef.current?.releasePointerCapture?.(id);
    } catch {
      /* idempotente */
    }
  };

  const handleBackground = (event) => {
    if (!isEditor) return;
    const point = toSvgPoint(event);
    if (!point) return;
    onBackground?.(nearestPosition(layout, point));
  };

  const handlePointerMove = (event) => {
    if (!isEditor) return;
    const point = toSvgPoint(event);
    if (!point) return;

    if (drag !== null) {
      if (drag.shift && drag.vertex !== null) {
        // Shift: no se mueve nada, sólo se señala la xⱼ que recibirá p₀(v).
        setPointerPos(null);
        setHoverPos(nearestPosition(layout, point));
      } else {
        setPointerPos(point);
        setHoverPos(null);
      }
      return;
    }

    if (tool === 'addNode') setHoverPos(nearestPosition(layout, point));
  };

  const handlePointerUp = (event) => {
    if (!isEditor || drag === null) return;
    const point = toSvgPoint(event);
    releasePointer(event.pointerId);

    if (point && drag.shift && drag.vertex !== null) {
      // Shift + arrastrar: reasigna p₀(v) a la xⱼ más cercana.
      const target = nearestPosition(layout, point);
      if (target !== drag.position) onDrop?.(drag.vertex, target);
    } else if (point && isDrag(drag.start, point)) {
      // Arrastre libre: se conserva la posición xᵢ que ocupaba el nodo.
      onMovePosition?.(drag.position, clampToCanvas(point));
    }

    setDrag(null);
    setPointerPos(null);
    setHoverPos(null);
  };

  /** Arrastre desde el croquis: mueve la posición xᵢ directamente. */
  const handlePositionPointerDown = (event, position) => {
    if (!isEditor || tool !== 'move' || renaming) return;
    event.stopPropagation();
    const point = toSvgPoint(event);
    capturePointer(event.pointerId);
    setPointerPos(null);
    setDrag({ vertex: null, position, start: point, shift: false });
  };

  const handleNodePointerDown = (event, vertex) => {
    if (!isEditor) {
      onSelect?.(vertex);
      return;
    }
    event.stopPropagation();

    // Todo clic sobre un nodo lo selecciona: es el que usarán Supr, Enter o
    // la herramienta activa.
    onSelect?.(vertex);

    if (renaming) return;

    if (tool === 'move') {
      const point = toSvgPoint(event);
      capturePointer(event.pointerId);
      setPointerPos(null);
      setDrag({
        vertex,
        position: shown.pos[vertex],
        start: point,
        shift: event.shiftKey,
      });
      return;
    }
    if (tool === 'addNode') return;

    if (tool === 'edge') {
      if (pendingNode === null) {
        setPendingNode(vertex);
        return;
      }
      if (pendingNode !== vertex) onEdgeAction?.(pendingNode, vertex, 'edge');
      setPendingNode(null);
      return;
    }

    setPendingNode(null);
    onNodeAction?.(vertex, tool);
  };

  const commitRename = () => {
    if (!renaming) return;
    const value = renaming.value.trim();
    if (value && value !== (labels?.[renaming.vertex] ?? String(renaming.vertex))) {
      onRename?.(renaming.vertex, value);
    }
    setRenaming(null);
  };

  const handleEdgePointerDown = (event, edge) => {
    event.stopPropagation();
    onEdgeAction?.(edge.i, edge.j, 'delete');
    setPendingNode(null);
  };

  const selectButton = (id, label) => (
    <button
      key={id}
      type="button"
      className={`stage__view-button${view === id ? ' is-active' : ''}`}
      aria-pressed={view === id}
      onClick={() => onViewChange?.(id)}
    >
      {label}
    </button>
  );

  const pointerTool = isEditor && ['move', 'addNode'].includes(tool);

  return (
    <div className="stage">
      <div className="stage__meta">
        <div className="stage__badges">
          {isCroquis ? (
            <>
              <span className="stage__badge">
                X = <strong>{sketch.label}</strong>
              </span>
              <span className="stage__badge">
                m = <strong>{m}</strong>
              </span>
              <span className="stage__badge">
                c + 1 = <strong>{sketch.colorCount}</strong>
              </span>
            </>
          ) : (
            <>
              <span className="stage__badge">
                t = <strong>{t}</strong>
                {mode === 'simulation' ? (
                  <strong>{subphase === 'plus' ? '⁺' : '⁻'}</strong>
                ) : null}
              </span>
              <span className="stage__badge">
                |E(G)| = <strong>{shownEdges}</strong>
              </span>
              <span className="stage__badge">
                X = <strong>{sketch.label}</strong>
              </span>
              <span className="stage__badge">
                n = <strong>{shown.n}</strong>
              </span>
            </>
          )}
        </div>

        <div className="stage__view" role="group" aria-label="Vista del escenario">
          {selectButton('graph', mode === 'editor' ? 'Grafo inicial G₀' : 'Grafo G')}
          {selectButton('croquis', 'Croquis X')}
        </div>
      </div>

      <div className="stage__canvas">
      <svg
        ref={svgRef}
        className={`stage__svg${isCroquis ? ' stage__svg--croquis' : ''}${
          pointerTool ? ' stage__svg--tool' : ''
        }${drag ? ' stage__svg--dragging' : ''}`}
        viewBox="0 0 500 400"
        role="img"
        aria-label={
          isCroquis
            ? `Croquis ${sketch.label} con sus ${m} posiciones sobre el mapa del campus`
            : `Grafo temporal sobre el croquis ${sketch.label} en el instante ${t}`
        }
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) handleBackground(event);
        }}
      >
        <defs>
          <radialGradient id="stage-bg" cx="50%" cy="42%" r="72%">
            <stop offset="0%" stopColor="#141118" />
            <stop offset="60%" stopColor="#0b0a0e" />
            <stop offset="100%" stopColor="#08070a" />
          </radialGradient>
          <pattern id="stage-grid" width="25" height="25" patternUnits="userSpaceOnUse">
            <path
              d="M25 0H0V25"
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.05"
              strokeWidth="1"
            />
          </pattern>
          <clipPath id="stage-clip">
            <rect x="0" y="0" width="500" height="400" rx="12" />
          </clipPath>
        </defs>

        {/* Fondo clickeable (necesario para "+ Nodo") */}
        {isCroquis ? (
          <g clipPath="url(#stage-clip)" onPointerDown={handleBackground}>
            <rect x="0" y="0" width="500" height="400" fill="#efe7d6" />
            <image
              href={mapSrc ?? MAP_SRC}
              x="0"
              y="0"
              width="500"
              height="400"
              opacity={mapEnabled ? mapOpacity : 0}
              preserveAspectRatio="xMidYMid slice"
            />
            <rect x="0" y="0" width="500" height="400" fill="#ffffff" fillOpacity="0.14" />
          </g>
        ) : (
          <g onPointerDown={handleBackground}>
            <rect x="0" y="0" width="500" height="400" rx="12" fill="url(#stage-bg)" />
            <rect x="0" y="0" width="500" height="400" rx="12" fill="url(#stage-grid)" />
          </g>
        )}

        {/* Aristas del croquis E(X) */}
        <g className="stage__sketch-edges">
          {sketch.edges.map(([a, b]) => (
            <line
              key={`x-${a}-${b}`}
              x1={layout[a].x}
              y1={layout[a].y}
              x2={layout[b].x}
              y2={layout[b].y}
            />
          ))}
        </g>

        {isCroquis ? (
          /* Sin G: cada posición es un nodo relleno con su clase C^X_i. */
          <g className="stage__croquis-nodes">
            {layout.map((_, i) => {
              const p = markerCoord(i);
              const color = colorOf(sketch.colors[i]);
              return (
                <g
                  key={`pos-${i}`}
                  className={isEditor ? 'stage__croquis-pos' : undefined}
                  onPointerDown={(event) => handlePositionPointerDown(event, i)}
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={croquisNode}
                    fill={color}
                    fillOpacity={0.94}
                    stroke="#14121a"
                    strokeWidth={3}
                  />
                  <text
                    className="stage__node-label"
                    x={p.x}
                    y={p.y}
                    style={{ fill: labelColorFor(color) }}
                  >
                    {i}
                  </text>
                </g>
              );
            })}
          </g>
        ) : (
          <>
            {/* Aro exterior: color C^X_i de la posición en el croquis. */}
            <g>
              {layout.map((_, i) => {
                const p = markerCoord(i);
                const ringColor = colorOf(sketch.colors[i]);
                return (
                  <circle
                    key={`pos-${i}`}
                    className="stage__ring"
                    cx={p.x}
                    cy={p.y}
                    r={ring}
                    fill={ringColor}
                    fillOpacity={0.13}
                    stroke={ringColor}
                    strokeWidth={4}
                  />
                );
              })}
            </g>

            {/* Posición candidata al arrastrar / añadir */}
            {hoverPos !== null ? (
              <circle
                className="stage__hover-pos"
                cx={layout[hoverPos].x}
                cy={layout[hoverPos].y}
                r={ring}
              />
            ) : null}

            {/* Aristas eliminadas en este paso (Diff) */}
            {diffBase ? (
              <g className="stage__diff">
                {removedEdges.map(({ key, a, b }) => (
                  <line
                    className="stage__edge--removed"
                    key={`rm-${key}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                  />
                ))}
              </g>
            ) : null}

            {/* Aristas de G (flujo LED) */}
            <g className="stage__edges">
              {graphEdges.map(({ key, a, b }) => (
                <line className="stage__edge" key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              ))}
            </g>

            {/* Aristas añadidas en este paso (Diff) */}
            {diffBase ? (
              <g className="stage__diff">
                {addedEdges.map(({ key, a, b }) => (
                  <line
                    className="stage__edge--added"
                    key={`add-${key}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                  />
                ))}
              </g>
            ) : null}

            {/* Zonas de clic sobre aristas (sólo la herramienta Borrar) */}
            {isEditor && tool === 'delete' ? (
              <g className="stage__edge-hits">
                {graphEdges.map((edge) => (
                  <line
                    key={`hit-${edge.key}`}
                    x1={edge.a.x}
                    y1={edge.a.y}
                    x2={edge.b.x}
                    y2={edge.b.y}
                    onPointerDown={(event) => handleEdgePointerDown(event, edge)}
                  />
                ))}
              </g>
            ) : null}

            {/* Vértices: halo pulsante + luz LED + etiqueta */}
            <g className="stage__nodes">
              {Array.from({ length: shown.n }, (_, v) => {
                const p = nodeCoord(v);
                const color = colorOf(shown.color[v]);
                const isSelected = selected === v;
                const isPending = pendingNode === v;
                return (
                  <g
                    key={`v-${v}`}
                    className={`stage__vertex${isSelected ? ' is-selected' : ''}${
                      isPending ? ' is-pending' : ''
                    }`}
                    onPointerDown={(event) => handleNodePointerDown(event, v)}
                    onDoubleClick={(event) => {
                      if (!isEditor) return;
                      event.stopPropagation();
                      setRenaming({
                        vertex: v,
                        value: labels?.[v] ?? String(v),
                      });
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleNodePointerDown(event, v);
                      }
                    }}
                  >
                    {isSelected || isPending ? (
                      <circle
                        className="stage__node-focus"
                        cx={p.x}
                        cy={p.y}
                        r={node + 13}
                      />
                    ) : null}
                    <circle
                      className="stage__node-pulse"
                      cx={p.x}
                      cy={p.y}
                      r={node + 6}
                      fill={color}
                    />
                    <circle
                      className="stage__node"
                      cx={p.x}
                      cy={p.y}
                      r={node}
                      fill={color}
                      stroke="rgba(255,255,255,0.85)"
                      strokeWidth={2}
                      style={{ filter: `drop-shadow(0 0 7px ${color})` }}
                    />
                    <text
                      className="stage__node-label"
                      x={p.x}
                      y={p.y}
                      style={{
                        fill: labelColorFor(color),
                        fontSize:
                          (labels?.[v] ?? String(v)).length > 2
                            ? 12
                            : undefined,
                      }}
                    >
                      {labels?.[v] ?? v}
                    </text>
                    <text
                      className="stage__pos-label"
                      x={p.x + node + 6}
                      y={p.y - node - 4}
                    >
                      x{subscript(shown.pos[v])}
                    </text>
                  </g>
                );
              })}
            </g>
          </>
        )}

        {/* Etiquetas de posición x_i */}
        <g className="stage__position-labels">
          {layout.map((_, i) => (
            <text
              key={`lbl-${i}`}
              x={markerCoord(i).x}
              y={markerCoord(i).y + (isCroquis ? croquisNode + 16 : ring + 13)}
            >
              x{subscript(i)}
            </text>
          ))}
        </g>
      </svg>

        {renaming && isEditor && renaming.vertex < shown.n ? (
          <input
            className="stage__rename"
            type="text"
            autoFocus
            maxLength={10}
            aria-label={`Renombrar v${renaming.vertex}`}
            value={renaming.value}
            style={{
              left: `${(markerCoord(shown.pos[renaming.vertex]).x / 500) * 100}%`,
              top: `${(markerCoord(shown.pos[renaming.vertex]).y / 400) * 100}%`,
            }}
            onChange={(event) => setRenaming({ ...renaming, value: event.target.value })}
            onBlur={commitRename}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter') {
                event.preventDefault();
                commitRename();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                setRenaming(null);
              }
            }}
          />
        ) : null}
      </div>

      <div className="stage__legend">
        <span className="stage__legend-title">{isCroquis ? 'COLOR DE X' : 'COLOR DE G'}</span>
        {Array.from({ length: sketch.colorCount }, (_, i) => (
          <span className="stage__legend-item" key={`c-${i}`}>
            <i
              style={{
                background: colorOf(i),
                boxShadow: `0 0 8px ${colorOf(i)}`,
              }}
            />
            C{subscript(i)}
          </span>
        ))}

        <span className="stage__legend-sep" />

        <span className="stage__legend-item">
          <i className="stage__legend-ring" style={{ borderColor: colorOf(sketch.colors[0]) }} />
          Territorio X
        </span>
        <span className="stage__legend-item">
          <i className="stage__legend-line stage__legend-line--edge" />
          Arista G
        </span>
        <span className="stage__legend-item">
          <i className="stage__legend-line stage__legend-line--added" />
          Nueva
        </span>
        <span className="stage__legend-item">
          <i className="stage__legend-line stage__legend-line--removed" />
          Eliminada
        </span>
      </div>
    </div>
  );
}
