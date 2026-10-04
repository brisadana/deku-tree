// Contact sheet: node scripts/sheet.mjs out.png cols img1 img2 ...
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
const [out, cols, ...files] = process.argv.slice(2)
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
const figs = files
  .map((f) => `<figure><img src="data:image/png;base64,${readFileSync(f).toString('base64')}"><figcaption>${basename(f)}</figcaption></figure>`)
  .join('')
await p.setContent(
  `<style>body{margin:0;display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px;background:#111;color:#ddd;font:13px sans-serif}img{width:100%;display:block}figure{margin:0}</style>${figs}`,
)
await p.screenshot({ path: out, fullPage: true })
await b.close()
console.log('sheet', out)
