import { useState } from 'react';
import BackgroundSection from './components/BackgroundSection';
import GraphBackdrop from './components/GraphBackdrop';
import SimulationPage from './features/spatiotemporal/components/SimulationPage';

/** Orden de la presentación: de la portada a la simulación. */
const STEPS = [
  { id: 'background', label: 'Background de presentación' },
  { id: 'simulacion', label: 'Simulación' },
];

function App() {
  const [step, setStep] = useState(0);

  const goBack = () => setStep((current) => Math.max(0, current - 1));
  const goNext = () => setStep((current) => Math.min(STEPS.length - 1, current + 1));

  // `contained` centra el contenido a 1360 px; la portada va a sangre.
  // El fondo (`.step__bg`) se monta solo en el paso activo y ocupa toda la
  // ventana, así TODAS las secciones comparten el mismo diseño de la portada.
  const renderStep = (index, content, contained = false) => (
    <div
      className={`step${contained ? ' step--contained' : ''}`}
      role="region"
      aria-label={STEPS[index].label}
      hidden={step !== index}
    >
      {step === index ? (
        <div className="step__bg" aria-hidden="true">
          <GraphBackdrop />
        </div>
      ) : null}
      {content}
    </div>
  );

  return (
    <div className="app">
      {renderStep(0, <BackgroundSection />)}
      {renderStep(1, <SimulationPage />, true)}

      <footer className="wizard">
        <button
          className="wizard__button"
          type="button"
          onClick={goBack}
          disabled={step === 0}
        >
          ← Atrás
        </button>

        <button
          className="wizard__button wizard__button--primary"
          type="button"
          onClick={goNext}
          disabled={step === STEPS.length - 1}
        >
          Siguiente →
        </button>
      </footer>
    </div>
  );
}

export default App;
