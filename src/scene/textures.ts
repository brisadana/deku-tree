import * as THREE from 'three'

/** Seeded RNG so procedural textures and geometry are stable between reloads. */
export function rng(seed = 1) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function leafPath(ctx: CanvasRenderingContext2D, len: number, wid: number) {
  ctx.beginPath()
  ctx.moveTo(0, -len / 2)
  ctx.bezierCurveTo(wid, -len / 4, wid * 0.9, len / 4, 0, len / 2)
  ctx.bezierCurveTo(-wid * 0.9, len / 4, -wid, -len / 4, 0, -len / 2)
  ctx.closePath()
}

/** A single brush-stroke leaf (white on transparent; tinted in the shader). */
export function makeLeafTexture() {
  const s = 128
  const cv = document.createElement('canvas')
  cv.width = cv.height = s
  const ctx = cv.getContext('2d')!
  ctx.translate(s / 2, s / 2)
  ctx.rotate(0.3)
  leafPath(ctx, s * 0.86, s * 0.34)
  ctx.fillStyle = '#fff'
  ctx.fill()
  // painted midrib + brush streaks in the green channel (used as shade)
  ctx.globalCompositeOperation = 'source-atop'
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.4)
  ctx.quadraticCurveTo(4, 0, 0, s * 0.42)
  ctx.stroke()
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.NoColorSpace
  return tex
}

/** A cluster of brush-stroke leaves for canopy billboards. R = mask, G = shade. */
export function makeLeafClusterTexture(seed = 7) {
  const s = 256
  const r = rng(seed)
  const cv = document.createElement('canvas')
  cv.width = cv.height = s
  const ctx = cv.getContext('2d')!
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * s * 0.33
    ctx.save()
    ctx.translate(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d)
    ctx.rotate(a + Math.PI / 2 + (r() - 0.5) * 0.8)
    const len = s * (0.2 + r() * 0.14)
    leafPath(ctx, len, len * 0.42)
    const shade = Math.floor(150 + r() * 105)
    ctx.fillStyle = `rgb(255,${shade},0)`
    ctx.fill()
    ctx.restore()
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.NoColorSpace
  return tex
}
