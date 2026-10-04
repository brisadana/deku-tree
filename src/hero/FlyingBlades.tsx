import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { env } from '../lib/env'
import { heroConfig } from './hero.config'
import { meadowAt } from './Grass'
import { useGroundField } from './groundField'
import { HU } from './uniforms'
import { pointer } from './usePointer'

/**
 * A 2×1 atlas of white cutouts, tinted per instance:
 * left = a single grass blade, right = a small leaf.
 */
export function makeAtlas() {
  // 256×128: each cell is 128×128. Greyscale, so the per-instance colour tints it.
  const S = 128
  const cv = document.createElement('canvas')
  cv.width = S * 2
  cv.height = S
  const g = cv.getContext('2d')!

  // blade: thin, slightly curved, pointed, darker toward the base
  const bg = g.createLinearGradient(0, S, 0, 0)
  bg.addColorStop(0, '#9a9a9a')
  bg.addColorStop(1, '#ffffff')
  g.fillStyle = bg
  g.beginPath()
  g.moveTo(52, 126)
  g.quadraticCurveTo(46, 60, 76, 3)
  g.quadraticCurveTo(66, 62, 74, 126)
  g.closePath()
  g.fill()

  // leaf: pointed ovate shape with a short stem, soft shading, midrib and side veins
  const cx = S + S / 2
  const leaf = new Path2D()
  leaf.moveTo(cx, 6) // tip
  leaf.bezierCurveTo(cx + 30, 30, cx + 34, 72, cx + 3, 104)
  leaf.lineTo(cx - 3, 104)
  leaf.bezierCurveTo(cx - 34, 72, cx - 30, 30, cx, 6)
  const lg = g.createRadialGradient(cx - 8, 52, 4, cx, 60, 56)
  lg.addColorStop(0, '#ffffff')
  lg.addColorStop(0.7, '#d6d6d6')
  lg.addColorStop(1, '#8c8c8c')
  g.fillStyle = lg
  g.fill(leaf)
  // stem
  g.strokeStyle = '#7a7a7a'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(cx, 102)
  g.quadraticCurveTo(cx + 2, 114, cx - 2, 124)
  g.stroke()
  // veins, clipped to the leaf
  g.save()
  g.clip(leaf)
  g.strokeStyle = 'rgba(70,70,70,0.55)'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(cx, 12)
  g.quadraticCurveTo(cx + 2, 60, cx, 104)
  g.stroke()
  g.lineWidth = 1.2
  for (let k = 0; k < 6; k++) {
    const y = 26 + k * 13
    for (const side of [-1, 1]) {
      g.beginPath()
      g.moveTo(cx + side * 1, y + 8)
      g.quadraticCurveTo(cx + side * 12, y + 2, cx + side * 26, y - 6)
      g.stroke()
    }
  }
  g.restore()

  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** Live count, for debugging / scripted checks. */
export const flyingStats = { alive: 0, spawned: 0 }

type Particle = {
  alive: boolean
  pos: THREE.Vector3
  vel: THREE.Vector3
  rot: THREE.Euler
  spin: THREE.Vector3
  age: number
  life: number
  size: number
  leaf: boolean
  ground: number
  landed: boolean
}

const tmpM = new THREE.Matrix4()
const tmpQ = new THREE.Quaternion()
const tmpS = new THREE.Vector3()
const tmpC = new THREE.Color()
const tmpC2 = new THREE.Color()

/** Pseudo curl noise: a divergence-free-ish swirl from two rotated sine fields. */
function curl(p: THREE.Vector3, t: number, scale: number, out: THREE.Vector3) {
  const x = p.x * scale
  const y = p.y * scale
  const z = p.z * scale
  out.set(
    Math.sin(z * 1.3 + t * 0.7) * Math.cos(y * 1.7 - t * 0.4),
    Math.sin(x * 1.1 + z * 0.6 + t * 0.5) * 0.6,
    Math.cos(x * 1.5 - t * 0.6) * Math.sin(y * 1.2 + t * 0.3),
  )
  return out
}

/** Loose blades and small leaves that lift off when the cursor sweeps fast over the grass. */
export function FlyingBlades() {
  const field = useGroundField()
  const n = heroConfig.blades.poolSize
  const state = useMemo(
    () => ({
      pool: Array.from(
        { length: n },
        (): Particle => ({
          alive: false,
          pos: new THREE.Vector3(),
          vel: new THREE.Vector3(),
          rot: new THREE.Euler(),
          spin: new THREE.Vector3(),
          age: 0,
          life: 1,
          size: 1,
          leaf: false,
          ground: 0,
          landed: false,
        }),
      ),
      budget: 0,
      windDir: new THREE.Vector3(1, 0, -0.35).normalize(),
      curl: new THREE.Vector3(),
    }),
    [n],
  )

  const { geometry, material } = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(1, 1)
    geometry.translate(0, 0.5, 0)
    // per-instance atlas cell: 0 = blade, 0.5 = leaf
    geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array(n), 1))
    const material = new THREE.MeshLambertMaterial({ map: makeAtlas(), alphaTest: 0.5, side: THREE.DoubleSide })
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uReveal = HU.uReveal
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'attribute float aCell;\nvoid main() {')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = vec2(uv.x * 0.5 + aCell, uv.y);')
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform float uReveal;\nvoid main() {')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb *= uReveal;')
    }
    material.customProgramCacheKey = () => 'hero-flying-blades'
    return { geometry, material }
  }, [n])

  // one instance, created here and mounted with <primitive>, so the matrices we write are the ones drawn
  const instanced = useMemo(() => {
    const im = new THREE.InstancedMesh(geometry, material, n)
    im.frustumCulled = false
    for (let i = 0; i < n; i++) im.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0))
    im.setColorAt(0, new THREE.Color('#ffffff'))
    for (let i = 1; i < n; i++) im.setColorAt(i, new THREE.Color('#ffffff'))
    return im
  }, [geometry, material, n])
  const mesh = { current: instanced }

  useEffect(
    () => () => {
      geometry.dispose()
      material.map?.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  function spawn(c: typeof heroConfig.blades) {
    const p = state.pool.find((q) => !q.alive)
    if (!p) return
    const g = heroConfig.grass
    // pick a nearby root that actually has grass
    for (let tries = 0; tries < 6; tries++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * g.cursorRadius * 0.6
      const x = pointer.ground.x + Math.cos(a) * r
      const z = pointer.ground.z + Math.sin(a) * r
      if (!meadowAt(field, x, z)) continue
      const y = field.height(x, z)
      const dir = pointer.groundVel.clone().setY(0)
      const speed = dir.length()
      dir.normalize()
      p.alive = true
      p.landed = false
      p.age = 0
      p.life = c.lifeMin + Math.random() * (c.lifeMax - c.lifeMin)
      p.leaf = Math.random() < c.leafRatio
      p.size = c.size * (p.leaf ? 0.7 : 1) * (0.7 + Math.random() * 0.6)
      p.pos.set(x, y + g.bladeHeight * (0.3 + Math.random() * 0.5), z)
      p.ground = y
      p.vel
        .copy(dir)
        .multiplyScalar(Math.min(speed, 12) * c.alongImpulse * (0.5 + Math.random() * 0.7))
        .add(new THREE.Vector3((Math.random() - 0.5) * 0.6, c.upImpulse * (0.6 + Math.random() * 0.6), (Math.random() - 0.5) * 0.6))
      p.rot.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28)
      p.spin.set((Math.random() - 0.5) * c.spin, (Math.random() - 0.5) * c.spin, (Math.random() - 0.5) * c.spin)
      flyingStats.spawned++
      const i = state.pool.indexOf(p)
      ;(geometry.attributes.aCell as THREE.InstancedBufferAttribute).setX(i, p.leaf ? 0.5 : 0)
      geometry.attributes.aCell.needsUpdate = true
      // dry blade / straw leaf, with a little jitter toward the living grass
      tmpC.set(p.leaf ? c.leafColor : c.bladeColor).lerp(tmpC2.set(g.tipColor), Math.random() * c.colorJitter)
      mesh.current?.setColorAt(i, tmpC)
      if (mesh.current?.instanceColor) mesh.current.instanceColor.needsUpdate = true
      return
    }
  }

  useFrame((_, rawDt) => {
    const m = mesh.current
    if (!m || env.reducedMotion) return
    const dt = Math.min(rawDt, 0.05)
    const c = heroConfig.blades
    const t = HU.uTime.value

    // spawn budget grows with cursor speed over the grass; nothing when still
    if (pointer.onGround && pointer.groundSpeed > c.minSpeed && HU.uReveal.value > 0.9) {
      const k = THREE.MathUtils.clamp((pointer.groundSpeed - c.minSpeed) / (c.speedForMax - c.minSpeed), 0, 1)
      state.budget = Math.min(state.budget + k * c.maxPer100ms * 10 * dt, c.maxPer100ms)
      while (state.budget >= 1) {
        state.budget -= 1
        spawn(c)
      }
    } else {
      state.budget = Math.max(0, state.budget - dt * 10)
    }

    let alive = 0
    for (let i = 0; i < state.pool.length; i++) {
      const p = state.pool[i]
      // every slot is written every frame (cheap), so unused ones can never linger visibly
      if (!p.alive) {
        m.setMatrixAt(i, tmpM.makeScale(0, 0, 0))
        continue
      }
      alive++
      p.age += dt
      if (p.age >= p.life) {
        p.alive = false
        m.setMatrixAt(i, tmpM.makeScale(0, 0, 0))
        continue
      }
      if (!p.landed) {
        // gravity, air drag, a curl-noise breeze and the meadow's wind
        curl(p.pos, t, c.curlScale, state.curl).multiplyScalar(c.curlStrength)
        p.vel.y -= c.gravity * dt
        p.vel.addScaledVector(state.curl, dt)
        p.vel.addScaledVector(state.windDir, heroConfig.grass.windStrength * 2 * dt)
        p.vel.multiplyScalar(Math.exp(-c.drag * dt))
        p.pos.addScaledVector(p.vel, dt)
        p.rot.x += p.spin.x * dt
        p.rot.y += p.spin.y * dt
        p.rot.z += p.spin.z * dt
        // settle on the grass tops
        if (p.vel.y < 0 && p.pos.y < p.ground + heroConfig.grass.bladeHeight * 0.5) {
          p.landed = true
          p.life = Math.min(p.life, p.age + 0.8)
        }
      }
      // shrink away at the end of life
      const fade = THREE.MathUtils.smoothstep(p.life - p.age, 0, 0.6)
      tmpQ.setFromEuler(p.rot)
      tmpS.setScalar(p.size * fade)
      tmpS.x *= p.leaf ? 0.8 : 0.6
      m.setMatrixAt(i, tmpM.compose(p.pos, tmpQ, tmpS))
    }
    m.instanceMatrix.needsUpdate = true
    flyingStats.alive = alive
  })

  if (env.reducedMotion) return null
  return <primitive object={instanced} />
}
