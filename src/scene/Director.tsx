import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, type RefObject } from 'react'
import * as THREE from 'three'
import { env } from '../lib/env'
import { state } from '../lib/state'
import { ramp, smooth, window4 } from '../timeline/beats'
import { sampleCamera } from '../timeline/camera'
import { leafUniforms } from './FallingLeaves'
import { SKY } from './palette'
import { skyUniforms } from './Sky'
import { fx, U } from './uniforms'

const DEEP = new THREE.Color('#0F1A14')

type Props = {
  forest: RefObject<THREE.Group | null>
  dungeon: RefObject<THREE.Group | null>
}

/**
 * Turns the single scroll progress value into everything the scene does:
 * camera pose, world visibility, curse, sky grade, maw, wipe, emerald.
 */
export function Director({ forest, dungeon }: Props) {
  const { scene, camera, size } = useThree()
  const tmp = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      target: new THREE.Vector3(),
      smoothPos: new THREE.Vector3(0, 1.4, 22),
      smoothTarget: new THREE.Vector3(0, 4.8, 0),
      parallax: new THREE.Vector2(),
      fogColor: new THREE.Color(),
      first: true,
    }),
    [],
  )
  const wipe = useMemo(() => ({ el: null as HTMLElement | null }), [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const p = state.progress
    fx.spin += dt

    // ---- world switches (hidden under the black wipe) ----
    const inside = p > 0.515 && p < 0.918
    fx.inside = inside ? 1 : 0
    if (forest.current) forest.current.visible = !inside
    if (dungeon.current) dungeon.current.visible = inside

    // ---- beat-driven values ----
    const exiting = p >= 0.918
    leafUniforms.uLeafSpeed.value = 1 - smooth(window4(p, 0.155, 0.2, 0.27, 0.31))
    U.uCurse.value = exiting ? 0 : smooth(ramp(p, 0.29, 0.39))
    const dusk = exiting ? 0 : smooth(ramp(p, 0.285, 0.38))
    fx.maw = exiting ? 1 - smooth(ramp(p, 0.93, 0.965)) : smooth(ramp(p, 0.41, 0.49))
    fx.wipe = Math.max(window4(p, 0.465, 0.503, 0.524, 0.548), window4(p, 0.905, 0.916, 0.92, 0.94))
    fx.rootGlow = 1 - smooth(ramp(p, 0.82, 0.86))
    fx.gohma = 1 - smooth(ramp(p, 0.82, 0.85))
    fx.emerald = ramp(p, 0.845, 0.905)

    // ---- sky + fog ----
    const s = skyUniforms
    s.uZenith.value.lerpColors(SKY.day.zenith, SKY.dusk.zenith, dusk)
    s.uMid.value.lerpColors(SKY.day.mid, SKY.dusk.mid, dusk)
    s.uHorizon.value.lerpColors(SKY.day.horizon, SKY.dusk.horizon, dusk)
    s.uSun.value.lerpColors(SKY.day.sun, SKY.dusk.sun, dusk)
    s.uCloud.value.lerpColors(SKY.day.cloud, SKY.dusk.cloud, dusk)
    const fog = scene.fog as THREE.Fog | null
    if (fog) {
      if (inside) {
        fog.color.copy(DEEP)
        fog.near = 12
        fog.far = 75
      } else {
        fog.color.copy(s.uHorizon.value)
        fog.near = 38
        fog.far = 150
      }
    }
    scene.background = inside ? DEEP : null

    // ---- camera ----
    const cam = camera as THREE.PerspectiveCamera
    const fov = sampleCamera(p, tmp.pos, tmp.target)
    // portrait screens: step back along the view axis so close-ups still fit
    const aspect = size.width / size.height
    if (aspect < 1 && tmp.pos.distanceTo(tmp.target) < 14)
      tmp.pos.sub(tmp.target).multiplyScalar(1 + (1 - aspect) * 0.55).add(tmp.target)

    // a little pointer parallax, never on touch or reduced motion
    if (!env.isTouch && !env.reducedMotion && state.pointer.seen) {
      tmp.parallax.lerp({ x: state.pointer.ndcX, y: state.pointer.ndcY } as THREE.Vector2, 1 - Math.exp(-dt * 2.5))
      const side = new THREE.Vector3().subVectors(tmp.target, tmp.pos).cross(cam.up).normalize()
      tmp.pos.addScaledVector(side, tmp.parallax.x * 0.35).add(new THREE.Vector3(0, tmp.parallax.y * 0.12, 0))
    }

    // follow the sampled pose with light inertia; snap across world cuts
    const jump = tmp.pos.distanceTo(tmp.smoothPos) > 25
    const k = tmp.first || jump || env.reducedMotion ? 1 : 1 - Math.exp(-dt * 7)
    tmp.first = false
    tmp.smoothPos.lerp(tmp.pos, k)
    tmp.smoothTarget.lerp(tmp.target, k)
    cam.position.copy(tmp.smoothPos)
    cam.lookAt(tmp.smoothTarget)
    const fovFinal = env.isMobile ? fov + 12 : fov
    if (Math.abs(cam.fov - fovFinal) > 0.01) {
      cam.fov = fovFinal
      cam.updateProjectionMatrix()
    }

    // ---- DOM wipe ----
    wipe.el ??= document.getElementById('wipe')
    wipe.el?.style.setProperty('--wipe', fx.wipe.toFixed(4))
  })

  return null
}
