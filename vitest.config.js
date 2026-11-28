import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Configuración de los tests unitarios (Vitest).
 * El `vite.config.js` sigue siendo el de la app; este archivo sólo afecta a
 * `npm test`.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    globals: false,
    // Construir P (1296 estados) y la iteración de potencia tardan más de 5 s.
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
