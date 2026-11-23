import { useCallback } from 'react';
import SimulationPage from './features/spatiotemporal/components/SimulationPage';

function App() {
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__row">
          <span className="app-header__led" aria-hidden="true" />
          <h1>Ergodicidad y convergencia en redes espacio-temporales</h1>
          <span className="app-header__badge">VI CIMM-UNI · 2026</span>
          <button
            className="app-header__fs"
            type="button"
            onClick={toggleFullscreen}
            title="Pantalla completa"
            aria-label="Pantalla completa"
          >
            ⛶
          </button>
        </div>
      </header>

      <SimulationPage />
    </div>
  );
}

export default App;
