import GraphEditor from "./components/GraphEditor/GraphEditor";

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Graph Simulator</h1>
        <p>Graph visualization and simulation</p>
      </header>

      <GraphEditor />
    </div>
  );
}

export default App;
