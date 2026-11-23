/**
 * Portada (paso 1): el título centrado con tipografía llamativa y el
 * identificador del congreso.
 *
 * El fondo (red de grafos animada + degradado) lo pone `.step__bg`, que App
 * monta en TODOS los pasos, así la portada y el resto comparten diseño.
 */
export default function BackgroundSection() {
  return (
    <section className="hero">
      <div className="hero__veil" aria-hidden="true" />

      <div className="hero__content">
        <span className="hero__badge">VI CIMM-UNI · 2026</span>
        <h1 className="hero__title">Ergodicidad y convergencia en redes espacio-temporales</h1>
        <span className="hero__rule" aria-hidden="true" />
      </div>
    </section>
  );
}
