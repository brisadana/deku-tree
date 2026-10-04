import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { env } from '../lib/env'
import { treeParts } from './DekuTree'
import { makeAtlas } from './FlyingBlades'
import { heroConfig } from './hero.config'
import { HU } from './uniforms'

type Leaf = {
  alive: boolean
  pos: THREE.Vector3
  vel: THREE.Vector3
  side: THREE.Vector3
  rot: THREE.Euler
  spin: THREE.Vector3
  phase: number
  age: number
  size: number
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const tmpM = new THREE.Matrix4()
const tmpQ = new THREE.Quaternion()
const tmpS = new THREE.Vector3()
const tmpV = new THREE.Vector3()
const camLocal = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

/** Live count, for scripted checks. */
export const canopyLeafStats = { alive: 0, released: 0 }

/**
 * Every few seconds one to three leaves break off the front of the canopy and drift,
 * fluttering and tumbling, toward the viewer; they shrink away before reaching the lens.
 * Lives in the world group (turns with the parallax).
 */
export function CanopyLeaves() {
  const camera = useThree((s) => s.camera)
  const n = heroConfig.canopyLeaves.poolSize
  const state = useMemo(
    () => ({
      pool: Array.from(
        { length: n },
        (): Leaf => ({
          alive: false,
          pos: new THREE.Vector3(),
          vel: new THREE.Vector3(),
          side: new THREE.Vector3(),
          rot: new THREE.Euler(),
          spin: new THREE.Vector3(),
          phase: 0,
          age: 0,
          size: 1,
        }),
      ),
      next: 2.5,
    }),
    [n],
  )

  const { geometry, material } = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(1, 1)
    geometry.translate(0, 0.5, 0)
    const material = new THREE.MeshLambertMaterial({ map: makeAtlas(), alphaTest: 0.5, side: THREE.DoubleSide })
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uReveal = HU.uReveal
      // right half of the atlas is the leaf
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = vec2(uv.x * 0.5 + 0.5, uv.y);')
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform float uReveal;\nvoid main() {')
        // backlit translucency: the sun is behind the tree, so the leaf glows a little with its own colour
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.3;')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb *= uReveal;')
    }
    material.customProgramCacheKey = () => 'hero-canopy-leaves'
    return { geometry, material }
  }, [])

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

  function release(c: typeof heroConfig.canopyLeaves, space: THREE.Object3D) {
    const leaf = state.pool.find((l) => !l.alive)
    const frame = treeParts.frame
    if (!leaf || !frame) return
    const i = state.pool.indexOf(leaf)
    // a point on the front half of the canopy (tree frame) → world-group space
    const a = rand(-0.5, 0.5) * Math.PI
    tmpV.set(Math.sin(a) * c.fromWidth * 0.5, rand(c.fromHeight[0], c.fromHeight[1]), Math.cos(a) * rand(3, 8))
    frame.localToWorld(tmpV)
    space.worldToLocal(tmpV)
    leaf.pos.copy(tmpV)
    // aim at a point scattered around the camera so they pass by, not into the lens
    const target = tmpV.copy(camLocal).add(new THREE.Vector3(rand(-1, 1) * c.passSpread[0], rand(-0.6, 1) * c.passSpread[1], 0))
    leaf.vel.subVectors(target, leaf.pos).normalize()
    leaf.side.crossVectors(leaf.vel, UP).normalize()
    leaf.vel.multiplyScalar(c.speed * (1 + rand(-1, 1) * c.speedJitter))
    leaf.rot.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28))
    leaf.spin.set(rand(-1, 1) * c.spin, rand(-1, 1) * c.spin, rand(-1, 1) * c.spin)
    leaf.phase = rand(0, 6.28)
    leaf.age = 0
    leaf.size = c.size * rand(0.75, 1.25)
    leaf.alive = true
    canopyLeafStats.released++
    mesh.current?.setColorAt(i, new THREE.Color(c.colors[Math.floor(Math.random() * c.colors.length)]))
    if (mesh.current?.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }

  useFrame((_, rawDt) => {
    const m = mesh.current
    const space = m?.parent
    if (!m || !space || env.reducedMotion) return
    const dt = Math.min(rawDt, 0.05)
    const c = heroConfig.canopyLeaves
    const t = HU.uTime.value
    camLocal.copy(camera.position)
    space.worldToLocal(camLocal)

    // occasional releases, only once the tree is visible
    if (HU.uReveal.value > 0.95) {
      state.next -= dt
      if (state.next <= 0) {
        const burst = 1 + Math.floor(Math.random() * c.burstMax)
        for (let k = 0; k < burst; k++) release(c, space)
        state.next = rand(c.everyMin, c.everyMax)
      }
    }

    let alive = 0
    for (let i = 0; i < state.pool.length; i++) {
      const l = state.pool[i]
      // every slot is written every frame (cheap), so unused ones can never linger visibly
      if (!l.alive) {
        m.setMatrixAt(i, tmpM.makeScale(0, 0, 0))
        continue
      }
      l.age += dt
      // drift with a side-to-side flutter and a little vertical bob
      const w = (t * c.flutterFreq + l.phase) * Math.PI * 2
      l.pos.addScaledVector(l.vel, dt)
      l.pos.addScaledVector(l.side, Math.cos(w) * c.flutter * dt)
      l.pos.y += Math.sin(w * 2) * c.flutter * 0.25 * dt
      l.rot.x += l.spin.x * dt
      l.rot.y += l.spin.y * dt
      l.rot.z += l.spin.z * dt
      // shrink away near the camera; retire once past it
      const dist = l.pos.distanceTo(camLocal)
      const past = tmpV.subVectors(l.pos, camLocal).dot(l.vel) > 0
      if (past || dist < 1 || l.age > 20) {
        l.alive = false
        m.setMatrixAt(i, tmpM.makeScale(0, 0, 0))
        continue
      }
      alive++
      const s = l.size * THREE.MathUtils.smoothstep(l.age, 0, 0.5) * THREE.MathUtils.smoothstep(dist, c.fadeNear * 0.35, c.fadeNear)
      tmpQ.setFromEuler(l.rot)
      tmpS.set(s * 0.8, s, s)
      m.setMatrixAt(i, tmpM.compose(l.pos, tmpQ, tmpS))
    }
    m.instanceMatrix.needsUpdate = true
    canopyLeafStats.alive = alive
  })

  if (env.reducedMotion) return null
  return <primitive object={instanced} />
}
