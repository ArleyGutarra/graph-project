// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import SimulationPage from '../components/SimulationPage';

/**
 * Test de humo: renderiza la página completa (cabecera, vista 1, vista 2,
 * pestañas del panel de análisis) para detectar errores en tiempo de
 * ejecución que el lint y los tests unitarios del motor no ven.
 */

let container;
let root;

async function render() {
  await act(async () => {
    root.render(<SimulationPage />);
  });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('SimulationPage', () => {
  it('renderiza la cabecera y la vista 1 · Configurar escenario', async () => {
    await render();

    expect(container.textContent).toContain('Ergodicidad y convergencia en redes espacio-temporales');
    expect(container.textContent).toContain('1. Configurar escenario');
    expect(container.textContent).toContain('2. Simular y analizar');
    expect(container.textContent).toContain('▶ Generar trayectoria');

    // Las tres tarjetas de configuración
    expect(container.querySelectorAll('.config-card')).toHaveLength(3);
    expect(container.textContent).toContain('Acciones rápidas para G₀');
    expect(container.textContent).toContain('Parámetros del modelo');
    expect(container.textContent).toContain('Validación de hipótesis');

    // Rejilla de validación con los ítems del Teorema
    expect(container.querySelectorAll('.validator-item').length).toBeGreaterThanOrEqual(5);

    // Barra de las 5 herramientas (el grupo "Herramientas", sin Deshacer/Rehacer)
    const toolsGroup = container.querySelector('[aria-label="Herramientas"]');
    const tools = [...toolsGroup.querySelectorAll('.toolbar__button')].map((b) => b.textContent);
    expect(tools).toEqual(['✥ Mover', '+ Nodo', '☍ Arista', '✎ Pintar', '✕ Borrar']);

    // Historial de ediciones del grafo
    const historyGroup = container.querySelector('[aria-label="Historial de ediciones"]');
    const historyButtons = [...historyGroup.querySelectorAll('.toolbar__button')].map(
      (b) => b.textContent
    );
    expect(historyButtons).toEqual(['↶ Deshacer', '↷ Rehacer']);

    // El escenario dibuja G₀ (6 vértices para X = C₆)
    expect(container.querySelectorAll('.stage__vertex')).toHaveLength(6);
  });

  it('la hipótesis válida se muestra en verde (π* única garantizada)', async () => {
    await render();
    const bad = container.querySelectorAll('.validator-item.is-bad');
    expect(bad).toHaveLength(0);
    expect(container.textContent).toContain('π*');
  });

  it('cambia a la vista 2 y muestra transporte, gráficas e inspector', async () => {
    await render();

    const stepperButtons = [...container.querySelectorAll('.stepper__button')];
    await act(async () => {
      stepperButtons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Transporte tipo vídeo
    const transport = [...container.querySelectorAll('.transport__row .playback__button')].map(
      (b) => b.textContent
    );
    expect(transport).toContain('|◀');
    expect(transport).toContain('« −5');
    expect(transport).toContain('‹ −1');
    expect(transport).toContain('▶ Reproducir');
    expect(transport).toContain('+1 ›');
    expect(transport).toContain('+5 »');
    expect(transport).toContain('▶|');
    expect(transport).toContain('+1000 pasos');

    // Opciones de reproducción
    expect(container.textContent).toContain('Velocidad');
    expect(container.textContent).toContain('Micro-pasos (t⁻ → t⁺)');
    expect(container.textContent).toContain('Mostrar cambios (Diff)');

    // Gráficas y Estacionaria viven en UNA sola sección, sin pestañas
    expect(container.querySelectorAll('.tab')).toHaveLength(0);
    expect(container.querySelectorAll('.analysis__section')).toHaveLength(2);
    expect(container.textContent).toContain('Gráficas de evolución');
    expect(container.textContent).toContain('Estacionaria π* · verificación');

    // Gráficas + tarjeta de estimación
    expect(container.querySelectorAll('.chart').length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).toContain('Estimación empírica de π*');
    expect(container.textContent).toContain('Rueda: zoom · Clic: saltar a t');

    // La columna del Inspector está abierta por defecto
    expect(container.querySelector('.analysis__inspector')).not.toBeNull();
    expect(container.querySelector('.analysis__splitter')).not.toBeNull();
  });

  it('el divisor abre y cierra la columna del Inspector al arrastrarlo', async () => {
    await render();

    // El panel de análisis sólo existe en la vista 2
    const stepperButtons = [...container.querySelectorAll('.stepper__button')];
    await act(async () => {
      stepperButtons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const analysis = container.querySelector('.analysis');
    analysis.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 800,
      right: 800,
      height: 600,
      bottom: 600,
    });

    const splitter = () => container.querySelector('.analysis__splitter');
    const inspector = () => container.querySelector('.analysis__inspector');

    // Arrastrar hacia la derecha (por debajo del umbral) cierra la columna
    await act(async () => {
      splitter().dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, clientX: 780, pointerId: 1 })
      );
    });
    await act(async () => {
      splitter().dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, clientX: 770, pointerId: 1 })
      );
    });
    await act(async () => {
      splitter().dispatchEvent(
        new MouseEvent('pointerup', { bubbles: true, clientX: 770, pointerId: 1 })
      );
    });
    expect(inspector()).toBeNull();

    // Arrastrar hacia la izquierda lo vuelve a abrir y fija el ancho
    await act(async () => {
      splitter().dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, clientX: 790, pointerId: 2 })
      );
    });
    await act(async () => {
      splitter().dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, clientX: 420, pointerId: 2 })
      );
    });
    await act(async () => {
      splitter().dispatchEvent(
        new MouseEvent('pointerup', { bubbles: true, clientX: 420, pointerId: 2 })
      );
    });

    const reopened = inspector();
    expect(reopened).not.toBeNull();
    // rect.right (800) − clientX (420) = 380 px, dentro de [300, 460]
    expect(parseFloat(reopened.style.width)).toBe(380);
  });

  it('muestra la sección Estacionaria con sus tres bloques', async () => {
    await render();

    const stepperButtons = [...container.querySelectorAll('.stepper__button')];
    await act(async () => {
      stepperButtons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Los tres bloques del modo Estacionaria (criterios 1, 2 y 3). El 1 sólo
    // muestra su cabecera cuando ya hay resultado, así que se espera el aviso.
    expect(container.textContent).toContain('Ejecuta Calcular π* para obtener los histogramas');
    expect(container.textContent).toContain('Invariancia frente a π₀');
    expect(container.textContent).toContain('Cálculo exacto para n = 3');

    // Disparadores con T, burn-in, semilla y ε editables
    expect(container.textContent).toContain('Pasos T');
    expect(container.textContent).toContain('Burn-in B');
    expect(container.textContent).toContain('ε (TV)');
    expect(container.textContent).toContain('Calcular π* (1 cadena)');
    expect(container.textContent).toContain('3 cadenas con π₀ distinto');

    // Las tres condiciones iniciales del póster
    expect(container.textContent).toContain('K̄ₙ');
    expect(container.textContent).toContain('K₁,ₙ₋₁');

    // Aviso de que el cálculo exacto necesita n = 3 (criterio 4)
    expect(container.textContent).toContain('requiere n = 3');
  });

  it('el Inspector muestra las tres secciones y pide un primer paso', async () => {
    await render();

    const stepperButtons = [...container.querySelectorAll('.stepper__button')];
    await act(async () => {
      stepperButtons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('después del primer avance');
  });

  it('el escenario admite los atajos de teclado y BORRAR no mueve X', async () => {
    await render();
    const nodes = () => container.querySelectorAll('.stage__vertex').length;
    const rings = () => container.querySelectorAll('.stage__ring').length;

    // X = C₆ con 6 vértices: anillo de 6 posiciones
    expect(nodes()).toBe(6);
    expect(rings()).toBe(6);

    // "+" añade un vértice; como X está llena, el croquis crece a m = 7
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    });
    expect(nodes()).toBe(7);
    expect(rings()).toBe(7);

    // Clic izquierdo sobre un nodo lo selecciona…
    await act(async () => {
      container
        .querySelector('.stage__vertex')
        .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });

    // …y Supr lo quita (7 → 6). X NO se toca: el anillo sigue teniendo 7
    // posiciones, así que el resto de vértices no se reubica.
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    });
    expect(nodes()).toBe(6);
    expect(rings()).toBe(7);

    // Ctrl+Z deshace la modificación del grafo…
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
      );
    });
    expect(nodes()).toBe(7);

    // …y Ctrl+Y la rehace.
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true })
      );
    });
    expect(nodes()).toBe(6);
  });

  it('el arrastre libre con clic izquierdo mueve el nodo y su posición xᵢ', async () => {
    await render();

    // jsdom no calcula cajas: se le asigna la del viewBox 500×400
    const svg = container.querySelector('svg');
    svg.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 500,
      height: 400,
      right: 500,
      bottom: 400,
    });

    const read = () => {
      const circle = container.querySelector('.stage__vertex .stage__node');
      return [Number(circle.getAttribute('cx')), Number(circle.getAttribute('cy'))];
    };
    const [x0, y0] = read();

    // Se mantiene pulsado el clic izquierdo sobre el nodo y se arrastra
    await act(async () => {
      container
        .querySelector('.stage__vertex')
        .dispatchEvent(
          new MouseEvent('pointerdown', { bubbles: true, clientX: 250, clientY: 45 })
        );
    });
    await act(async () => {
      svg.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, clientX: 420, clientY: 330 })
      );
    });
    await act(async () => {
      svg.dispatchEvent(
        new MouseEvent('pointerup', { bubbles: true, clientX: 420, clientY: 330 })
      );
    });

    const [x1, y1] = read();
    expect([x1, y1]).not.toEqual([x0, y0]);
    expect([x1, y1]).toEqual([420, 330]);

    // El aro xᵢ se mueve CON el nodo (la topología de X no cambia)
    const ring = container.querySelector('.stage__ring');
    expect(Number(ring.getAttribute('cx'))).toBe(420);
    expect(Number(ring.getAttribute('cy'))).toBe(330);
    expect(container.querySelectorAll('.stage__ring')).toHaveLength(6);

    // Y sigue habiendo 6 vértices: el arrastre no añade ni quita nada
    expect(container.querySelectorAll('.stage__vertex')).toHaveLength(6);
  });

  it('Shift + arrastre reasigna p₀(v) a la xⱼ más cercana sin mover el anillo', async () => {
    await render();

    const svg = container.querySelector('svg');
    svg.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 500,
      height: 400,
      right: 500,
      bottom: 400,
    });

    const label = () =>
      container.querySelector('.stage__vertex .stage__pos-label').textContent;
    expect(label()).toContain('₀'); // v₀ empieza en x₀

    await act(async () => {
      container
        .querySelector('.stage__vertex')
        .dispatchEvent(
          new MouseEvent('pointerdown', {
            bubbles: true,
            clientX: 250,
            clientY: 45,
            shiftKey: true,
          })
        );
    });
    await act(async () => {
      svg.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, clientX: 382, clientY: 274 })
      );
    });
    await act(async () => {
      svg.dispatchEvent(
        new MouseEvent('pointerup', { bubbles: true, clientX: 382, clientY: 274 })
      );
    });

    // (382, 274) es la x₂ del anillo → p₀(v₀) = 2
    expect(label()).toContain('₂');

    // El anillo no se mueve en un arrastre con Shift (x₀ sigue en 250)
    const ring = container.querySelector('.stage__ring');
    expect(Number(ring.getAttribute('cx'))).toBe(250);
  });

  it('el doble clic abre el renombrado en línea y Enter lo guarda', async () => {
    await render();

    await act(async () => {
      container
        .querySelector('.stage__vertex')
        .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });

    const input = container.querySelector('.stage__rename');
    expect(input).not.toBeNull();
    expect(input.value).toBe('0');

    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      setter.call(input, 'centro');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(container.querySelector('.stage__rename')).toBeNull();
    expect(container.textContent).toContain('centro');
  });

  it('los atajos no actúan cuando el paso está oculto (portada / fundamentos)', async () => {
    const HiddenPage = () => (
      <div className="step" hidden>
        <SimulationPage />
      </div>
    );

    await act(async () => {
      root.render(<HiddenPage />);
    });

    const before = container.querySelectorAll('.stage__vertex').length;
    expect(before).toBe(6);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    });

    expect(container.querySelectorAll('.stage__vertex')).toHaveLength(before);
  });

  it('el pintar aplica el color elegido con un solo clic', async () => {
    await render();

    const paintTool = [...container.querySelectorAll('.toolbar__button')].find((b) =>
      b.textContent.includes('Pintar')
    );
    await act(async () => {
      paintTool.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Se activan los swatches
    expect(container.querySelectorAll('.swatch').length).toBeGreaterThanOrEqual(3);
    const swatch = container.querySelectorAll('.swatch')[2];
    await act(async () => {
      swatch.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const before = container.querySelector('.stage__vertex .stage__node').getAttribute('fill');
    await act(async () => {
      container
        .querySelector('.stage__vertex')
        .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });
    const after = container.querySelector('.stage__vertex .stage__node').getAttribute('fill');

    expect(before).not.toBe(after);
  });

  it('avanza la cadena y el Inspector deja de mostrar el aviso', async () => {
    await render();

    const stepperButtons = [...container.querySelectorAll('.stepper__button')];
    await act(async () => {
      stepperButtons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const stepButtons = [...container.querySelectorAll('.transport__row .playback__button')];
    const forward = stepButtons.find((b) => b.textContent === '+1 ›');
    await act(async () => {
      forward.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Desplazamiento');
    expect(container.textContent).toContain('Actualización de aristas');
    expect(container.textContent).toContain('Composición ordenada');
    expect(container.textContent).not.toContain('después del primer avance');
  });
});
