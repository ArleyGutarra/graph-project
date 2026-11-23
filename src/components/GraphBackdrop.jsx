import { useEffect, useRef } from 'react';

/**
 * Fondo decorativo de red de grafos para la portada.
 *
 * - Nodos y aristas se generan de forma determinista (semilla fija), así la red
 *   es idéntica entre renders y entre sesiones.
 * - Los nodos recorren órbitas de Lissajous alrededor de su posición base y las
 *   aristas siguen a sus extremos: la red se mueve sin despegarse nunca.
 * - El bucle escribe directamente sobre los nodos ya montados (setAttribute),
 *   sin re-render de React a 60 fps.
 * - Se detiene cuando el paso no está activo y respeta `prefers-reduced-motion`.
 */

function makeRandom(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WIDTH = 1600;
const HEIGHT = 900;
const MARGIN = 70;
const NODE_COUNT = 42;
const LINK_DISTANCE = 270;

const random = makeRandom(2026);

const nodes = Array.from({ length: NODE_COUNT }, (_, id) => ({
  id,
  x: MARGIN + random() * (WIDTH - MARGIN * 2),
  y: MARGIN + random() * (HEIGHT - MARGIN * 2),
  r: 2.4 + random() * 4.6,
  delay: random() * 4,
}));

const links = [];
for (let i = 0; i < nodes.length; i += 1) {
  for (let j = i + 1; j < nodes.length; j += 1) {
    const dx = nodes[i].x - nodes[j].x;
    const dy = nodes[i].y - nodes[j].y;
    if (Math.hypot(dx, dy) <= LINK_DISTANCE) links.push([i, j]);
  }
}

/** Amplitud y frecuencia de cada órbita (también deterministas). */
const motion = nodes.map(() => ({
  ax: 22 + random() * 33,
  ay: 20 + random() * 32,
  fx: 0.3 + random() * 0.35,
  fy: 0.28 + random() * 0.35,
  px: random() * Math.PI * 2,
  py: random() * Math.PI * 2,
}));

export default function GraphBackdrop({ active = true }) {
  const svgRef = useRef(null);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    const circles = Array.from(svg.querySelectorAll('.hero__network-nodes circle'));
    const lines = Array.from(svg.querySelectorAll('.hero__network-links line'));
    if (!circles.length) return undefined;

    const positions = new Float64Array(nodes.length * 2);
    let raf = 0;
    let start = 0;

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (!start) start = now;
      if (!activeRef.current) return;

      const t = (now - start) / 1000;

      for (let i = 0; i < nodes.length; i += 1) {
        const orbit = motion[i];
        const x = nodes[i].x + orbit.ax * Math.sin(orbit.fx * t + orbit.px);
        const y = nodes[i].y + orbit.ay * Math.sin(orbit.fy * t + orbit.py);
        positions[i * 2] = x;
        positions[i * 2 + 1] = y;

        const circle = circles[i];
        if (circle) {
          circle.setAttribute('cx', x.toFixed(1));
          circle.setAttribute('cy', y.toFixed(1));
        }
      }

      for (let k = 0; k < links.length; k += 1) {
        const line = lines[k];
        if (!line) continue;
        const [a, b] = links[k];
        line.setAttribute('x1', positions[a * 2].toFixed(1));
        line.setAttribute('y1', positions[a * 2 + 1].toFixed(1));
        line.setAttribute('x2', positions[b * 2].toFixed(1));
        line.setAttribute('y2', positions[b * 2 + 1].toFixed(1));
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg
      ref={svgRef}
      className="hero__network"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <g className="hero__network-links">
        {links.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} />
        ))}
      </g>

      <g className="hero__network-nodes">
        {nodes.map((node) => (
          <circle
            key={node.id}
            cx={node.x}
            cy={node.y}
            r={node.r}
            style={{ animationDelay: `${node.delay}s` }}
          />
        ))}
      </g>
    </svg>
  );
}
