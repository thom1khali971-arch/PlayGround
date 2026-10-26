import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'

const root = resolve(process.argv[2] || 'dist')
const port = Number(process.env.PORT || 3000)

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

async function fileAt(path) {
  try {
    const info = await stat(path)
    return info.isFile() ? path : info.isDirectory() ? join(path, 'index.html') : null
  } catch {
    return null
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' })
      res.end('Method not allowed')
      return
    }

    const url = new URL(req.url, 'http://localhost')
    const pathname = decodeURIComponent(url.pathname)
    if (pathname.includes('\0')) {
      res.writeHead(400)
      res.end('Bad request')
      return
    }

    let target = resolve(root, '.' + pathname)
    if (target !== root && !target.startsWith(root + sep)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }

    let file = await fileAt(target)
    if (!file) {
      file = await fileAt(join(root, 'index.html'))
    }
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }

    const content = await readFile(file)
    res.writeHead(200, {
      'Content-Type': mime[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': content.byteLength,
      'Cache-Control': 'no-cache'
    })
    res.end(req.method === 'HEAD' ? undefined : content)
  } catch (error) {
    console.error(error)
    if (!res.headersSent) res.writeHead(500)
    res.end('Internal server error')
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Serving ${root} on http://0.0.0.0:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
