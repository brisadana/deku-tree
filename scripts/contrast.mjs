// Measures WCAG contrast of each overlay text element against the rendered pixels behind it.
//   node scripts/contrast.mjs [--base http://localhost:5173]
import { chromium } from 'playwright-core'
const base = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:5173'
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const L = ([r, g, bb]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bb)
const ratio = (a, c) => (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05)
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } })
  await p.goto(base + '/')
  await p.waitForFunction(() => window.__hero?.HU.uReveal.value > 0.99, null, { timeout: 30000 })
  await p.waitForTimeout(3000) // overlay fade-in
  const els = await p.evaluate(() =>
    [['wordmark', 'p'], ['spoilers', 'nav a'], ['sound', 'nav button'], ['title', 'h1'], ['hint', '[aria-live] span[aria-hidden=false]']].map(([n, s]) => {
      const el = document.querySelector(s)
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      // effective opacity up the tree
      let o = 1
      for (let e = el; e; e = e.parentElement) o *= +getComputedStyle(e).opacity
      return { n, x: r.x, y: r.y, w: r.width, h: r.height, color: cs.color, o }
    }),
  )
  // background: hide the text glyphs (keep scrims), screenshot, sample each box
  await p.addStyleTag({ content: 'header *, h1, [aria-live] { color: transparent !important; outline: none !important }' })
  await p.waitForTimeout(100)
  for (const e of els) {
    const shot = await p.screenshot({ clip: { x: e.x, y: e.y, width: Math.max(1, e.w), height: Math.max(1, e.h) } })
    const px = await p.evaluate(async (b64) => {
      const img = new Image()
      img.src = 'data:image/png;base64,' + b64
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const x = c.getContext('2d')
      x.drawImage(img, 0, 0)
      const d = x.getImageData(0, 0, c.width, c.height).data
      const out = []
      for (let i = 0; i < d.length; i += 16) out.push([d[i], d[i + 1], d[i + 2]])
      return out
    }, shot.toString('base64'))
    const fg = e.color.match(/\d+/g).slice(0, 3).map(Number)
    const lums = px.map(L).sort((a, z) => a - z)
    const fgL = L(fg)
    const light = fgL > 0.5
    // worst 10 % of the background (brightest for light text, darkest for dark text)
    const worstBg = light ? lums[Math.floor(lums.length * 0.9)] : lums[Math.floor(lums.length * 0.1)]
    const medianBg = lums[Math.floor(lums.length / 2)]
    // blend text over background at its opacity
    const eff = (bg) => e.o * fgL + (1 - e.o) * bg
    console.log(
      `${w}x${h} ${e.n.padEnd(9)} opacity ${e.o.toFixed(2)}  median ${ratio(eff(medianBg), medianBg).toFixed(2)}:1  worst-10% ${ratio(eff(worstBg), worstBg).toFixed(2)}:1`,
    )
  }
  await p.close()
}
await b.close()
