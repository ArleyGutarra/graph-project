import GraphBackdrop from './GraphBackdrop';

/**
 * Portada (paso 1): fondo de red de grafos + título centrado con tipografía
 * llamativa y el identificador del congreso.
 */
export default function BackgroundSection({ active }) {
  return (
    <section className="hero">
      <GraphBackdrop active={active} />
      <div className="hero__veil" aria-hidden="true" />

      <div className="hero__content">
        <span className="hero__badge">VI CIMM-UNI · 2026</span>
        <h1 className="hero__title">Ergodicidad y convergencia en redes espacio-temporales</h1>
        <span className="hero__rule" aria-hidden="true" />
      </div>
    </section>
  );
}
