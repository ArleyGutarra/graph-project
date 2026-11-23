import { useState } from 'react';
import BackgroundSection from './components/BackgroundSection';
import FundamentosSection from './components/FundamentosSection';
import SectionPlaceholder from './components/SectionPlaceholder';
import SimulationPage from './features/spatiotemporal/components/SimulationPage';

/** Orden de la presentación: de la portada a la simulación. */
const STEPS = [
  { id: 'background', label: 'Background de presentación' },
  { id: 'fundamentos', label: 'Fundamentos matemáticos' },
  { id: 'pasos', label: 'Pasos para la simulación' },
  { id: 'simulacion', label: 'Simulación' },
];

function App() {
  const [step, setStep] = useState(0);

  const goBack = () => setStep((current) => Math.max(0, current - 1));
  const goNext = () => setStep((current) => Math.min(STEPS.length - 1, current + 1));

  const renderStep = (index, content) => (
    <div
      className="step"
      role="region"
      aria-label={STEPS[index].label}
      hidden={step !== index}
    >
      {content}
    </div>
  );

  return (
    <div className="app">
      {renderStep(0, <BackgroundSection active={step === 0} />)}
      {renderStep(1, <FundamentosSection />)}
      {renderStep(2, <SectionPlaceholder title="Pasos para la simulación" />)}
      {renderStep(3, <SimulationPage />)}

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
