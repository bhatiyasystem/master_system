import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'
import net from 'net'
import apiApp from './server.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Helper to check if a port is free on both 127.0.0.1 and 0.0.0.0 (prevents Windows port collision)
function testPort(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, host)
  })
}

async function getAvailablePort(defaultPort = 5175) {
  let port = defaultPort
  while (port < 65535) {
    const [localFree, anyFree] = await Promise.all([
      testPort(port, '127.0.0.1'),
      testPort(port, '0.0.0.0'),
    ])
    if (localFree && anyFree) {
      return port
    }
    port++
  }
  return defaultPort
}

// https://vite.dev/config/
export default defineConfig(async () => {
  const port = await getAvailablePort(Number(process.env.PORT) || 5175)

  return {
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
      port,
      strictPort: false,
      hmr: true,
      watch: {
        usePolling: true,
        interval: 100,
        ignored: ['**/node_modules/**', '**/dist/**']
      },
    },
  }
})