import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Plugin: rewrite dist/_routes.json so that "/" is served as static (index.html)
// rather than being passed to the Worker (avoids redirect loops in Cloudflare Pages).
function fixRoutesJson() {
  return {
    name: 'fix-routes-json',
    apply: 'build' as const,
    enforce: 'post' as const,
    closeBundle() {
      const routes = {
        version: 1,
        include: ['/tables/*', '/api/*'],
        exclude: []
      }
      writeFileSync(
        resolve(process.cwd(), 'dist', '_routes.json'),
        JSON.stringify(routes)
      )
    }
  }
}

export default defineConfig({
  plugins: [
    build(),
    devServer({
      adapter,
      entry: 'src/index.tsx'
    }),
    fixRoutesJson()
  ]
})
