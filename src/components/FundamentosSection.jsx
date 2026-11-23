/**
 * Paso 2 · Fundamentos matemáticos.
 *
 * Bloques pequeños, uno por concepto. Para escribir el contenido basta con
 * rellenar `body` en el array de abajo; para añadir o quitar bloques se añade
 * o borra una entrada (la rejilla se reordena sola).
 */

const CONCEPTS = [
  { id: 'tupla', title: 'La 4-tupla (X, {C^X_i}, k, α)', body: '' },
  { id: 'conexion', title: 'Conexión y desconexión (t⁻ → t⁺)', body: '' },
  { id: 'coloracion', title: 'Coloración (t⁻ → t⁺)', body: '' },
  { id: 'desplazamiento', title: 'Desplazamiento (t⁺ → (t+1)⁻)', body: '' },
  { id: 'teorema', title: 'Hipótesis y teorema de ergodicidad', body: '' },
];

export default function FundamentosSection() {
  return (
    <section className="placeholder">
      <span className="placeholder__label">Sección</span>
      <h2 className="placeholder__title">Fundamentos matemáticos</h2>
      <p className="placeholder__note">
        Un bloque por concepto: aquí va el texto que describe cada parte del modelo.
      </p>

      <div className="concepts">
        {CONCEPTS.map((concept, index) => (
          <article className="concept" key={concept.id}>
            <span className="concept__index">{String(index + 1).padStart(2, '0')}</span>
            <h3 className="concept__title">{concept.title}</h3>
            <p
              className={concept.body ? 'concept__body' : 'concept__body concept__body--empty'}
            >
              {concept.body || 'Escribe aquí la descripción del concepto…'}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
