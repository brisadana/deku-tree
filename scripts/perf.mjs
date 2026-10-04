// Frame-time measurement (uncapped headless, real GPU), optionally with CPU throttling.
//   node scripts/perf.mjs [--cpu 4] [--dpr 2] [--size 1440x900]
import { chromium } from 'playwright-core'
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const [w, h] = arg('--size', '1440x900').split('x').map(Number)
const dpr = Number(arg('--dpr', 2))
const cpu = Number(arg('--cpu', 1))
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] })
const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr })
const p = await ctx.newPage()
const cdp = await ctx.newCDPSession(p)
await p.goto('http://localhost:5173/')
await p.waitForFunction(() => window.__hero?.HU.uReveal.value > 0.99, null, { timeout: 60000 })
if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
const measure = (label, moving) =>
  p.evaluate(
    async ([moving, W, H]) => {
      const times = []
      let last = performance.now()
      const t0 = last
      await new Promise((res) => {
        const f = () => {
          const now = performance.now()
          times.push(now - last)
          last = now
          if (moving) {
            const k = (now - t0) / 1000
            window.dispatchEvent(new PointerEvent('pointermove', { clientX: W * (0.3 + 0.2 * Math.sin(k * 3)), clientY: H * (0.85 + 0.04 * Math.cos(k * 5)) }))
          }
          if (now - t0 < 4000) requestAnimationFrame(f)
          else res()
        }
        requestAnimationFrame(f)
      })
      times.sort((a, z) => a - z)
      const avg = times.reduce((a, z) => a + z, 0) / times.length
      return { frames: times.length, avgMs: +avg.toFixed(2), p95Ms: +times[Math.floor(times.length * 0.95)].toFixed(2), fps: Math.round(1000 / avg), canvas: document.querySelector('canvas').width + 'x' + document.querySelector('canvas').height }
    },
    [moving, w, h],
  ).then((r) => console.log(`${w}x${h} dpr${dpr} cpu×${cpu} ${label.padEnd(7)}`, JSON.stringify(r)))
await measure('idle', false)
await measure('moving', true)
await b.close()
