import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
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
function makeAtlas() {
  const w = 128
  const h = 64
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const g = cv.getContext('2d')!
  g.fillStyle = '#fff'
  // blade: thin, slightly curved, pointed
  g.beginPath()
  g.moveTo(22, 62)
  g.quadraticCurveTo(20, 28, 38, 2)
  g.quadraticCurveTo(34, 30, 42, 62)
  g.closePath()
  g.fill()
  // leaf: almond with a stem
  g.beginPath()
  g.moveTo(96, 6)
  g.bezierCurveTo(118, 18, 116, 44, 96, 54)
  g.bezierCurveTo(76, 44, 74, 18, 96, 6)
  g.fill()
  g.fillRect(95, 52, 2, 10)
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
  const mesh = useRef<THREE.InstancedMesh>(null)
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

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    tmpM.makeScale(0, 0, 0)
    for (let i = 0; i < n; i++) {
      m.setMatrixAt(i, tmpM)
      m.setColorAt(i, tmpC.set('#ffffff'))
    }
    m.instanceMatrix.needsUpdate = true
    return () => {
      geometry.dispose()
      material.map?.dispose()
      material.dispose()
    }
  }, [n, geometry, material])

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

    let any = false
    let alive = 0
    for (let i = 0; i < state.pool.length; i++) {
      const p = state.pool[i]
      if (!p.alive) continue
      any = true
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
    if (any) m.instanceMatrix.needsUpdate = true
    flyingStats.alive = alive
  })

  if (env.reducedMotion) return null
  return <instancedMesh ref={mesh} args={[geometry, material, n]} frustumCulled={false} />
}
