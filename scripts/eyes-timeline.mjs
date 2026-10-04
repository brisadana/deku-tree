// Samples the eye state machine over a scripted session and checks the timings.
//   node scripts/eyes-timeline.mjs [--base http://localhost:5173]
import { chromium } from 'playwright-core'
const base = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:5173'
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto(base + '/')
await p.waitForFunction(() => window.__hero?.HU.uReveal.value > 0.99, null, { timeout: 30000 })

// sample in-page every frame so nothing is missed
await p.evaluate(() => {
  const log = (window.__eyelog = [])
  const t0 = performance.now()
  const tick = () => {
    const e = window.__hero.eyes
    log.push([+((performance.now() - t0) / 1000).toFixed(3), e.state, +e.lids.toFixed(3), +e.pupil.x.toFixed(3)])
    requestAnimationFrame(tick)
  }
  tick()
})
const at = () => p.evaluate(() => window.__eyelog.at(-1)[0])
const marks = {}
const mark = async (n) => (marks[n] = await at())
const wiggle = async (ms, x0 = 0.3, x1 = 0.8) => {
  const steps = Math.round(ms / 30)
  for (let i = 0; i <= steps; i++) {
    await p.mouse.move((x0 + (x1 - x0) * (i / steps)) * 1440, (0.45 + 0.05 * Math.sin(i / 3)) * 900)
    await p.waitForTimeout(30)
  }
}

await p.waitForTimeout(12000) // still: expect at least one drowsy blink
await mark('move1')
await wiggle(2500, 0.3, 0.85) // ends at the right: pupils should sit right
await mark('stop1')
await p.waitForTimeout(2600) // idle 1.5 s, then closing (2.5 s)… interrupt mid-close
await mark('move2')
await wiggle(600, 0.85, 0.15) // ends left
await mark('stop2')
await p.waitForTimeout(5000)
await mark('end')

const log = await p.evaluate(() => window.__eyelog)
await b.close()

const seg = (a, z) => log.filter(([t]) => t >= a && t <= z)
const first = (a, pred) => log.find((r) => r[0] >= a && pred(r))
const fmt = (r) => (r ? `${r[0].toFixed(2)}s ${r[1]} lids=${r[2]}` : 'never')

const still = seg(0, marks.move1)
const peak = Math.max(...still.map((r) => r[2]))
const drowsyStarts = still.filter((r, i) => i && r[2] > 0.001 && still[i - 1][2] <= 0.001).map((r) => r[0])
console.log(`still 0–${marks.move1.toFixed(1)}s: drowsy blinks at [${drowsyStarts.map((t) => t.toFixed(1)).join(', ')}], peak lids ${peak} (spec ~0.15)`)

const wakeStart = first(marks.move1, (r) => r[1] === 'WAKING')
const awake = first(marks.move1, (r) => r[1] === 'AWAKE')
console.log(`wake: WAKING at ${fmt(wakeStart)}, AWAKE at ${fmt(awake)} → ${(awake[0] - wakeStart[0]).toFixed(2)}s (spec ~0.7)`)
const atStop = log.find((r) => r[0] >= marks.stop1)
console.log(`pupil x at stop (cursor right): ${atStop[3]} (max ±1 → ±${'15%'} width)`)
const closing = first(marks.stop1, (r) => r[1] === 'CLOSING')
console.log(`closing started ${(closing[0] - marks.stop1).toFixed(2)}s after stopping (spec ~1.5)`)
const reopen = first(marks.move2, (r) => r[1] === 'WAKING')
const before = log.filter((r) => r[0] < reopen[0]).at(-1)
console.log(`mid-close movement: lids ${before[2]} → reopened from ${reopen[2]} (${before[1]} → WAKING), no snap: ${Math.abs(reopen[2] - before[2]) < 0.05}`)
const closing2 = first(marks.stop2, (r) => r[1] === 'CLOSING')
const sleep2 = first(closing2[0], (r) => r[1] === 'SLEEP')
console.log(`second close: CLOSING ${fmt(closing2)} → SLEEP ${fmt(sleep2)} → ${(sleep2[0] - closing2[0]).toFixed(2)}s (spec ~2.5 from fully open)`)
let maxJump = 0
for (let i = 1; i < log.length; i++) maxJump = Math.max(maxJump, Math.abs(log[i][2] - log[i - 1][2]))
console.log(`largest lids change between frames: ${maxJump.toFixed(3)} (blinks are 150 ms, so ≤ ~0.2 at 60 fps)`)
