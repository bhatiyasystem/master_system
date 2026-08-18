import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'
import apiApp from './server.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'express-plugin',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url.startsWith('/api')) {
            apiApp(req, res, next);
          } else {
            next();
          }
        });
      }
    }
  ],
  resolve: {
    alias: {
      // General @ alias pointing to src
      '@': path.resolve(__dirname, './src'),
    }
  },
  base: "/",
  build: {
    outDir: "dist",
  },
  server: {
    hmr: true,
    watch: {
      usePolling: true,
      interval: 100,
      ignored: ['**/node_modules/**', '**/dist/**']
    },
  },
})