/**
 * Exportación de gráficas en formato apto para el póster:
 * fondo claro, tipografías legibles, sin elementos del tema oscuro.
 *
 * Los SVG se generan a partir de los MISMOS datos que dibuja la pantalla
 * (no se serializa el DOM), de modo que el archivo exportado es autónomo:
 * sin clases CSS externas, listo para insertar en PowerPoint/LaTeX.
 */

const FONT = "Segoe UI, system-ui, Arial, Helvetica, sans-serif";

/** Color de relleno visible sobre fondo claro (oscurece los tonos claros). */
export function posterColor(hex) {
  const value = parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance <= 0.72) return hex;
  const f = 0.42;
  const mix = (c) => Math.round(c * f);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Escala de ejes: enteros (conteos) o numérica. */
export function computeAxis({ min = 0, max = 1, count = 4, integer = false }) {
  if (integer) {
    const lo = Math.max(0, Math.floor(min));
    const hi = Math.max(lo + 1, Math.ceil(max));
    const span = hi - lo;
    let step = Math.max(1, Math.ceil(span / count));
    const magnitude = 10 ** Math.floor(Math.log10(step));
    const fraction = step / magnitude;
    step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude;
    const top = Math.ceil(hi / step) * step;
    const ticks = [];
    for (let v = lo; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 1e9) / 1e9);
    return { min: lo, max: top === lo ? lo + step : top, ticks };
  }

  const lo = Math.min(min, 0);
  const hi = Math.max(max, lo + 1e-9);
  const pad = (hi - lo) * 0.08 || 1;
  const start = Math.max(0, lo - pad);
  const end = hi + pad;
  const step = (end - start) / count;
  const ticks = Array.from({ length: count + 1 }, (_, i) => start + step * i);
  return { min: start, max: end, ticks };
}

/** Convierte un histograma {xs, counts, probs} en bandas [{x, p}]. */
export function binsFromHistogram(histogram) {
  if (!histogram?.xs) return [];
  return histogram.xs.map((x, i) => ({ x, p: histogram.probs[i] ?? 0 }));
}

/**
 * Geometría de un histograma agrupado.
 *
 * @param {object} spec
 * @param {Array<{label: string, color: string, bins: Array<{x: number, p: number}>}>} spec.series
 * @returns objeto con bandas, barras y ticks (compartido por pantalla y export)
 */
export function histogramGeometry(spec, { width, height, pad }) {
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  let xMin = Infinity;
  let xMax = -Infinity;
  let pMax = 0;
  for (const s of spec.series) {
    for (const bin of s.bins) {
      if (bin.x < xMin) xMin = bin.x;
      if (bin.x > xMax) xMax = bin.x;
      if (bin.p > pMax) pMax = bin.p;
    }
  }
  if (!Number.isFinite(xMin)) {
    return { empty: true, xMin: 0, xMax: 1, y: { min: 0, max: 1, ticks: [0, 1] }, bars: [], xTicks: [] };
  }

  const y = computeAxis({ min: 0, max: pMax * 1.12, count: 4, integer: false });
  const bandCount = xMax - xMin + 1;
  const band = plotW / bandCount;
  const groupRatio = 0.78;
  const barW = (band * groupRatio) / Math.max(1, spec.series.length);

  const bars = [];
  spec.series.forEach((s, si) => {
    for (const bin of s.bins) {
      if (bin.p <= 0) continue;
      const h = ((bin.p - y.min) / (y.max - y.min)) * plotH;
      const x = pad.left + (bin.x - xMin) * band + band * ((1 - groupRatio) / 2) + si * barW;
      bars.push({ key: `${si}-${bin.x}`, x, y: pad.top + plotH - h, w: Math.max(1, barW - 1), h, color: s.color, label: s.label, xValue: bin.x, p: bin.p });
    }
  });

  // Etiquetas del eje X: máximo 12, siempre enteros
  const xTicks = [];
  const stride = Math.max(1, Math.ceil(bandCount / 12));
  for (let v = xMin; v <= xMax; v += stride) xTicks.push({ v, x: pad.left + (v - xMin + 0.5) * band });
  if (bandCount <= 12 && !xTicks.some((t) => t.v === xMax)) {
    xTicks.push({ v: xMax, x: pad.left + (xMax - xMin + 0.5) * band });
  }

  return { empty: false, xMin, xMax, band, bandCount, plotW, plotH, y, bars, xTicks };
}

