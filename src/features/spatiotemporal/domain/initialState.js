/**
 * Estados iniciales del grafo temporal G_0 y de su coloración.
 *
 * Los tres presets reproduzcan los estados del póster (sección 04, pie de la
 * figura "Invariancia frente a π₀"):
 *   π₀⁽¹⁾ = K̄ₙ (grafo vacío, complemento de Kₙ) con coloración unánime C₁,
 *   π₀⁽²⁾ = K₁,ₙ₋₁ con coloración unánime C₂,
 *   π₀⁽³⁾ = Kₙ con coloración unánime C₀.
 *
 * Nota: el texto extraído del PDF muestra "G⁽¹⁾₀ = K₆" y "G⁽³⁾₀ = K₆" con el
 * MISMO glifo, porque una barra de complemento (K̄₆) no se extrae como texto.
 * Se adopta la lectura K̄ₙ para la primera condición: son los tres estados de
 * partida distintos que exige la verificación de independencia de π₀.
 */

export const GRAPH_PRESETS = [
  { id: 'complete', label: 'Completo Kₙ' },
  { id: 'star', label: 'Estrella K₁,ₙ₋₁' },
  { id: 'path', label: 'Camino Pₙ' },
  { id: 'empty', label: 'Grafo vacío' },
  { id: 'random', label: 'Aleatorio p = ½' },
];

export const POSITION_PRESETS = [
  { id: 'identity', label: 'Identidad (v en x_v)' },
  { id: 'random', label: 'Permutación aleatoria' },
];

/** Presets de coloración válidos para un dado número de colores (c+1). */
export function colorPresets(colorCount) {
  const presets = [];
  for (let i = 0; i < colorCount; i++) {
    presets.push({ id: `unanimous${i}`, label: `Unánime C${sub(i)}` });
  }
  presets.push({ id: 'alternating', label: `Alterna C${sub(0)}…C${sub(colorCount - 1)}` });
  presets.push({ id: 'random', label: 'Aleatoria' });
  return presets;
}

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';
function sub(i) {
  return String(i)
    .split('')
    .map((d) => SUBSCRIPTS[Number(d)])
    .join('');
}

export { sub as subscript };

/**
 * Construye el estado inicial (E(G₀), colores, posiciones).
 *
 * @param {object} opts
 * @param {number} opts.n            número de vértices de G (n = m, biyección)
 * @param {number} opts.m            número de posiciones del croquis X
 * @param {number} opts.colorCount   número de colores c+1
 * @param {string} opts.graphPreset  preset de grafo
 * @param {string} opts.colorPreset  preset de coloración
 * @param {string} opts.positionPreset preset de posiciones
 * @param {ReturnType<import('../../../shared/math/rng').createRng>} rng
 */
export function createInitialState(
  { n, m, colorCount, graphPreset, colorPreset, positionPreset, custom },
  rng
) {
  const adj = new Int32Array(n);

  const addEdge = (i, j) => {
    adj[i] |= 1 << j;
    adj[j] |= 1 << i;
  };

  switch (graphPreset) {
    case 'custom':
      // G₀ editado con las herramientas de la vista Configurar.
      for (const [i, j] of custom?.edges ?? []) {
        if (i !== j && i >= 0 && i < n && j >= 0 && j < n) addEdge(i, j);
      }
      break;
    case 'complete':
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) addEdge(i, j);
      break;
    case 'star':
      for (let j = 1; j < n; j++) addEdge(0, j);
      break;
    case 'path':
      for (let i = 0; i + 1 < n; i++) addEdge(i, i + 1);
      break;
    case 'empty':
      break;
    case 'random':
    default:
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rng.chance(0.5)) addEdge(i, j);
      break;
  }

  const color = new Uint8Array(n);
  if (colorPreset === 'custom' && custom?.colors) {
    for (let v = 0; v < n; v++) {
      const value = Number(custom.colors[v]);
      color[v] = Number.isFinite(value) ? Math.min(Math.max(0, value), colorCount - 1) : 0;
    }
  } else if (colorPreset.startsWith('unanimous')) {
    const idx = Number(colorPreset.slice('unanimous'.length)) || 0;
    const value = Math.min(idx, colorCount - 1);
    color.fill(value);
  } else if (colorPreset === 'alternating') {
    for (let v = 0; v < n; v++) color[v] = v % colorCount;
  } else {
    for (let v = 0; v < n; v++) color[v] = rng.int(colorCount);
  }

  const pos = new Uint8Array(n);
  if (positionPreset === 'custom' && custom?.positions) {
    for (let v = 0; v < n; v++) {
      const value = Number(custom.positions[v]);
      pos[v] = Number.isFinite(value)
        ? Math.min(Math.max(0, value), Math.max(0, m - 1))
        : v % Math.max(1, m);
    }
  } else if (positionPreset === 'random') {
    const slots = rng.shuffle(Array.from({ length: m }, (_, i) => i));
    for (let v = 0; v < n; v++) pos[v] = slots[v % m];
  } else {
    for (let v = 0; v < n; v++) pos[v] = v % m;
  }

  return { n, adj, color, pos };
}

/**
 * Condiciones iniciales del experimento de ergodicidad (figura del póster:
 * tres estados de partida distintos bajo el mismo modelo).
 */
export function buildConditions(colorCount) {
  const high = colorCount - 1;
  return [
    {
      id: 'pi1',
      // Complemento de Kₙ: ninguna arista (ver nota al inicio del archivo).
      label: `π₀⁽¹⁾: K̄ₙ + C${sub(1)}`,
      graphPreset: 'empty',
      colorPreset: `unanimous${Math.min(1, high)}`,
    },
    {
      id: 'pi2',
      label: `π₀⁽²⁾: K₁,ₙ₋₁ + C${sub(high)}`,
      graphPreset: 'star',
      colorPreset: `unanimous${high}`,
    },
    {
      id: 'pi3',
      label: `π₀⁽³⁾: Kₙ + C${sub(0)}`,
      graphPreset: 'complete',
      colorPreset: 'unanimous0',
    },
  ];
}
