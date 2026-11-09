function GraphView() {
  return (
    <svg
      className="graph-view"
      viewBox="0 0 400 300"
      role="img"
      aria-label="Graph with four vertices and six edges"
    >
      {/* Mapa base: conexiones grises */}
      <g className="graph-view__map">
        <line x1="90" y1="60" x2="310" y2="60" />
        <line x1="310" y1="60" x2="310" y2="240" />
        <line x1="310" y1="240" x2="90" y2="240" />
        <line x1="90" y1="240" x2="90" y2="60" />
        <line x1="90" y1="60" x2="310" y2="240" />
        <line x1="310" y1="60" x2="90" y2="240" />
      </g>

      {/* Grafo: conexiones burdeos */}
      <g className="graph-view__edges">
        <line x1="90" y1="60" x2="90" y2="240" />
        <line x1="90" y1="60" x2="310" y2="240" />
        <line x1="310" y1="60" x2="310" y2="240" />
      </g>

      {/* Vértices */}
      <g className="graph-view__nodes">
        <circle cx="90" cy="60" r="11" />
        <circle cx="310" cy="60" r="11" />
        <circle cx="310" cy="240" r="11" />
        <circle cx="90" cy="240" r="11" />
      </g>

      {/* Numeración de vértices */}
      <g className="graph-view__numbers">
        <text x="90" y="60">
          1
        </text>
        <text x="310" y="60">
          2
        </text>
        <text x="310" y="240">
          3
        </text>
        <text x="90" y="240">
          4
        </text>
      </g>

      {/* Etiquetas matemáticas */}
      <g className="graph-view__labels">
        <text x="66" y="36">
          v₁
        </text>
        <text x="330" y="36">
          v₂
        </text>
        <text x="330" y="270">
          v₃
        </text>
        <text x="66" y="270">
          v₄
        </text>
      </g>
    </svg>
  );
}

export default GraphView;
