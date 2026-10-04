// Hero verification: screenshots at both sizes, scripted pointer, optional video.
//   node scripts/hero-check.mjs [--base http://localhost:5173] [--out shots/hero] [--tag step1]
//     [--sizes 1440x900,390x844] [--scenario still|sweep|wake] [--video] [--query debug=1]
//     [--headed] [--channel chrome|msedge]
//     [--crop]  only the bottom 40 % (the meadow)
//     [--swiftshader]  software GL instead of the hardware GPU
//     [--eval 'c.sky.sunHalo = 0']   run against heroConfig (as c) before the scenario
//
// still : wait for the entrance, one shot.
// sweep : shot before, then a fast pointer swipe across the meadow, shots during / after.
// wake  : sleep shot, move → shots while waking/awake, stop → shots while closing/asleep.
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'

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
  // real GPU by default (timing-faithful); --swiftshader for a software fallback
  args: !args.swiftshader
    ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
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
      pointer: h.pointer ? { speed: +h.pointer.groundSpeed.toFixed(2), onGround: h.pointer.onGround } : null,
      flying: h.flyingStats ? { ...h.flyingStats } : null,
      fps: h.fps ?? null,
      yaw: h.parallax ? +(h.parallax.yaw.x * 57.3).toFixed(2) : null,
      pitch: h.parallax ? +(h.parallax.pitch.x * 57.3).toFixed(2) : null,
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
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text()))
  await page.goto(base + '/' + query, { waitUntil: 'networkidle' })
  const shot = async (s) => {
    await page.screenshot({ path: name(s), ...(args.crop ? { clip: { x: 0, y: h * 0.6, width: w, height: h * 0.4 } } : {}) })
    console.log('saved', name(s), JSON.stringify(await probe(page)))
  }

  console.log('ready', JSON.stringify(await waitForReveal(page)))
  if (args.eval) {
    await page.evaluate((code) => new Function('c', code)(window.__hero.config), String(args.eval))
    await page.waitForTimeout(300)
  }

  // --video: record the WebGL canvas in-page (MediaRecorder → webm), no ffmpeg needed
  if (args.video) {
    await page.evaluate(() => {
      const cv = document.querySelector('canvas')
      const rec = new MediaRecorder(cv.captureStream(30), { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8e6 })
      const chunks = []
      rec.ondataavailable = (e) => chunks.push(e.data)
      rec.start(250)
      window.__rec = { rec, chunks }
    })
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
    // over open meadow on both sides of the path (the middle band is the tree's roots)
    await path(page, w, h, [[0.28, 0.93], [0.44, 0.87]], 15, 25)
    await shot('3a-mid-swipe')
    await path(page, w, h, [[0.56, 0.87], [0.72, 0.93]], 15, 25)
    await shot('3-swipe')
    await page.waitForTimeout(400)
    await shot('4-swipe+400ms')
    await page.waitForTimeout(1600)
    await shot('5-swipe+2s')
    // leave the window → ease back to centre
    await page.mouse.move(w - 2, h * 0.5)
    await page.waitForTimeout(600)
    await page.evaluate(() => document.documentElement.dispatchEvent(new PointerEvent('pointerleave')))
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

  if (args.video) {
    const b64 = await page.evaluate(
      () =>
        new Promise((res) => {
          const { rec, chunks } = window.__rec
          rec.onstop = async () => {
            const buf = await new Blob(chunks, { type: 'video/webm' }).arrayBuffer()
            let s = ''
            const u8 = new Uint8Array(buf)
            for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000))
            res(btoa(s))
          }
          rec.stop()
        }),
    )
    const file = `${out}/${tag}-${scenario}-${w}x${h}.webm`
    writeFileSync(file, Buffer.from(b64, 'base64'))
    console.log('video', file)
  }
  if (errors.length) console.log('CONSOLE', w, errors.slice(0, 8))
  await ctx.close()
}
await browser.close()
