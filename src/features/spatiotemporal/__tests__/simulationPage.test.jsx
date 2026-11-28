// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../../../App';
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

    // Sin barra de herramientas: los gestos son directos
    expect(container.querySelector('[aria-label="Herramientas"]')).toBeNull();

    // Historial de ediciones del grafo (los atajos siguen en Ctrl+Z / Ctrl+Y)
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

  it('el divisor abre y cierra la columna del Inspector (la Estacionaria ya no está aquí)', async () => {
    await render();

    // El panel de análisis sólo existe en la vista 2
    const stepperButtons = [...container.querySelectorAll('.stepper__button')];
    await act(async () => {
      stepperButtons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // jsdom no calcula cajas: se le asigna la del panel de análisis
    const analysis = container.querySelector('.analysis');
    analysis.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 1010,
      right: 1010,
      height: 600,
      bottom: 600,
    });

    const divider = () => container.querySelector('.analysis__splitter');
    const inspector = () => container.querySelector('.analysis__inspector');
    const width = (el) => parseFloat(el.style.width);

    const drag = async (from, to, id) => {
      const fire = async (type, clientX) => {
        await act(async () => {
          divider().dispatchEvent(
            new MouseEvent(type, { bubbles: true, clientX, pointerId: id })
          );
        });
      };
      await fire('pointerdown', from);
      await fire('pointermove', to);
      await fire('pointerup', to);
    };

    // Sólo queda UN divisor: la Estacionaria se mudó a su sección inferior
    expect(container.querySelectorAll('.analysis__splitter')).toHaveLength(1);
    expect(container.querySelector('.analysis__stationary')).toBeNull();

    // Estado inicial: Inspector abierto a 380 px
    expect(width(inspector())).toBe(380);
    expect(container.querySelector('main').className).toContain('has-1col');

    // El botón derecho sobre el divisor NO lo arrastra
    await act(async () => {
      divider().dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, clientX: 500, button: 2 })
      );
    });
    expect(width(inspector())).toBe(380);

    // Arrastrar a la derecha lo cierra...
    await drag(700, 1000, 1);
    expect(width(inspector())).toBe(0);
    expect(container.querySelector('main').className).not.toContain('has-');

    // ... y arrastrarlo a la izquierda lo vuelve a abrir
    await drag(700, 400, 2);
    expect(width(inspector())).toBe(300);

    // La columna sigue montada con ancho 0: no se pierde su estado
    expect(inspector().querySelector('.inspector')).not.toBeNull();
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

  it('la Estacionaria vive en una sección inferior a todo el ancho, fuera del análisis', async () => {
    await render();

    const stepperButtons = [...container.querySelectorAll('.stepper__button')];
    await act(async () => {
      stepperButtons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const aside = container.querySelector('aside');
    const section = container.querySelector('.cell--stationary');

    // Existe en la vista 2 y va DESPUÉS del panel lateral, sin estar dentro
    expect(section).not.toBeNull();
    expect(section.previousElementSibling).toBe(aside);
    expect(aside.contains(section)).toBe(false);

    // Dentro del panel de análisis no queda nada de Estacionaria: ése era
    // el que dejaba el hueco vacío al lado de las gráficas
    expect(container.querySelector('.analysis__stationary')).toBeNull();
    expect(container.querySelector('.analysis .stationary')).toBeNull();
    expect(section.querySelector('.stationary')).not.toBeNull();

    // Cabecera propia + bloques 2 y 3 (el 1 sólo aparece con resultados)
    expect(section.querySelector('.analysis__section').textContent).toContain(
      'Estacionaria π* · verificación'
    );
    expect(section.querySelectorAll('.stationary__block').length).toBeGreaterThanOrEqual(2);
    expect(section.textContent).toContain('Invariancia frente a π₀');
    expect(section.textContent).toContain('Cálculo exacto para n = 3');
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

  it('Mayús + + añade varios nodos de una vez (y Ctrl+Z los quita todos juntos)', async () => {
    await render();
    const nodes = () => container.querySelectorAll('.stage__vertex').length;
    const rings = () => container.querySelectorAll('.stage__ring').length;

    expect(nodes()).toBe(6);

    // Se dejan 3 nodos para que el lote de 5 quepa sin tocar el tope de X
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        container
          .querySelector('.stage__vertex')
          .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      });
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
      });
    }
    expect(nodes()).toBe(3);

    // Un solo Mayús + + → 3 + 5 = 8 vértices (el croquis crece m → m+1)
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '+', shiftKey: true, bubbles: true })
      );
    });
    expect(nodes()).toBe(8);
    expect(rings()).toBe(8);

    // Es UNA entrada de historial: Ctrl+Z devuelve los 5 de una sola vez
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
      );
    });
    expect(nodes()).toBe(3);
    expect(rings()).toBe(6);
  });

  it('el toolbar añade la cantidad indicada de nodos', async () => {
    await render();

    const field = container.querySelector('#add-nodes');
    expect(field).not.toBeNull();
    expect(field.value).toBe('1');

    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      setter.call(field, '2');
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      [...container.querySelectorAll('.toolbar__button')]
        .find((button) => button.textContent.includes('＋ Añadir'))
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // 6 + 2 = 8 (justo el tope del croquis X)
    expect(container.querySelectorAll('.stage__vertex')).toHaveLength(8);
    expect(container.querySelectorAll('.stage__ring')).toHaveLength(8);

    // Y Ctrl+Z los quita de una vez
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
      );
    });
    expect(container.querySelectorAll('.stage__vertex')).toHaveLength(6);
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

  it('la columna del Inspector tiene su botón ✕ para cerrarla', async () => {
    await render();

    const stepperButtons = [...container.querySelectorAll('.stepper__button')];
    await act(async () => {
      stepperButtons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const closeButtons = () => [...container.querySelectorAll('.analysis__close')];
    const inspector = () => container.querySelector('.analysis__inspector');
    const width = (el) => parseFloat(el.style.width);

    // Un solo ✕: el de la columna del Inspector (la Estacionaria no está
    // en esta fila: vive en su propia sección inferior, sin botón de cierre)
    expect(closeButtons()).toHaveLength(1);
    expect(closeButtons()[0].getAttribute('aria-label')).toContain('Inspector');
    expect(width(inspector())).toBe(380);

    // El ✕ cierra la columna…
    await act(async () => {
      closeButtons()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(width(inspector())).toBe(0);
    expect(container.querySelector('main').className).not.toContain('has-');

    // …y el doble clic en el divisor la vuelve a abrir
    await act(async () => {
      container
        .querySelector('.analysis__splitter')
        .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(width(inspector())).toBeGreaterThan(0);
    expect(container.querySelector('main').className).toContain('has-1col');

    // Cerrada sigue montada (sigue habiendo 1 botón ✕)
    await act(async () => {
      closeButtons()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(width(inspector())).toBe(0);
    expect(inspector().querySelector('.inspector')).not.toBeNull();
    expect(closeButtons()).toHaveLength(1);
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

  it('el renombrado por doble clic rechaza un nombre que ya usa otro nodo', async () => {
    await render();

    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const type = async (input, value) => {
      await act(async () => {
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };

    // Doble clic sobre el primer vértice → renombrado con su nombre actual
    await act(async () => {
      container
        .querySelector('.stage__vertex')
        .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });

    const input = container.querySelector('.stage__rename');
    expect(input).not.toBeNull();
    expect(input.value).toBe('0');

    // "1" ya lo usa el vértice 1: NO se guarda, se queda abierto y avisa
    await type(input, '1');
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(container.querySelector('.stage__rename')).not.toBeNull();
    expect(input.value).toBe('1');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const error = container.querySelector('.stage__rename-error');
    expect(error).not.toBeNull();
    expect(error.textContent).toContain('ya está en uso');

    // Un nombre libre sí se guarda y el aviso desaparece
    await type(input, 'norte');
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(container.querySelector('.stage__rename')).toBeNull();
    expect(container.querySelector('.stage__rename-error')).toBeNull();
    expect(container.textContent).toContain('norte');
  });

  it('dos clics de puntero seguidos sobre el mismo nodo abren el renombrado', async () => {
    await render();

    const svg = () => container.querySelector('svg');
    const click = async () => {
      await act(async () => {
        container
          .querySelector('.stage__vertex')
          .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      });
      await act(async () => {
        svg().dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      });
    };

    // Un sólo clic → sólo selecciona
    await click();
    expect(container.querySelector('.stage__rename')).toBeNull();

    // Un segundo clic en el MISMO nodo, dentro de la ventana → renombrado.
    // (En el navegador real el `dblclick` va reencuadrado al SVG por la
    // captura de puntero, así que éste es el camino que de verdad se usa.)
    await click();
    const input = container.querySelector('.stage__rename');
    expect(input).not.toBeNull();
    expect(input.value).toBe('0');
  });

  it('los atajos no actúan cuando el paso está oculto (portada)', async () => {
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

  it('el dígito del teclado pinta el vértice seleccionado (y Ctrl+Z lo deshace)', async () => {
    await render();

    const fill = () =>
      container.querySelector('.stage__vertex .stage__node').getAttribute('fill');

    // Clic izquierdo → selecciona el vértice (también es el gesto de arrastre)
    await act(async () => {
      container
        .querySelector('.stage__vertex')
        .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });

    const before = fill();

    // "2" → color C₂
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
    });
    expect(fill()).not.toBe(before);

    // Ctrl+Z lo revierte
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
      );
    });
    expect(fill()).toBe(before);
  });

  it('dos clics en vértices distintos (des)conectan la arista entre ellos', async () => {
    await render();

    const edges = () => container.querySelectorAll('.stage__edges .stage__edge').length;

    // G₀ por defecto es K₆: hay 15 aristas
    const before = edges();
    expect(before).toBe(15);

    const vertices = [...container.querySelectorAll('.stage__vertex')];
    await act(async () => {
      vertices[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });
    await act(async () => {
      vertices[1].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });

    // La arista {0,1} se borra: 15 → 14 (Ctrl+Z la devuelve)
    expect(edges()).toBe(before - 1);

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
      );
    });
    expect(edges()).toBe(before);
  });

  it('el botón derecho no hace nada en el lienzo', async () => {
    await render();

    const rightDown = (target) =>
      target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 2 }));

    const before = {
      nodes: container.querySelectorAll('.stage__vertex').length,
      edges: container.querySelectorAll('.stage__edges .stage__edge').length,
    };

    // Sobre el fondo: no añade un vértice
    await act(async () => {
      rightDown(container.querySelector('svg'));
    });

    // Sobre un nodo: no lo selecciona ni abre el renombrado
    await act(async () => {
      rightDown(container.querySelector('.stage__vertex'));
    });

    // Sobre una arista: no la borra
    await act(async () => {
      rightDown(container.querySelector('.stage__edge-hits line'));
    });

    expect(container.querySelectorAll('.stage__vertex')).toHaveLength(before.nodes);
    expect(container.querySelectorAll('.stage__edges .stage__edge')).toHaveLength(before.edges);
    expect(container.querySelectorAll('.stage__vertex.is-selected')).toHaveLength(0);
    expect(container.querySelector('.stage__rename')).toBeNull();
  });

  it('un doble clic fuera del vértice o la arista no deja ningún nodo nuevo', async () => {
    await render();

    const svg = container.querySelector('svg');
    // Sin caja jsdom no hay punto: se le da la del lienzo 500×400
    svg.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 500,
      height: 400,
      right: 500,
      bottom: 400,
    });

    const nodes = () => container.querySelectorAll('.stage__vertex').length;
    const base = nodes(); // K₆ → 6

    const click = async () => {
      await act(async () => {
        svg.dispatchEvent(
          new MouseEvent('pointerdown', { bubbles: true, clientX: 120, clientY: 90 })
        );
      });
    };

    // Un sólo clic → crea el vértice
    await click();
    expect(nodes()).toBe(base + 1);

    // Se espera a que caduque el brazo del doble clic
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    // Doble clic en el fondo → no queda NINGÚN nodo nuevo
    await click();
    await click();
    expect(nodes()).toBe(base + 1);

    // La cancelación no dejó entrada en el historial: Ctrl+Z sigue
    // deshaciendo el clic simple anterior, no un nodo fantasma
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
      );
    });
    expect(nodes()).toBe(base);
  });

  it('el click derecho no abre el menú del navegador en ninguna parte', async () => {
    await act(async () => {
      root.render(<App />);
    });

    const fire = (selector) => {
      const target = container.querySelector(selector);
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(fire('.app')).toBe(true);
    expect(fire('.hero')).toBe(true);
    expect(fire('.simulation')).toBe(true);
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
