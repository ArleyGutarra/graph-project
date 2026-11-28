import { describe, expect, it } from 'vitest';
import {
  CANVAS,
  MARGIN,
  buildLayout,
  clampToCanvas,
  defaultRingLayout,
  isDrag,
  nearestPosition,
} from '../components/stageLayout';

describe('disposición de las posiciones xᵢ', () => {
  it('el anillo por defecto tiene m puntos dentro del lienzo y empieza arriba', () => {
    const layout = defaultRingLayout(6);
    expect(layout).toHaveLength(6);

    for (const p of layout) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(CANVAS.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(CANVAS.height);
    }

    // x₀ arranca en la parte superior del anillo
    expect(layout[0].x).toBeCloseTo(250, 5);
    expect(layout[0].y).toBeLessThan(198);
  });

  it('sin disposición guardada devuelve exactamente el anillo', () => {
    expect(buildLayout(6, null)).toEqual(defaultRingLayout(6));
    expect(buildLayout(6, undefined)).toEqual(defaultRingLayout(6));
  });

  it('la disposición guardada sustituye al anillo', () => {
    const stored = [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50, y: 60 },
      { x: 70, y: 80 },
      { x: 90, y: 100 },
      { x: 110, y: 120 },
    ];
    const layout = buildLayout(6, stored);
    expect(layout).toEqual(stored);
    // y no comparte referencias: mover el layout no muta lo guardado
    layout[0].x = 999;
    expect(stored[0].x).toBe(10);
  });

  it('si m crece, las posiciones nuevas toman el anillo; si decrece, se recortan', () => {
    const stored = Array.from({ length: 4 }, (_, i) => ({ x: i * 10, y: i * 10 }));

    const grown = buildLayout(6, stored);
    expect(grown).toHaveLength(6);
    expect(grown[0]).toEqual({ x: 0, y: 0 });
    expect(grown[3]).toEqual({ x: 30, y: 30 });
    // las dos nuevas vienen del anillo
    expect(grown[4]).toEqual(defaultRingLayout(6)[4]);
    expect(grown[5]).toEqual(defaultRingLayout(6)[5]);

    const shrunk = buildLayout(3, stored);
    expect(shrunk).toHaveLength(3);
    expect(shrunk[2]).toEqual({ x: 20, y: 20 });
  });

  it('ignora entradas corruptas del almacenamiento', () => {
    const layout = buildLayout(4, [null, { x: NaN, y: 1 }, 'roto', { x: 5, y: 6 }]);
    expect(layout[0]).toEqual(defaultRingLayout(4)[0]);
    expect(layout[1]).toEqual(defaultRingLayout(4)[1]);
    expect(layout[2]).toEqual(defaultRingLayout(4)[2]);
    expect(layout[3]).toEqual({ x: 5, y: 6 });
  });
});

describe('arrastre libre', () => {
  it('clampa al lienzo para que ni el nodo ni su aro se salgan', () => {
    expect(clampToCanvas({ x: -500, y: -500 })).toEqual({ x: MARGIN, y: MARGIN });
    expect(clampToCanvas({ x: 9999, y: 9999 })).toEqual({
      x: CANVAS.width - MARGIN,
      y: CANVAS.height - MARGIN,
    });
    expect(clampToCanvas({ x: 250, y: 200 })).toEqual({ x: 250, y: 200 });
  });

  it('nearestPosition devuelve el índice más cercano', () => {
    const layout = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ];
    expect(nearestPosition(layout, { x: 90, y: 5 })).toBe(1);
    expect(nearestPosition(layout, { x: 5, y: 90 })).toBe(2);
    expect(nearestPosition(layout, { x: 1, y: 1 })).toBe(0);
  });

  it('un clic suelto no cuenta como arrastre (umbral de 4 px)', () => {
    expect(isDrag(null, { x: 1, y: 1 })).toBe(false);
    expect(isDrag({ x: 10, y: 10 }, { x: 11, y: 11 })).toBe(false);
    expect(isDrag({ x: 10, y: 10 }, { x: 40, y: 40 })).toBe(true);
  });
});
