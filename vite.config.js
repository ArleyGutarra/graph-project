import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages sirve la app bajo /graph-project/ (no en la raíz del dominio):
  // https://direespinalp.github.io/graph-project/
  base: '/graph-project/',
  server: {
    // Al ejecutar `npm run dev` se abre sola la pestaña del navegador en la
    // URL del servidor (Vite ya incluye el `base` anterior en esa dirección).
    open: true,
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        // Único contenido del sitio: el simulador.
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        simulacion: fileURLToPath(new URL('./simulacion.html', import.meta.url)),
      },
    },
  },
})
