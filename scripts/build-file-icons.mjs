// Builds a curated subset of the vscode-icons Iconify set containing only the
// icons referenced by lib/coding/file-icons.ts, plus generic fallbacks.
//
// Output: lib/coding/file-icons-data.json  (registered offline at runtime)
// Run after editing the icon maps:  node scripts/build-file-icons.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const collection = require('@iconify-json/vscode-icons/icons.json')

// Pull the icon-name string literals straight out of the maps file so the two
// never drift apart.
const mapSrc = fs.readFileSync(path.join(root, 'lib/coding/file-icons.ts'), 'utf8')
const referenced = new Set(
  [...mapSrc.matchAll(/'(file-type-[a-z0-9-]+|default-file|default-folder(?:-opened)?)'/g)].map(
    (m) => m[1],
  ),
)

const icons = {}
const missing = []
for (const name of referenced) {
  if (collection.icons[name]) icons[name] = collection.icons[name]
  else missing.push(name)
}

const subset = {
  prefix: collection.prefix,
  icons,
  width: collection.width,
  height: collection.height,
}

const outPath = path.join(root, 'lib/coding/file-icons-data.json')
fs.writeFileSync(outPath, JSON.stringify(subset))

const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1)
console.log(`Wrote ${Object.keys(icons).length} icons (${sizeKb} KB) to ${outPath}`)
if (missing.length) {
  console.warn(`\nMissing from vscode-icons (will fall back to default):`)
  console.warn(missing.join(', '))
}
