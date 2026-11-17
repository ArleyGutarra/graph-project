/**
 * Tema visual · futurista sobre negro con luces LED (escenario y shell).
 *
 * - COLOR_PALETTE: una luz LED por clase de color de G (C₀, C₁, …).
 * - CONDITION_COLORS: paleta FORMAL para las series estadísticas
 *   (gráficas, histograma, tabla y métricas): sin brillos ni neón.
 */
export const COLOR_PALETTE = [
  '#d7dade', // C0 · LED plata
  '#ff2d3f', // C1 · LED rojo
  '#ffb020', // C2 · LED ámbar
  '#35e0ff', // C3 · LED cian
  '#9dff57', // C4 · LED verde
];

/** Colores formales de las tres condiciones iniciales del experimento. */
export const CONDITION_COLORS = ['#d1495b', '#e0a458', '#6b9ac4'];

export function colorOf(index) {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

/** Color de texto legible sobre un relleno dado (para las etiquetas de nodo). */
export function labelColorFor(hex) {
  const value = parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#0a0709' : '#ffffff';
}
