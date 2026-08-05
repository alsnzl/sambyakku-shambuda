import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative base works for Capacitor and GitHub Pages subdirectory.
  base: './',
  plugins: [react()],
  server: {
    watch: {
      // OneDrive keeps font/binary files locked, which crashes chokidar with EBUSY.
      ignored: ['**/public/fonts/**', '**/android/**'],
    },
  },
})
