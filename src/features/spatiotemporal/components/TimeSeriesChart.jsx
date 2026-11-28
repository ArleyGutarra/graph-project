import { useEffect, useRef } from 'react';
import { round } from '../../../shared/math/stats';
import { computeAxis, lineSvgString } from '../../../shared/chart/svgExport';
import ExportButtons from './ExportButtons';

const WIDTH = 560;
const PAD = { left: 46, right: 12, top: 12, bottom: 26 };

/**
 * Gráfico de líneas en SVG puro (sin dependencias).
 *
 * Autoescalado corregido: el eje y NUNCA baja de 0 cuando los valores son
 * conteos no negativos (`integer`) y los ticks salen enteros; el dominio
 * fijo (`yDomain`) se respeta sin padding, así [0, 1] dibuja 0 · 0.25 · … · 1.
 *
 * @param {object} props
 * @param {Array<{label: string, color: string, values: number[]}>} props.series
 * @param {number} [props.t0]      instante del primer punto
 * @param {number} [props.stride]  distancia temporal entre puntos consecutivos
 * @param {[number, number]} [props.yDomain] dominio fijo (p. ej. [0, 1])
 * @param {boolean} [props.integer] eje y con ticks enteros y base en 0
 */
export default function TimeSeriesChart({
  title,
  hint,
  subtitle,
  series = [],
  t0 = 0,
  stride = 1,
  height = 190,
  yLabel = '',
  yDomain,
  integer = false,
  formatY = (v) => String(round(v, 2)),
  exportName,
  onZoom,
  onSeek,
}) {
  const svgRef = useRef(null);
  const wheelRef = useRef(null);
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  const lengths = series.map((s) => s.values.length);
  const pointCount = lengths.length ? Math.max(...lengths) : 0;

  // Zoom con la rueda. Se declara ANTES del render condicional para no romper
  // el orden de los hooks cuando la serie todavía está vacía; el listener se
  // registra una sola vez y consulta el callback a través de un ref.
  const zoomRef = useRef(onZoom);

  useEffect(() => {
    zoomRef.current = onZoom;
  }, [onZoom]);

  useEffect(() => {
    const node = wheelRef.current;
    if (!node) return undefined;
    const handler = (event) => {
      if (!zoomRef.current) return;
      event.preventDefault();
      zoomRef.current(event.deltaY < 0 ? 1 : -1);
    };
    node.addEventListener('wheel', handler, { passive: false });
    return () => node.removeEventListener('wheel', handler);
  }, []);

  if (pointCount === 0) {
    return (
      <div className="chart" ref={wheelRef}>
        <div className="chart__head">
          <div className="chart__head-left">
            <div className="chart__title">{title}</div>
            {hint ? <span className="chart__hint">{hint}</span> : null}
          </div>
        </div>
        <div className="chart__empty">Sin datos todavía</div>
      </div>
    );
  }

  // Dominio vertical
  let axis;
  if (yDomain) {
    const [lo, hi] = yDomain;
    axis = {
      min: lo,
      max: hi === lo ? lo + 1 : hi,
      ticks: Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4),
    };
  } else {
    let min = Infinity;
    let max = -Infinity;
    for (const s of series) {
      for (const v of s.values) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    // Los conteos no pueden bajar de 0: sin este clamp el eje mostraba −0.12.
    axis = computeAxis({ min: integer ? 0 : Math.max(0, min), max, count: 4, integer });
  }

  const xAt = (i) => PAD.left + (pointCount <= 1 ? 0 : (i / (pointCount - 1)) * plotW);
  const yAt = (v) =>
    PAD.top + plotH - ((v - axis.min) / (axis.max - axis.min)) * plotH;

  const xTickIndexes = [
    ...new Set([0, Math.floor((pointCount - 1) / 3), Math.floor((2 * (pointCount - 1)) / 3), pointCount - 1]),
  ];

  const seekFromPointer = (event) => {
    // Sólo el botón izquierdo salta a t (el derecho no hace nada).
    if (!onSeek || (event.button !== undefined && event.button !== 0)) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const scale = rect.width / WIDTH;
    const fraction = (x / scale - PAD.left) / plotW;
    const index = Math.round(Math.max(0, Math.min(1, fraction)) * (pointCount - 1));
    onSeek(t0 + index * stride);
  };

  const buildSvg = () =>
    lineSvgString({
      title,
      subtitle,
      xLabel: '',
      yLabel,
      series,
      yDomain: [axis.min, axis.max],
      integerTicks: integer,
      xValues: xTickIndexes.map((i) => t0 + i * stride),
      height: Math.max(300, height + 90),
      footnote: 'VI CIMM-UNI 2026 · Ergodicidad y convergencia en redes espacio-temporales',
    });

  const buildCsv = () => ({
    header: ['t', ...series.map((s) => s.label)],
    rows: Array.from({ length: pointCount }, (_, i) => [
      t0 + i * stride,
      ...series.map((s) => (s.values[i] === undefined ? '' : round(s.values[i], 6))),
    ]),
  });

  return (
    <div className="chart" ref={wheelRef}>
      <div className="chart__head">
        <div className="chart__head-left">
          <div className="chart__title">{title}</div>
          {hint ? <span className="chart__hint">{hint}</span> : null}
        </div>
        <ExportButtons
          name={exportName ?? 'serie'}
          formats={['png', 'svg', 'csv']}
          buildSvg={buildSvg}
          buildCsv={buildCsv}
        />
      </div>

      {subtitle ? <div className="chart__subtitle">{subtitle}</div> : null}

      <svg
        ref={svgRef}
        className={`chart__svg${onSeek ? ' chart__svg--seekable' : ''}`}
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={title}
        onClick={seekFromPointer}
      >
        {/* Rejilla + eje Y */}
        {axis.ticks.map((value) => (
          <g key={`yt-${value}`}>
            <line
              className="chart__grid"
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={yAt(value)}
              y2={yAt(value)}
            />
            <text
              className="chart__tick"
              x={PAD.left - 7}
              y={yAt(value)}
              textAnchor="end"
              dominantBaseline="middle"
            >
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
          <text
            className="chart__axis-label"
            x={12}
            y={PAD.top + plotH / 2}
            transform={`rotate(-90 12 ${PAD.top + plotH / 2})`}
            textAnchor="middle"
          >
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
