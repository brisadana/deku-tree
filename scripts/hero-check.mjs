// Hero verification: screenshots at both sizes, scripted pointer, optional video.
//   node scripts/hero-check.mjs [--base http://localhost:5173] [--out shots/hero] [--tag step1]
//     [--sizes 1440x900,390x844] [--scenario still|sweep|wake] [--video] [--query debug=1]
//     [--headed] [--channel chrome|msedge]
//     [--eval 'c.sky.sunHalo = 0']   run against heroConfig (as c) before the scenario
//
// still : wait for the entrance, one shot.
// sweep : shot before, then a fast pointer swipe across the meadow, shots during / after.
// wake  : sleep shot, move → shots while waking/awake, stop → shots while closing/asleep.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] == null ? true : all[i + 1]])
    return acc
  }, []),
)
const base = args.base ?? 'http://localhost:5173'
const out = args.out ?? 'shots/hero'
const tag = args.tag ?? 'shot'
const scenario = args.scenario ?? 'still'
const sizes = String(args.sizes ?? '1440x900,390x844').split(',').map((s) => s.split('x').map(Number))
const query = args.query ? `?${args.query}` : ''
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({
  channel: args.channel ?? 'chrome',
  headless: !args.headed,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})

/** Reads shared hero state through Vite's module graph. */
const probe = (page) =>
  page.evaluate(() => {
    const h = window.__hero
    if (!h) return { reveal: 0 }
    return {
      time: +h.HU.uTime.value.toFixed(2),
      reveal: +h.HU.uReveal.value.toFixed(2),
      eyes: h.eyes ? { state: h.eyes.state, open: +h.eyes.open.toFixed(2) } : null,
      pointer: h.pointer ? { speed: +h.pointer.groundSpeed.toFixed(2) } : null,
      fps: h.fps ?? null,
    }
  })

async function waitForReveal(page) {
  for (let i = 0; i < 240; i++) {
    const s = await probe(page)
    if (s.reveal >= 0.99) return s
    await page.waitForTimeout(500)
  }
  throw new Error('entrance never finished')
}

/** Moves the pointer along points (fractions of the viewport), `ms` per step. */
async function path(page, w, h, pts, steps, ms) {
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, ay] = pts[k]
    const [bx, by] = pts[k + 1]
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      await page.mouse.move((ax + (bx - ax) * t) * w, (ay + (by - ay) * t) * h)
      await page.waitForTimeout(ms)
    }
  }
}

for (const [w, h] of sizes) {
  const mobile = w < 768
  const name = (s) => `${out}/${tag}-${w}x${h}-${s}.png`
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
    ...(args.video ? { recordVideo: { dir: `${out}/video-${tag}-${w}x${h}`, size: { width: w, height: h } } } : {}),
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text()))
  await page.goto(base + '/' + query, { waitUntil: 'networkidle' })
  const shot = async (s) => {
    await page.screenshot({ path: name(s) })
    console.log('saved', name(s), JSON.stringify(await probe(page)))
  }

  console.log('ready', JSON.stringify(await waitForReveal(page)))
  if (args.eval) {
    await page.evaluate((code) => new Function('c', code)(window.__hero.config), String(args.eval))
    await page.waitForTimeout(300)
  }

  if (scenario === 'still') {
    await shot('still')
  } else if (scenario === 'sweep') {
    await page.mouse.move(w * 0.5, h * 0.5)
    await page.waitForTimeout(300)
    await shot('0-before')
    // slow move right → scene turns
    await path(page, w, h, [[0.5, 0.5], [0.95, 0.3]], 20, 40)
    await page.waitForTimeout(1500)
    await shot('1-right-up')
    await path(page, w, h, [[0.95, 0.3], [0.05, 0.85]], 30, 30)
    await page.waitForTimeout(1500)
    await shot('2-left-down')
    // fast swipe over the meadow
    await path(page, w, h, [[0.15, 0.9], [0.85, 0.82]], 14, 16)
    await shot('3-swipe')
    await page.waitForTimeout(400)
    await shot('4-swipe+400ms')
    await page.waitForTimeout(1600)
    await shot('5-swipe+2s')
    // leave the window → ease back to centre
    await page.mouse.move(-10, h * 0.5)
    await page.evaluate(() => document.documentElement.dispatchEvent(new PointerEvent('pointerleave')))
    await page.evaluate(() => document.dispatchEvent(new MouseEvent('mouseout', { relatedTarget: null })))
    await page.waitForTimeout(2200)
    await shot('6-left-window')
  } else if (scenario === 'wake') {
    await page.waitForTimeout(500)
    await shot('0-asleep')
    await path(page, w, h, [[0.3, 0.6], [0.6, 0.45]], 12, 30)
    await page.waitForTimeout(250)
    await shot('1-waking')
    await path(page, w, h, [[0.6, 0.45], [0.8, 0.35], [0.7, 0.6]], 12, 40)
    await shot('2-awake-follow-right')
    await path(page, w, h, [[0.7, 0.6], [0.2, 0.4]], 16, 40)
    await shot('3-awake-follow-left')
    await page.waitForTimeout(2200)
    await shot('4-closing')
    await page.waitForTimeout(2500)
    await shot('5-asleep-again')
  }

  if (errors.length) console.log('CONSOLE', w, errors.slice(0, 8))
  await ctx.close()
}
await browser.close()
