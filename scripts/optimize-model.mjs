// Optimizes the source model into /public/models/deku-tree.glb
// Usage: npm run optimize:model [-- path/to/source.glb]
import { execSync } from 'node:child_process'
import { statSync } from 'node:fs'

const src = process.argv[2] ?? 'assets-src/great_deku_tree__hyrule_warriors.glb'
const out = 'public/models/deku-tree.glb'

execSync(
  `npx gltf-transform optimize "${src}" "${out}" --compress meshopt --texture-compress webp --texture-size 1024 --flatten false --join false --simplify false`,
  { stdio: 'inherit' },
)
const kb = (p) => (statSync(p).size / 1024).toFixed(0) + ' KB'
console.log(`\n${src}: ${kb(src)}  ->  ${out}: ${kb(out)}`)
