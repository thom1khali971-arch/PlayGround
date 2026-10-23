import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const templatePath = path.join(root, 'scripts', 'sw.template.js')

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(full)))
    else files.push(full)
  }
  return files
}

const files = (await walk(dist))
  .filter((file) => path.basename(file) !== 'sw.js')
  .filter((file) => !file.endsWith('.map'))
  .sort()

const relative = files.map((file) => path.relative(dist, file).split(path.sep).join('/'))
const template = await readFile(templatePath, 'utf8')
const hash = createHash('sha1')
hash.update(template)
for (const file of files) {
  hash.update(path.relative(dist, file))
  hash.update(await readFile(file))
}
const version = hash.digest('hex').slice(0, 10)
const sw = template
  .replaceAll('__VERSION__', version)
  .replace('__PRECACHE__', JSON.stringify(relative, null, 2))

await writeFile(path.join(dist, 'sw.js'), sw)
console.log(`sw.js written (${relative.length} files, version ${version})`)
