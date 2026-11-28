import { downloadCsv, downloadPng, downloadSvg } from '../../../shared/chart/svgExport';

const LABELS = { png: 'PNG', svg: 'SVG', csv: 'CSV' };

/**
 * Botones de exportación (PNG / SVG / CSV) en estilo póster.
 *
 * `buildSvg()` devuelve un SVG autónomo con fondo claro y tipografía legible
 * (no se serializa el DOM de la pantalla, así que el archivo queda limpio).
 * `buildCsv()` devuelve `{ header, rows }`.
 */
export default function ExportButtons({ name, formats = ['png', 'svg', 'csv'], buildSvg, buildCsv, disabled }) {
  const stamp = new Date().toISOString().slice(0, 10);
  const file = (ext) => `${name}-${stamp}.${ext}`;

  const handle = (format) => {
    if (format === 'csv') {
      const data = buildCsv?.();
      if (data) downloadCsv(data, file('csv'));
      return;
    }
    const svg = buildSvg?.();
    if (!svg) return;
    if (format === 'png') downloadPng(svg, file('png'));
    else downloadSvg(svg, file('svg'));
  };

  return (
    <div className="export" role="group" aria-label={`Exportar ${name}`}>
      <span className="export__label">Exportar</span>
      {formats.map((format) => (
        <button
          key={format}
          className="export__button"
          type="button"
          disabled={disabled}
          onClick={() => handle(format)}
        >
          {LABELS[format]}
        </button>
      ))}
    </div>
  );
}
