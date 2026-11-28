import ExportButtons from './ExportButtons';
import { histogramGeometry, histogramSvgString } from '../../../shared/chart/svgExport';

const WIDTH = 560;

/**
 * Histograma agrupado en SVG puro (sin dependencias).
 *
 * Varias series se superponen en bandas: sirve tanto para una sola π*
 * como para las 3 cadenas con distinto π₀, que deben coincidir.
 *
 * @param {object} props
 * @param {Array<{label: string, color: string, bins: Array<{x:number,p:number}>}>} props.series
 */
export default function HistogramChart({
  title,
  subtitle,
  series = [],
  xLabel = '',
  yLabel = '',
  height = 230,
  exportName = 'histograma',
  exportSeries,
  exportCsv,
  footnote,
}) {
  const pad = { left: 46, right: 12, top: 10, bottom: 30 };
  const spec = { series };
  const geo = histogramGeometry(spec, { width: WIDTH, height, pad });
  const plotH = height - pad.top - pad.bottom;

  const hasData = !geo.empty && geo.bars.length > 0;

  const buildSvg = () =>
    histogramSvgString({
      title,
      subtitle,
      xLabel,
      yLabel,
      series: exportSeries ?? series,
      footnote,
    });

  return (
    <div className="chart chart--histogram">
      <div className="chart__head">
        <div className="chart__title">{title}</div>
        <ExportButtons
          name={exportName}
          formats={exportCsv ? ['png', 'svg', 'csv'] : ['png', 'svg']}
          buildSvg={buildSvg}
          buildCsv={exportCsv}
          disabled={!hasData}
        />
      </div>

      {subtitle ? <div className="chart__subtitle">{subtitle}</div> : null}

      {hasData ? (
        <svg
          className="chart__svg"
          viewBox={`0 0 ${WIDTH} ${height}`}
          role="img"
          aria-label={title}
        >
          {/* Rejilla + ticks Y */}
          {geo.y.ticks.map((tick) => {
            const yy = pad.top + plotH - ((tick - geo.y.min) / (geo.y.max - geo.y.min)) * plotH;
            return (
              <g key={`y-${tick}`}>
                <line className="chart__grid" x1={pad.left} x2={WIDTH - pad.right} y1={yy} y2={yy} />
                <text className="chart__tick" x={pad.left - 7} y={yy} textAnchor="end" dominantBaseline="middle">
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Ejes */}
          <line
            className="chart__axis"
            x1={pad.left}
            x2={WIDTH - pad.right}
            y1={pad.top + plotH}
            y2={pad.top + plotH}
          />
          <line className="chart__axis" x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top + plotH} />

          {/* Ticks X (siempre enteros) */}
          {geo.xTicks.map((tick) => (
            <text
              key={`x-${tick.v}`}
              className="chart__tick"
              x={tick.x}
              y={height - 34}
              textAnchor="middle"
            >
              {tick.v}
            </text>
          ))}

          {/* Barras agrupadas */}
          {geo.bars.map((bar) => (
            <rect
              key={bar.key}
              x={bar.x}
              y={bar.y}
              width={bar.w}
              height={Math.max(0.6, bar.h)}
              fill={bar.color}
              rx="1"
            >
              <title>{`${bar.label} · x = ${bar.xValue}: ${(bar.p * 100).toFixed(3)}%`}</title>
            </rect>
          ))}

          {xLabel ? (
            <text
              className="chart__axis-label"
              x={pad.left + geo.plotW / 2}
              y={height - 18}
              textAnchor="middle"
            >
              {xLabel}
            </text>
          ) : null}
          {yLabel ? (
            <text
              className="chart__axis-label"
              x={12}
              y={pad.top + plotH / 2}
              transform={`rotate(-90 12 ${pad.top + plotH / 2})`}
              textAnchor="middle"
            >
              {yLabel}
            </text>
          ) : null}
        </svg>
      ) : (
        <div className="chart__empty">Sin datos todavía</div>
      )}

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
