import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { state } from '../lib/state'

/**
 * Hero pointer state, read by frame loops (never triggers React renders).
 * Built on the global tracking in lib/state; adds leave, speed and the ground hit.
 */
export const pointer = {
  /** Normalised device coords (-1..1, y up). */
  ndc: new THREE.Vector2(),
  /** False after the pointer left the window (until it moves again). */
  inside: false,
  /** performance.now() of the last time the pointer left the window. */
  lastLeave: -Infinity,
  /** True once the user moved at least once. */
  seen: false,
  /** performance.now() of the last pointer movement, or touch / scroll activity. */
  lastMove: -Infinity,
  lastActive: -Infinity,
  /** Screen speed in NDC units per second (smoothed). */
  screenSpeed: 0,
  /** Is the pointer over the ground (meadow), and where — in the world group's local space. */
  onGround: false,
  ground: new THREE.Vector3(),
  /** Ground velocity (m/s, local space) and its length (smoothed). */
  groundVel: new THREE.Vector3(),
  groundSpeed: 0,
  /** True when the device has no hover (phones, tablets). */
  touch: window.matchMedia('(hover: none), (pointer: coarse)').matches,
}

/** Seconds since the last pointer movement. */
export const idleFor = () => (performance.now() - pointer.lastMove) / 1000
/** Seconds since any activity (move, touch, scroll). */
export const inactiveFor = () => (performance.now() - Math.max(pointer.lastMove, pointer.lastActive)) / 1000

let installed = false
function install() {
  if (installed) return
  installed = true
  const leave = () => {
    pointer.lastLeave = performance.now()
    pointer.inside = false
  }
  document.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget) leave()
  })
  document.documentElement.addEventListener('pointerleave', leave)
  window.addEventListener('blur', leave)
  const active = () => (pointer.lastActive = performance.now())
  window.addEventListener('scroll', active, { passive: true })
  window.addEventListener('wheel', active, { passive: true })
  window.addEventListener('touchstart', active, { passive: true })
  window.addEventListener('keydown', active)
}

const ray = new THREE.Raycaster()
const prevGround = new THREE.Vector3()
const vel = new THREE.Vector3()

/** Per-frame: syncs from lib/state, smooths speeds, raycasts the pointer onto the Ground mesh. */
export function PointerTracker({ world }: { world: React.RefObject<THREE.Group | null> }) {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const cache = useMemo(() => ({ ground: null as THREE.Object3D | null, lastSeenMove: -Infinity, prevNdc: new THREE.Vector2(), hadGround: false }), [])

  useEffect(install, [])

  useFrame((_, rawDt) => {
    const dt = Math.max(Math.min(rawDt, 0.1), 1e-4)
    const s = state.pointer
    const moved = s.lastMove !== cache.lastSeenMove
    cache.lastSeenMove = s.lastMove
    pointer.lastActive = Math.max(pointer.lastActive, s.lastActive)
    if (moved) {
      pointer.lastMove = s.lastMove
      pointer.seen = true
    }
    pointer.inside = pointer.seen && pointer.lastMove > pointer.lastLeave
    pointer.ndc.set(s.ndcX, s.ndcY)

    // screen speed (NDC/s), exponentially smoothed
    const ds = pointer.ndc.distanceTo(cache.prevNdc) / dt
    cache.prevNdc.copy(pointer.ndc)
    pointer.screenSpeed += (ds - pointer.screenSpeed) * (1 - Math.exp(-dt * 12))

    // ground hit (only meaningful while the pointer is inside)
    cache.ground ??= scene.getObjectByName('Ground') ?? null
    let hit = false
    if (cache.ground && pointer.inside && pointer.seen) {
      ray.setFromCamera(pointer.ndc, camera)
      const h = ray.intersectObject(cache.ground, false)[0]
      if (h && world.current) {
        prevGround.copy(pointer.ground)
        pointer.ground.copy(world.current.worldToLocal(h.point.clone()))
        hit = true
      }
    }
    if (hit && cache.hadGround) vel.subVectors(pointer.ground, prevGround).divideScalar(dt)
    else vel.set(0, 0, 0)
    vel.y = 0
    pointer.groundVel.lerp(vel, 1 - Math.exp(-dt * 14))
    pointer.groundSpeed = pointer.groundVel.length()
    pointer.onGround = hit
    cache.hadGround = hit
  })
  return null
}
