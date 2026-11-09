import "./GraphEditor.css";
import GraphView from "./GraphView";

function GraphEditor() {
  return (
    <main className="graph-editor">
      {/* Área principal */}
      <section className="workspace">
        {/* Selectores */}
        <div className="workspace__selectors">
          <div className="selector-group">
            <label htmlFor="map-select">Select map</label>
            <select id="map-select" defaultValue="K_4">
              <option value="K_4">K_4</option>
              <option value="K_3">K_3</option>
              <option value="K_5">K_5</option>
            </select>
          </div>

          <div className="selector-group">
            <label htmlFor="graph-select">Select graph</label>
            <select id="graph-select" defaultValue="my_graph">
              <option value="my_graph">my_graph</option>
              <option value="graph_2">graph_2</option>
            </select>
          </div>
        </div>

        {/* Visualización del grafo */}
        <div className="workspace__graph">
          <GraphView />
        </div>

        {/* Controles de reproducción */}
        <div className="playback-controls">
          <button className="control-button" aria-label="Previous">
            ‹
          </button>

          <button className="play-button">PLAY / STOP</button>

          <button className="control-button" aria-label="Next">
            ›
          </button>
        </div>

        {/* Línea de tiempo */}
        <div className="timeline">
          <label className="timeline__checkbox">
            <input type="checkbox" defaultChecked />
            <span>View frames</span>
          </label>

          <div className="timeline__frames">
            {Array.from({ length: 8 }, (_, index) => (
              <div className="timeline__frame" key={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Panel lateral */}
      <aside className="moves-panel">
        <button className="moves-panel__collapse" aria-label="Collapse panel">
          ‹
        </button>

        <div className="moves-panel__content">
          <div className="moves-panel__header">
            <h2>Moves</h2>
          </div>

          <div className="moves-list">
            <button className="move-item">
              σ<sub>23</sub>
            </button>

            <button className="move-item">
              σ<sub>34</sub>
            </button>

            <button className="move-item move-item--add" aria-label="Add move">
              +
            </button>
          </div>
        </div>
      </aside>
    </main>
  );
}

export default GraphEditor;
