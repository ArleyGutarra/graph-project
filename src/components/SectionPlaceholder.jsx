/**
 * Contenido provisional de una sección: solo el título, a la espera de que se
 * redacte el texto real.
 */
export default function SectionPlaceholder({ title }) {
  return (
    <section className="placeholder">
      <span className="placeholder__label">Sección</span>
      <h2 className="placeholder__title">{title}</h2>
      <p className="placeholder__note">
        Contenido pendiente de redactar. Este título ya está en su sitio: solo hace falta añadir
        aquí el texto de la sección.
      </p>
    </section>
  );
}
