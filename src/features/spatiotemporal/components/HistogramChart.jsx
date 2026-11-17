const WIDTH = 560;
const PAD = { left: 46, right: 12, top: 12, bottom: 30 };

/**
 * Histograma agrupado en SVG puro: compara la distribución empírica de un
 * observable (p. ej. |E|) entre las distintas condiciones iniciales.
 *
 * @param {object} props
 * @param {Array<{label: string, color: string, histogram: {xs: number[], counts: number[]}}>} props.groups
 */
export default function HistogramChart({ title, groups = [], height = 190 }) {
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  const xs = [...new Set(groups.flatMap((g) => g.histogram.xs))].sort((a, b) => a - b);

  if (!xs.length) {
    return (
      <div className="chart">
        <div className="chart__title">{title}</div>
        <div className="chart__empty">Sin datos todavía</div>
      </div>
    );
  }

  const maxCount = Math.max(1, ...groups.flatMap((g) => g.histogram.counts));
  const slotW = plotW / xs.length;
  const barW = Math.max(3, (slotW * 0.86) / groups.length);

  const yAt = (count) => PAD.top + plotH - (count / maxCount) * plotH;
  const yTicks = [0, maxCount / 2, maxCount].map((v) => Math.round(v));

  const showEvery = xs.length > 16 ? Math.ceil(xs.length / 12) : 1;

  return (
    <div className="chart">
      <div className="chart__title">{title}</div>

      <svg
        className="chart__svg"
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={title}
      >
        {yTicks.map((count, i) => (
          <g key={`yt-${i}`}>
            <line
              className="chart__grid"
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={yAt(count)}
              y2={yAt(count)}
            />
            <text className="chart__tick" x={PAD.left - 7} y={yAt(count)} textAnchor="end" dominantBaseline="middle">
              {count}
            </text>
          </g>
        ))}

        <line
          className="chart__axis"
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
        />

        {xs.map((x, xi) => {
          const slotX = PAD.left + xi * slotW;
          return (
            <g key={`x-${x}`}>
              {groups.map((g, gi) => {
                const count = g.histogram.counts[g.histogram.xs.indexOf(x)] ?? 0;
                if (!count) return null;
                const barX = slotX + slotW * 0.07 + gi * barW;
                return (
                  <rect
                    key={g.label}
                    x={barX}
                    y={yAt(count)}
                    width={barW}
                    height={PAD.top + plotH - yAt(count)}
                    fill={g.color}
                    fillOpacity={0.85}
                    stroke="rgba(255,255,255,0.28)"
                    strokeWidth={0.75}
                  />
                );
              })}
              {xi % showEvery === 0 ? (
                <text className="chart__tick" x={slotX + slotW / 2} y={height - 10} textAnchor="middle">
                  {x}
                </text>
              ) : null}
            </g>
          );
        })}

        <text
          className="chart__axis-label"
          x={PAD.left + plotW / 2}
          y={height - 1}
          textAnchor="middle"
        >
          número de aristas |E(G)|
        </text>
      </svg>

      <div className="chart__legend">
        {groups.map((g) => (
          <span className="chart__legend-item" key={g.label}>
            <i style={{ background: g.color }} />
            {g.label}
          </span>
        ))}
      </div>
    </div>
  );
}