function esc(text) {
  // Se arman con charCode: los literales de entidad se normalizan al escribir.
  const amp = String.fromCharCode(38);
  const lt = String.fromCharCode(60);
  const gt = String.fromCharCode(62);
  const quote = String.fromCharCode(34);
  return String(text)
    .replace(/&/g, `${amp}amp;`)
    .replace(/</g, `${lt}lt;`)
    .replace(/>/g, `${gt}gt;`)
    .replace(/"/g, `${quote}quot;`);
}

function histogramMarkup(spec, { width, height, pad, title, subtitle, xLabel, yLabel }) {
  const geo = histogramGeometry(spec, { width, height, pad });
  const plotH = height - pad.top - pad.bottom;
  const out = [];

  out.push(
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`
  );
  out.push(
    `<text x="${pad.left}" y="24" font-family="${FONT}" font-size="16" font-weight="700" fill="#14171c">${esc(title)}</text>`
  );
  if (subtitle) {
    out.push(
      `<text x="${pad.left}" y="42" font-family="${FONT}" font-size="11.5" fill="#5b6169">${esc(subtitle)}</text>`
    );
  }

  if (geo.empty) {
    out.push(
      `<text x="${width / 2}" y="${height / 2}" font-family="${FONT}" font-size="13" fill="#5b6169" text-anchor="middle">Sin datos</text>`
    );
    return out.join('\n');
  }

  const top = subtitle ? pad.top + 14 : pad.top;

  for (const tick of geo.y.ticks) {
    const yy = top + plotH - ((tick - geo.y.min) / (geo.y.max - geo.y.min)) * plotH;
    out.push(
      `<line x1="${pad.left}" y1="${yy}" x2="${width - pad.right}" y2="${yy}" stroke="#e7e9ed" stroke-width="1"/>`
    );
    out.push(
      `<text x="${pad.left - 7}" y="${yy}" font-family="${FONT}" font-size="11" fill="#40454c" text-anchor="end" dominant-baseline="middle">${tick}</text>`
    );
  }

  const axisY = top + plotH;
  out.push(
    `<line x1="${pad.left}" y1="${axisY}" x2="${width - pad.right}" y2="${axisY}" stroke="#6b717a" stroke-width="1.2"/>`
  );
  out.push(
    `<line x1="${pad.left}" y1="${top}" x2="${pad.left}" y2="${axisY}" stroke="#6b717a" stroke-width="1.2"/>`
  );

  for (const tick of geo.xTicks) {
    out.push(
      `<text x="${tick.x}" y="${axisY + 16}" font-family="${FONT}" font-size="11" fill="#40454c" text-anchor="middle">${tick.v}</text>`
    );
  }

  for (const bar of geo.bars) {
    const y = top + (bar.y - pad.top);
    out.push(
      `<rect x="${bar.x}" y="${y}" width="${bar.w}" height="${Math.max(0.6, bar.h)}" fill="${posterColor(bar.color)}" rx="1"/>`
    );
  }

  if (xLabel) {
    out.push(
      `<text x="${pad.left + geo.plotW / 2}" y="${height - 6}" font-family="${FONT}" font-size="11.5" fill="#5b6169" text-anchor="middle">${esc(xLabel)}</text>`
    );
  }
  if (yLabel) {
    const cy = top + plotH / 2;
    out.push(
      `<text x="14" y="${cy}" font-family="${FONT}" font-size="11.5" fill="#5b6169" text-anchor="middle" transform="rotate(-90 14 ${cy})">${esc(yLabel)}</text>`
    );
  }

  // Leyenda
  let lx = pad.left;
  const ly = height - 24;
  for (const s of spec.series) {
    out.push(`<rect x="${lx}" y="${ly - 8}" width="11" height="11" rx="2" fill="${posterColor(s.color)}"/>`);
    out.push(
      `<text x="${lx + 15}" y="${ly + 1}" font-family="${FONT}" font-size="11" fill="#2b3037">${esc(s.label)}</text>`
    );
    lx += 15 + s.label.length * 6.6 + 18;
  }

  return out.join('\n');
}

/** SVG de histograma en estilo póster, listo para descargar. */
export function histogramSvgString({
  title,
  subtitle,
  xLabel = '',
  yLabel = '',
  series,
  width = 820,
  height = 470,
  footnote = '',
}) {
  const pad = { left: 58, right: 18, top: 54, bottom: 54 };
  const body = histogramMarkup(
    { series },
    { width, height, pad, title, subtitle, xLabel, yLabel }
  );
  const foot = footnote
    ? `<text x="${width - 18}" y="${height - 8}" font-family="${FONT}" font-size="9.5" fill="#8b9096" text-anchor="end">${esc(footnote)}</text>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${body}\n${foot}\n</svg>`;
}

/** SVG de curvas (series temporales / TV) en estilo póster. */
export function lineSvgString({
  title,
  subtitle = '',
  xLabel = '',
  yLabel = '',
  series,
  yDomain,
  integerTicks = false,
  xValues,
  width = 820,
  height = 420,
  footnote = '',
}) {
  const pad = { left: 62, right: 18, top: 54, bottom: 54 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const top = subtitle ? pad.top + 14 : pad.top;

  const lengths = series.map((s) => s.values.length);
  const n = lengths.length ? Math.max(...lengths) : 0;
  const out = [`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`];

  out.push(
    `<text x="${pad.left}" y="24" font-family="${FONT}" font-size="16" font-weight="700" fill="#14171c">${esc(title)}</text>`
  );
  if (subtitle) {
    out.push(
      `<text x="${pad.left}" y="42" font-family="${FONT}" font-size="11.5" fill="#5b6169">${esc(subtitle)}</text>`
    );
  }

  if (n === 0) {
    out.push(
      `<text x="${width / 2}" y="${height / 2}" font-family="${FONT}" font-size="13" fill="#5b6169" text-anchor="middle">Sin datos</text>`
    );
  } else {
    let lo;
    let hi;
    if (yDomain) {
      [lo, hi] = yDomain;
    } else {
      let min = Infinity;
      let max = -Infinity;
      for (const s of series) {
        for (const v of s.values) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      lo = Math.max(0, min);
      hi = max;
    }
    const axis = computeAxis({ min: lo, max: hi, count: 4, integer: integerTicks });

    for (const tick of axis.ticks) {
      const yy = top + plotH - ((tick - axis.min) / (axis.max - axis.min)) * plotH;
      out.push(
        `<line x1="${pad.left}" y1="${yy}" x2="${width - pad.right}" y2="${yy}" stroke="#e7e9ed" stroke-width="1"/>`
      );
      out.push(
        `<text x="${pad.left - 7}" y="${yy}" font-family="${FONT}" font-size="11" fill="#40454c" text-anchor="end" dominant-baseline="middle">${Number.isInteger(tick) ? tick : tick.toFixed(2)}</text>`
      );
    }

    const axisY = top + plotH;
    out.push(
      `<line x1="${pad.left}" y1="${axisY}" x2="${width - pad.right}" y2="${axisY}" stroke="#6b717a" stroke-width="1.2"/>`
    );

    const xAt = (i) => pad.left + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
    const yAt = (v) => top + plotH - ((v - axis.min) / (axis.max - axis.min)) * plotH;

    const xTickIdx = [
      ...new Set([0, Math.floor((n - 1) / 3), Math.floor((2 * (n - 1)) / 3), n - 1]),
    ];
    for (const i of xTickIdx) {
      const label = xValues?.[i] ?? i;
      out.push(
        `<text x="${xAt(i)}" y="${axisY + 16}" font-family="${FONT}" font-size="11" fill="#40454c" text-anchor="middle">${label}</text>`
      );
    }

    for (const s of series) {
      const points = s.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');
      out.push(
        `<polyline points="${points}" fill="none" stroke="${posterColor(s.color)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
      );
    }

    let lx = pad.left;
    const ly = height - 24;
    for (const s of series) {
      out.push(`<rect x="${lx}" y="${ly - 8}" width="11" height="11" rx="2" fill="${posterColor(s.color)}"/>`);
      out.push(
        `<text x="${lx + 15}" y="${ly + 1}" font-family="${FONT}" font-size="11" fill="#2b3037">${esc(s.label)}</text>`
      );
      lx += 15 + s.label.length * 6.6 + 18;
    }

    if (xLabel) {
      out.push(
        `<text x="${pad.left + plotW / 2}" y="${height - 6}" font-family="${FONT}" font-size="11.5" fill="#5b6169" text-anchor="middle">${esc(xLabel)}</text>`
      );
    }
    if (yLabel) {
      const cy = top + plotH / 2;
      out.push(
        `<text x="14" y="${cy}" font-family="${FONT}" font-size="11.5" fill="#5b6169" text-anchor="middle" transform="rotate(-90 14 ${cy})">${esc(yLabel)}</text>`
      );
    }
  }

  const foot = footnote
    ? `<text x="${width - 18}" y="${height - 8}" font-family="${FONT}" font-size="9.5" fill="#8b9096" text-anchor="end">${esc(footnote)}</text>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${out.join('\n')}\n${foot}\n</svg>`;
}

/** Descarga un Blob con el nombre dado. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadSvg(svgString, filename) {
  downloadBlob(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }), filename);
}

/** Convierte un SVG en PNG (fondo blanco, escala 2×) y lo descarga. */
export function downloadPng(svgString, filename, scale = 2) {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((png) => {
      if (png) downloadBlob(png, filename);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };
  image.onerror = () => URL.revokeObjectURL(url);
  image.src = url;
}

/** CSV con cabecera. */
export function downloadCsv({ header, rows }, filename) {
  const escape = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [header.map(escape).join(';')];
  for (const row of rows) lines.push(row.map(escape).join(';'));
  downloadBlob(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), filename);
}
