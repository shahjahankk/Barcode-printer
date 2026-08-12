import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// UI builds into public/ (committed) — cPanel only runs node server.js
// Production base /api/static/ avoids Apache stealing /assets before Passenger (Laboratory pattern)
const isBuild = process.env.npm_lifecycle_event === 'build'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: isBuild ? '/api/static/' : '/',
  // Static assets for Vite (favicon) — must not collide with outDir `public`
  publicDir: 'static',
  build: {
    outDir: 'public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5055',
    },
  },
})
