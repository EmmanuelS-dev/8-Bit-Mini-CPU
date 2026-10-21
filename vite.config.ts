import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // This repository is deployed as a GitHub Pages project site.
  base: '/8-Bit-Mini-CPU/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        about: 'index.html',
        simulator: 'simulator.html',
      },
    },
  },
})
