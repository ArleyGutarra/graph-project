import { round } from '../../../shared/math/stats';

const WIDTH = 560;
const PAD = { left: 46, right: 12, top: 12, bottom: 26 };

/**
 * Gráfico de líneas en SVG puro (sin dependencias).
 *
 * @param {object} props
 * @param {Array<{label: string, color: string, values: number[]}>} props.series
 * @param {number} [props.t0]      instante del primer punto
 * @param {number} [props.stride]  distancia temporal entre puntos consecutivos
 * @param {[number, number]} [props.yDomain] dominio fijo (p. ej. [0, 1])
 */
export default function TimeSeriesChart({
  title,
  series = [],
  t0 = 0,
  stride = 1,
  height = 190,
  yLabel = '',
  yDomain,
  formatY = (v) => String(round(v, 2)),
}) {
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  const lengths = series.map((s) => s.values.length);
  const pointCount = lengths.length ? Math.max(...lengths) : 0;

  if (pointCount === 0) {
    return (
      <div className="chart">
        <div className="chart__title">{title}</div>
        <div className="chart__empty">Sin datos todavía</div>
      </div>
    );
  }

  // Dominio vertical
  let yMin;
  let yMax;
  if (yDomain) {
    [yMin, yMax] = yDomain;
  } else {
    let min = Infinity;
    let max = -Infinity;
    for (const s of series) {
      for (const v of s.values) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const pad = (max - min) * 0.08 || 1;
    yMin = min - pad;
    yMax = max + pad;
  }
  if (yMax === yMin) yMax = yMin + 1;

  const xAt = (i) => PAD.left + (pointCount <= 1 ? 0 : (i / (pointCount - 1)) * plotW);
  const yAt = (v) => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const yTicks = Array.from({ length: 4 }, (_, i) => yMin + ((yMax - yMin) * i) / 3);
  const xTickIndexes = [...new Set([0, Math.floor((pointCount - 1) / 2), pointCount - 1])];

  return (
    <div className="chart">
      <div className="chart__title">{title}</div>

      <svg
        className="chart__svg"
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={title}
      >
        {/* Rejilla + eje Y */}
        {yTicks.map((value) => (
          <g key={`yt-${value}`}>
            <line
              className="chart__grid"
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={yAt(value)}
              y2={yAt(value)}
            />
            <text className="chart__tick" x={PAD.left - 7} y={yAt(value)} textAnchor="end" dominantBaseline="middle">
              {formatY(value)}
            </text>
          </g>
        ))}

        {/* Eje X */}
        <line
          className="chart__axis"
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
        />
        {xTickIndexes.map((i) => (
          <text
            key={`xt-${i}`}
            className="chart__tick"
            x={xAt(i)}
            y={height - 8}
            textAnchor="middle"
          >
            {t0 + i * stride}
          </text>
        ))}

        {/* Series */}
        {series.map((s) => (
          <polyline
            key={s.label}
            className="chart__line"
            fill="none"
            stroke={s.color}
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={s.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ')}
          />
        ))}

        {pointCount < 2 ? (
          <text
            className="chart__hint"
            x={PAD.left + plotW / 2}
            y={PAD.top + plotH / 2}
            textAnchor="middle"
          >
            t = {t0} · pulsa ▶ para observar la trayectoria
          </text>
        ) : null}

        {yLabel ? (
          <text className="chart__axis-label" x={12} y={PAD.top + plotH / 2} transform={`rotate(-90 12 ${PAD.top + plotH / 2})`} textAnchor="middle">
            {yLabel}
          </text>
        ) : null}
      </svg>

      <div className="chart__legend">
        {series.map((s) => (
          <span className="chart__legend-item" key={s.label}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
