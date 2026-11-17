import SimulationPage from "./features/spatiotemporal/components/SimulationPage";

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__row">
          <span className="app-header__led" aria-hidden="true" />
          <h1>Graph Simulator</h1>
          <span className="app-header__badge">VI CIMM-UNI · 2026</span>
          <a
            className="app-header__link"
            href="/presentacion.html"
            target="_blank"
            rel="noreferrer"
          >
            Presentación 4:3 ↗
          </a>
        </div>
        <p className="app-header__subtitle">
          ergodicidad y convergencia en redes espacio-temporales · simulación del modelo del póster
        </p>
      </header>

      <SimulationPage />
    </div>
  );
}

export default App;
