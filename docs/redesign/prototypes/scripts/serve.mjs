// The local server of the site, with the clean addresses of assets/routes.js. Usage: node scripts/serve.mjs [port]
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = fileURLToPath(new URL('../', import.meta.url))
const context = {}
vm.runInNewContext(readFileSync(join(root, 'assets/routes.js'), 'utf8'), { globalThis: context, URLSearchParams })
const { resolve } = context.ROUTES
const port = Number(process.argv[2] || 4173)
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.gif': 'image/gif' }

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const direct = join(root, normalize(path))
  const isFile = direct.startsWith(root) && existsSync(direct) && statSync(direct).isFile()
  const route = isFile ? null : resolve(path)
  const file = isFile ? direct : route ? join(root, route.file) : join(root, '404.html')
  res.writeHead(isFile || route ? 200 : 404, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' })
  res.end(readFileSync(file))
}).listen(port, () => console.log(`http://localhost:${port}`))
