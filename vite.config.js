import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: obligatorio para GitHub Pages, donde la app vive en
  // https://usuario.github.io/graph-project/ (no en la raíz del dominio).
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        // La presentación es la página de inicio.
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        simulacion: fileURLToPath(new URL('./simulacion.html', import.meta.url)),
        presentacion: fileURLToPath(new URL('./presentacion.html', import.meta.url)),
      },
    },
  },
})
