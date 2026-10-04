// Captures frames while a canopy leaf is close to the camera.
import { chromium } from 'playwright-core'
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu'] })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
const warn = []
p.on('console', (m) => m.text().includes('[hero]') && warn.push(m.text()))
await p.goto('http://localhost:5173/')
await p.waitForFunction(() => window.__hero?.HU.uReveal.value > 0.99, null, { timeout: 30000 })
const probe = () =>
  p.evaluate(() => {
    const { scene, camera, THREE } = window.__hero
    let m
    scene.traverse((o) => {
      if (o.isInstancedMesh && o.material.customProgramCacheKey?.() === 'hero-canopy-leaves') m = o
    })
    const e = m.instanceMatrix.array
    const out = []
    for (let i = 0; i < m.count; i++) {
      const o = i * 16
      if (Math.hypot(e[o + 4], e[o + 5], e[o + 6]) < 0.01) continue
      const w = new THREE.Vector3(e[o + 12], e[o + 13], e[o + 14]).applyMatrix4(m.parent.matrixWorld)
      const q = w.clone().project(camera)
      out.push({ d: +w.distanceTo(camera.position).toFixed(1), px: [Math.round((q.x + 1) * 720), Math.round((1 - q.y) * 450)] })
    }
    return out
  })
let shots = 0
for (let i = 0; i < 120 && shots < 3; i++) {
  await p.waitForTimeout(150)
  const near = (await probe()).filter((x) => x.d < 16 && x.d > 5 && x.px[0] > 100 && x.px[0] < 1340 && x.px[1] > 60 && x.px[1] < 840)
  if (near.length) {
    await p.screenshot({ path: `shots/hero/leaves-near-${shots}.png` })
    console.log('shot', shots, JSON.stringify(near))
    shots++
    await p.waitForTimeout(900)
  }
}
console.log(warn.join('\n') || 'no [hero] warnings (DOF patch applied)')
await b.close()
