// Dev helper: tiles PNGs from a folder into one labeled contact sheet.
// node scripts/contact.mjs <dir> <out.png> [cols] [tileWidth]
import { chromium } from 'playwright-core'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const [dir, out, cols = '4', tw = '360'] = process.argv.slice(2)
const files = readdirSync(dir).filter((f) => f.endsWith('.png') && !f.startsWith('sheet')).sort()
const tiles = files
  .map((f) => `<figure><img src="data:image/png;base64,${readFileSync(join(dir, f)).toString('base64')}"><figcaption>${f}</figcaption></figure>`)
  .join('')
const html = `<style>body{margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:6px;padding:6px;font:12px monospace;color:#eee}
figure{margin:0}img{width:100%;display:block}figcaption{padding:2px 0}</style>${tiles}`
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage({ viewport: { width: Number(cols) * (Number(tw) + 6) + 6, height: 400 } })
await p.setContent(html)
await p.screenshot({ path: out, fullPage: true })
await b.close()
console.log('sheet', out, files.length)
