import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import type { Plugin } from 'vite'

// UI builds into public/ (committed) — cPanel only runs node server.js.
// Do NOT keep index.html at repo root: Apache/LiteSpeed serves it instead of Node
// (blank page + /src/main.tsx as octet-stream). Dev/build entry is app.html.
const isBuild = process.env.npm_lifecycle_event === 'build'

function classicScriptPlugin(): Plugin {
  return {
    name: 'classic-script-no-module',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // Modules are deferred by default; classic scripts in <head> run before #root exists (React #299).
        let next = html
          .replace(/\s+type="module"/g, '')
          .replace(/\s+crossorigin(?:="[^"]*")?/g, '')
          .replace(/<script(\s)(?![^>]*\bdefer\b)/g, '<script defer$1')

        const scriptTags: string[] = []
        next = next.replace(/<script\b[^>]*><\/script>/gi, (tag) => {
          scriptTags.push(tag)
          return ''
        })
        if (scriptTags.length) {
          next = next.replace(/<\/body>/i, `${scriptTags.join('\n')}\n</body>`)
        }
        return next
      },
    },
    closeBundle() {
      const from = path.resolve('public/app.html')
      const to = path.resolve('public/index.html')
      if (fs.existsSync(from)) {
        fs.renameSync(from, to)
      }
    },
  }
}


export default defineConfig({
  plugins: [react(), tailwindcss(), classicScriptPlugin()],
  base: isBuild ? '/api/static/' : '/',
  publicDir: 'static',
  build: {
    outDir: 'public',
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      input: path.resolve('app.html'),
      output: {
        format: 'iife',
        name: 'LabelPress',
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  server: {
    open: '/app.html',
    proxy: {
      '/api': 'http://localhost:5055',
    },
  },
})
