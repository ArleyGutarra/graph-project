import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../features/spatiotemporal/components/simulation.css'; // estilos del escenario y las gráficas
import './presentation.css';
import PresentationScreen from './PresentationScreen';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PresentationScreen />
  </StrictMode>
);
