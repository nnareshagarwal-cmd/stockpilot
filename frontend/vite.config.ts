import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// When running inside Docker, backend is reachable at http://backend:8000
// When running locally on host machine, it falls back to http://localhost:8000
const backendTarget = process.env.VITE_BACKEND_URL || 'http://backend:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
      interval: 1000,
      ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    },
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/uploads': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
})
