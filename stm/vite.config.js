import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    preserveSymlinks: true,
  },
  server: {
    port: 5173,
    proxy: {
      // All /api/* calls are forwarded to the Express server
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true
      }
    }
  }
})
