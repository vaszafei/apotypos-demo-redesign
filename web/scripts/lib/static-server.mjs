// A small static file server for the checks: a folder is served with its index.html, a missing file answers 404.
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.txt': 'text/plain' }

export const startServer = (root, port) => new Promise((resolve, reject) => {
  const base = normalize(root.endsWith('/') ? root : `${root}/`)
  const server = createServer((req, res) => {
    let path = normalize(join(base, decodeURIComponent(new URL(req.url, 'http://x').pathname)))
    if (path.startsWith(base) && existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html')
    if (!path.startsWith(base) || !existsSync(path) || !statSync(path).isFile()) { res.writeHead(404); res.end('not found'); return }
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' })
    res.end(req.method === 'HEAD' ? undefined : readFileSync(path))
  })
  server.once('error', reject)
  server.listen(port, () => resolve(server))
})
