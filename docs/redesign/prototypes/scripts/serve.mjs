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
  try {
    const url = new URL(req.url, 'http://x')
    const path = decodeURIComponent(url.pathname)
    const direct = join(root, normalize(path))
    const isFile = direct.startsWith(root) && existsSync(direct) && statSync(direct).isFile()
    const route = isFile ? null : resolve(path)
    // The public image leaves out the hidden pages: their addresses are not found.
    const page = route && existsSync(join(root, route.file)) ? join(root, route.file) : null
    const file = isFile ? direct : page || join(root, '404.html')
    // A file with a version in its address never changes, so a browser can keep it. A page always comes fresh, with the new versions.
    const cache = isFile && url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'no-cache'
    res.writeHead(isFile || page ? 200 : 404, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': cache })
    res.end(req.method === 'HEAD' ? undefined : readFileSync(file))
  } catch {
    // A broken address must not stop the server.
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Bad request')
  }
}).listen(port, () => console.log(`http://localhost:${port}`))
