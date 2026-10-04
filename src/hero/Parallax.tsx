import { useFrame } from '@react-three/fiber'
import { useEffect, type RefObject } from 'react'
import * as THREE from 'three'
import { env } from '../lib/env'
import { heroConfig } from './hero.config'
import { pointer } from './usePointer'

const toRad = THREE.MathUtils.degToRad

/** Critically damped spring step (exact for constant target), stiffness k (1/s). */
function spring(s: { x: number; v: number }, target: number, k: number, dt: number) {
  const d = s.x - target
  const e = Math.exp(-k * dt)
  const c = s.v + k * d
  s.x = target + (d + c * dt) * e
  s.v = (c - k * (d + c * dt)) * e
}

/** Current spring values (radians), for debugging and for anything that wants to follow the turn. */
export const parallax = { yaw: { x: 0, v: 0 }, pitch: { x: 0, v: 0 } }

/** Device tilt (phones): offsets from the first reading, normalised to -1..1. */
const tilt = { ok: false, x: 0, y: 0, base: null as null | { b: number; g: number } }

function useDeviceTilt(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof DeviceOrientationEvent === 'undefined') return
    const range = heroConfig.parallax.tiltRange
    const on = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return
      tilt.base ??= { b: e.beta, g: e.gamma }
      tilt.ok = true
      tilt.x = THREE.MathUtils.clamp((e.gamma - tilt.base.g) / range, -1, 1)
      tilt.y = THREE.MathUtils.clamp(-(e.beta - tilt.base.b) / range, -1, 1)
    }
    const listen = () => window.addEventListener('deviceorientation', on)
    // iOS asks for permission, and only from a user gesture
    const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    if (typeof D.requestPermission === 'function') {
      const ask = () => {
        D.requestPermission!().then((r) => r === 'granted' && listen()).catch(() => {})
        window.removeEventListener('touchend', ask)
      }
      window.addEventListener('touchend', ask)
      return () => {
        window.removeEventListener('touchend', ask)
        window.removeEventListener('deviceorientation', on)
      }
    }
    listen()
    return () => window.removeEventListener('deviceorientation', on)
  }, [enabled])
}

type Props = { world: RefObject<THREE.Group | null>; sky: RefObject<THREE.Group | null> }

/**
 * Turns the world group (not the camera) toward the pointer: up to ±yaw / ±pitch,
 * through a critically damped spring. The sky turns `parallaxFactor` as much.
 */
export function Parallax({ world, sky }: Props) {
  const { yaw, pitch } = parallax
  const enabled = !env.reducedMotion
  useDeviceTilt(enabled && pointer.touch)

  useFrame(({ clock }, rawDt) => {
    if (!enabled) return
    const dt = Math.min(rawDt, 0.1)
    const c = heroConfig.parallax
    let tx = 0
    let ty = 0
    let k = c.stiffness
    if (pointer.touch) {
      if (tilt.ok) {
        tx = tilt.x
        ty = tilt.y
      } else {
        // no tilt: a very slow idle drift
        const t = (clock.elapsedTime / c.idlePeriod) * Math.PI * 2
        tx = Math.sin(t) * c.idleAmount
        ty = Math.sin(t * 0.7 + 1.3) * c.idleAmount * 0.5
      }
    } else if (pointer.inside && pointer.seen) {
      tx = pointer.ndc.x
      ty = pointer.ndc.y
    } else {
      // left the window: settle back to centre in ~returnTime
      k = 4.7 / c.returnTime
    }
    spring(yaw, tx * toRad(c.yaw), k, dt)
    spring(pitch, ty * toRad(c.pitch), k, dt)

    // pointer right → world turns to show a little more of its right side
    if (world.current) world.current.rotation.set(-pitch.x, -yaw.x, 0)
    const f = heroConfig.sky.parallaxFactor
    if (sky.current) sky.current.rotation.set(-pitch.x * f, -yaw.x * f, 0)
  })
  return null
}
