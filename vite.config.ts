import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages needs an absolute subpath; Capacitor prefers relative assets.
const base = process.env.GITHUB_PAGES === '1' ? '/sambyakku-shambuda/' : './'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  server: {
    watch: {
      // OneDrive keeps font/binary files locked, which crashes chokidar with EBUSY.
      ignored: ['**/public/fonts/**', '**/android/**'],
    },
  },
})
