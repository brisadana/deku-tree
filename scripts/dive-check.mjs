// Screenshots along the scroll dive into the mouth, then the dark section.
//   node scripts/dive-check.mjs [--size 1440x900] [--tag dive]
import { chromium } from 'playwright-core'
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const [w, h] = arg('--size', '1440x900').split('x').map(Number)
const tag = arg('--tag', 'dive')
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768 })
const errors = []
p.on('pageerror', (e) => errors.push(String(e)))
await p.goto('http://localhost:5173/')
await p.waitForFunction(() => window.__hero?.HU.uReveal.value > 0.99, null, { timeout: 30000 })
await p.waitForTimeout(1500)
const travel = await p.evaluate(() => {
  const t = document.querySelector('section[aria-label]').parentElement
  return t.offsetHeight - innerHeight
})
const files = []
for (const f of [0, 0.2, 0.42, 0.6, 0.74, 0.86, 0.95, 1]) {
  await p.evaluate((y) => window.scrollTo(0, y), Math.round(f * travel))
  await p.waitForTimeout(1600) // let the damped camera settle
  const s = await p.evaluate(() => ({ p: +window.__hero_scroll?.p?.toFixed?.(3) || null, cam: window.__hero.camera.position.toArray().map((v) => +v.toFixed(2)), veil: getComputedStyle(document.querySelector('section[aria-label]')).getPropertyValue('--veil') }))
  const file = `shots/hero/${tag}-${w}x${h}-${String(f).replace('.', '_')}.png`
  await p.screenshot({ path: file })
  files.push(file)
  console.log(file, JSON.stringify(s))
}
// past the track: the dark section
await p.evaluate((y) => window.scrollTo(0, y), travel + h * 0.9)
await p.waitForTimeout(800)
const file = `shots/hero/${tag}-${w}x${h}-section.png`
await p.screenshot({ path: file })
console.log(file, 'frameloop stopped:', await p.evaluate(() => { const a = window.__hero.HU.uTime.value; return new Promise((r) => setTimeout(() => r(window.__hero.HU.uTime.value === a), 500)) }))
// back up: rendering resumes
await p.evaluate(() => window.scrollTo(0, 0))
await p.waitForTimeout(1500)
console.log('back at top, rendering again:', await p.evaluate(() => { const a = window.__hero.HU.uTime.value; return new Promise((r) => setTimeout(() => r(window.__hero.HU.uTime.value > a), 300)) }))
if (errors.length) console.log('ERRORS', errors)
await b.close()
