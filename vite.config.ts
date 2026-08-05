import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // OneDrive keeps font/binary files locked, which crashes chokidar with EBUSY.
      ignored: ['**/public/fonts/**', '**/android/**'],
    },
  },
})
