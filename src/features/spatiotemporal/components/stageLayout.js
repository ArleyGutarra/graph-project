/**
 * Disposición de las posiciones x₀ … x_{m−1} del croquis en el lienzo 500×400.
 *
 * Por defecto las m posiciones forman un anillo (el dibujo de siempre). Cuando
 * el usuario arrastra un nodo en la vista Configurar, la posición que ese
 * vértice ocupa se guarda en `config.layout` y a partir de ahí el anillo queda
 * libre: puedes colocar los xᵢ donde quieras, sin tocar la topología de X ni
 * la lógica de la cadena (sólo cambian las coordenadas de dibujo).
 *
 * Todo aquí es puro y sin DOM, para poder probarlo con Node.
 */

export const CANVAS = { width: 500, height: 400 };

/** Centro y radio del anillo por defecto (idénticos al diseño original). */
const RING = { cx: 250, cy: 198, radius: 153 };

/** Margen para que ni el nodo (r ≈ 22) ni su aro (r = 30) se salgan del lienzo. */
export const MARGIN = 38;

/** Anillo regular de m posiciones: empieza arriba y va en sentido horario. */
export function defaultRingLayout(m) {
  return Array.from({ length: m }, (_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / m;
    return {
      x: RING.cx + RING.radius * Math.cos(angle),
      y: RING.cy + RING.radius * Math.sin(angle),
    };
  });
}

/**
 * Combina el anillo por defecto con la disposición guardada (si la hay).
 * Si m crece, las posiciones nuevas reciben coordenadas del anillo; si m
 * decrece, se ignoran las que sobran.
 */
export function buildLayout(m, stored) {
  const base = defaultRingLayout(m);
  if (!Array.isArray(stored)) return base;
  for (let i = 0; i < Math.min(m, stored.length); i++) {
    const point = stored[i];
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      base[i] = { x: point.x, y: point.y };
    }
  }
  return base;
}

/** Guarda las coordenadas de un arrastre, dentro de los márgenes del lienzo. */
export function clampToCanvas(point) {
  return {
    x: Math.min(Math.max(point.x, MARGIN), CANVAS.width - MARGIN),
    y: Math.min(Math.max(point.y, MARGIN), CANVAS.height - MARGIN),
  };
}

/** Índice de la posición más cercana a un punto (para Shift + arrastrar). */
export function nearestPosition(layout, point) {
  let best = 0;
  let bestDistance = Infinity;
  layout.forEach((p, index) => {
    const distance = (p.x - point.x) ** 2 + (p.y - point.y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

/** ¿Se movió lo bastante como para contar como arrastre (y no como clic)? */
export function isDrag(from, to) {
  if (!from || !to) return false;
  return (from.x - to.x) ** 2 + (from.y - to.y) ** 2 > 16; // > 4 px
}
