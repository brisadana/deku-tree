// Dev helper: headless screenshots of the running dev server.
// node scripts/shot.mjs --path / --sizes 1440x900,390x844 --out shots [--wait 2500]
//   [--scroll 0,0.2,0.5]   take one shot per scroll fraction of the page
//   [--sweep]              move the pointer across the lower third right before each shot
//   [--channel chrome|msedge]
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] == null ? true : all[i + 1]])
    return acc
  }, []),
)
const base = args.base ?? 'http://localhost:5173'
const path = args.path ?? '/'
const sizes = String(args.sizes ?? '1440x900').split(',').map((s) => s.split('x').map(Number))
const out = args.out ?? 'shots'
const wait = Number(args.wait ?? 2500)
const scrolls = args.scroll ? String(args.scroll).split(',').map(Number) : [null]
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({
  channel: args.channel ?? 'chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
for (const [w, h] of sizes) {
  const mobile = w < 768
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(base + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(wait)
  for (const s of scrolls) {
    if (s != null) {
      await page.evaluate((f) => window.scrollTo(0, f * (document.documentElement.scrollHeight - innerHeight)), s)
      await page.waitForTimeout(Number(args.settle ?? 1800))
    }
    if (args.sweep) {
      for (let i = 0; i <= 24; i++) {
        await page.mouse.move(w * 0.2 + (w * 0.6 * i) / 24, h * 0.9 - Math.sin(i / 4) * h * 0.02)
        await page.waitForTimeout(16)
      }
      await page.waitForTimeout(120)
    }
    const name = `${out}/${w}x${h}${s != null ? '-' + String(s).replace('.', '_') : ''}.png`
    await page.screenshot({ path: name })
    console.log('saved', name)
  }
  if (errors.length) console.log('ERRORS', w, errors.slice(0, 5))
  await ctx.close()
}
await browser.close()
