import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    hmr: {
      overlay: true
    },
    watch: {
      // Use polling to detect file changes on filesystems where
      // native events are not delivered (network drives, some Windows setups)
      usePolling: true
    },
    proxy: {
      '/api': 'http://localhost:4000'
    }
  }
})
