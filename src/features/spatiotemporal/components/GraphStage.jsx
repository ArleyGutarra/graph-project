import { subscript } from '../domain/initialState';
import { colorOf, labelColorFor } from './theme';

/**
 * Escenario: el grafo temporal G dibujado SOBRE el croquis X, con estética
 * futurista — fondo de rejilla, aristas con flujo LED y nodos con halo
 * pulsante (una luz por clase de color).
 */
export default function GraphStage({ state, sketch, t, observables }) {
  const m = sketch.size;
  // Lienzo 500×400 dimensionado para que el grafo llame la atención desde el
  // fondo de la sala: círculo de ~320 px de diámetro sobre pantalla, con nodos
  // de ~46 px. Todo cabe en la altura de una laptop (1366×768) sin scroll.
  const cx = 250;
  const cy = 198;
  const radius = 153;
  const ring = 30;
  const node = 22;

  const layout = Array.from({ length: m }, (_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / m;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });

  // Aristas de G entre las posiciones de sus extremos
  const graphEdges = [];
  for (let i = 0; i < state.n; i++) {
    for (let j = i + 1; j < state.n; j++) {
      if (state.adj[i] & (1 << j)) {
        const a = layout[state.pos[i]];
        const b = layout[state.pos[j]];
        graphEdges.push({ key: `${i}-${j}`, a, b });
      }
    }
  }

  return (
    <div className="stage">
      <div className="stage__meta">
        <span className="stage__badge">
          t = <strong>{t}</strong>
        </span>
        <span className="stage__badge">
          |E(G)| = <strong>{observables.edges}</strong>
        </span>
        <span className="stage__badge">
          X = <strong>{sketch.label}</strong>
        </span>
        <span className="stage__badge">
          n = <strong>{state.n}</strong>
        </span>
      </div>

      <svg
        className="stage__svg"
        viewBox="0 0 500 400"
        role="img"
        aria-label={`Grafo temporal sobre el croquis ${sketch.label} en el instante ${t}`}
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
        </defs>

        {/* Fondo: rejilla técnica + halos */}
        <rect x="0" y="0" width="500" height="400" rx="12" fill="url(#stage-bg)" />
        <rect x="0" y="0" width="500" height="400" rx="12" fill="url(#stage-grid)" />

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

        {/* Aro exterior: color C^X_i de la posición en el croquis.
            Núcleo: color del vértice (más abajo). */}
        <g>
          {layout.map((p, i) => {
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

        {/* Aristas de G (flujo LED) */}
        <g className="stage__edges">
          {graphEdges.map(({ key, a, b }) => (
            <line className="stage__edge" key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          ))}
        </g>

        {/* Vértices: halo pulsante + luz LED + etiqueta */}
        <g className="stage__nodes">
          {Array.from({ length: state.n }, (_, v) => {
            const p = layout[state.pos[v]];
            const color = colorOf(state.color[v]);
            return (
              <g key={`v-${v}`}>
                <circle className="stage__node-pulse" cx={p.x} cy={p.y} r={node + 6} fill={color} />
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
                  style={{ fill: labelColorFor(color) }}
                >
                  {v}
                </text>
              </g>
            );
          })}
        </g>

        {/* Etiquetas de posición x_i */}
        <g className="stage__position-labels">
          {layout.map((p, i) => (
            <text key={`lbl-${i}`} x={p.x} y={p.y + ring + 13}>
              x{subscript(i)}
            </text>
          ))}
        </g>
      </svg>

      <div className="stage__legend">
        <span className="stage__legend-title">COLOR DE G</span>
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
        <span className="stage__legend-note">
          anillo = color C^X_i de la posición en X · trazo tenue = E(X)
        </span>
      </div>
    </div>
  );
}
