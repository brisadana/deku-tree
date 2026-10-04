import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Suspense, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { env, params } from '../lib/env'
import { sceneColor } from './color'
import { heroConfig } from './hero.config'
import { Overlay } from './Overlay'
import { Parallax, parallax } from './Parallax'
import { Post } from './Post'
import { Sky, SunGlow } from './Sky'
import { CanopyLeaves, canopyLeafStats } from './CanopyLeaves'
import { Debug } from './Debug'
import { eyeState } from './eyeMachine'
import { Eyes } from './Eyes'
import { FlyingBlades, flyingStats } from './FlyingBlades'
import { Grass, trail } from './Grass'
import { HU } from './uniforms'
import { pointer, PointerTracker } from './usePointer'
import { preloadModels } from './useModels'
import { heroScroll, ramp, readScroll, smoother, stepScroll } from './scroll'
import { Inside } from './Inside'
import { treeParts } from './DekuTree'
import { Lights, World } from './World'
import styles from './Hero.module.css'

preloadModels()

// dev/test hook: scripts read and tweak the live instances (Vite may serve cache-busted copies otherwise)
if (import.meta.env.DEV) Object.assign(window, { __hero: { config: heroConfig, HU, pointer, parallax, trail, flyingStats, eyes: eyeState, canopyLeafStats } })

/** Set once both models are in the scene. */
const loaded = { value: false }

const ease = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3)

const camTmp = {
  from: new THREE.Vector3(),
  to: new THREE.Vector3(),
  fromT: new THREE.Vector3(),
  toT: new THREE.Vector3(),
  pos: new THREE.Vector3(),
  target: new THREE.Vector3(),
}

/**
 * Camera: the hero framing (desktop or mobile) at scroll 0, then along the scroll keys
 * (given in the tree's frame) into the mouth. Smootherstep between keys, so each reads as a beat.
 * With reduced motion the camera stays put and only the veil fades.
 */
function HeroCamera() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  useFrame((_, rawDt) => {
    const c = heroConfig.camera
    const sc = heroConfig.scroll
    // narrow or portrait screens get the wider mobile framing so the whole trunk + face fit
    const narrow = size.width < c.mobileBreakpoint || size.width / size.height < c.portraitAspect
    const hero = narrow ? c.mobile : c.desktop
    stepScroll(Math.min(rawDt, 0.1), sc.damping, env.reducedMotion)
    const p = env.reducedMotion ? 0 : heroScroll.p

    const frame = treeParts.frame
    const toWorld = (v: THREE.Vector3) => (frame ? frame.localToWorld(v) : v)
    let fov = hero.fov
    if (p <= 0 || !frame) {
      camTmp.pos.set(...hero.position)
      camTmp.target.set(...hero.target)
    } else {
      // previous key (the hero pose is key 0, already in world space)
      let prevP = 0
      camTmp.from.set(...hero.position)
      camTmp.fromT.set(...hero.target)
      let prevFov = hero.fov
      for (const k of sc.keys) {
        const kFov = narrow ? k.fovMobile : k.fov
        if (p <= k.p) {
          const t = smoother((p - prevP) / Math.max(1e-6, k.p - prevP))
          toWorld(camTmp.to.set(...k.position))
          toWorld(camTmp.toT.set(...k.target))
          camTmp.pos.lerpVectors(camTmp.from, camTmp.to, t)
          camTmp.target.lerpVectors(camTmp.fromT, camTmp.toT, t)
          fov = THREE.MathUtils.lerp(prevFov, kFov, t)
          break
        }
        prevP = k.p
        prevFov = kFov
        toWorld(camTmp.from.set(...k.position))
        toWorld(camTmp.fromT.set(...k.target))
        camTmp.pos.copy(camTmp.from)
        camTmp.target.copy(camTmp.fromT)
        fov = kFov
      }
    }
    camera.position.copy(camTmp.pos)
    camera.lookAt(camTmp.target)
    if (Math.abs(camera.fov - fov) > 1e-3 || camera.near !== c.near || camera.far !== c.far) {
      camera.fov = fov
      camera.near = c.near
      camera.far = c.far
      camera.updateProjectionMatrix()
    }
  })
  return null
}

/** Clock, fog and the entrance fades. */
function Atmosphere() {
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const start = useRef<number | null>(null)

  useEffect(() => {
    scene.fog = new THREE.Fog(0xffffff, 1, 2)
    scene.background = new THREE.Color(0x000000)
  }, [scene])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    HU.uTime.value += dt
    gl.toneMappingExposure = heroConfig.renderer.exposure

    const fog = scene.fog as THREE.Fog | null
    if (fog) {
      sceneColor(heroConfig.fog.color, fog.color)
      fog.near = heroConfig.fog.near
      fog.far = heroConfig.fog.far
    }

    // entrance: sky out of black first, then the world
    if (!loaded.value) return
    start.current ??= HU.uTime.value
    const t = HU.uTime.value - start.current
    const e = heroConfig.entrance
    HU.uSkyReveal.value = ease(t / e.skyFade)
    HU.uReveal.value = ease((t - e.sceneDelay) / e.sceneFade)
  })
  return null
}

/** Dev only: frames per second into window.__hero.fps, plus scene access for scripted checks. */
function FpsProbe() {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    Object.assign((window as unknown as { __hero: object }).__hero, { scene, camera, THREE })
  }, [scene, camera])
  const acc = useRef({ n: 0, t: 0 })
  useFrame((_, dt) => {
    const a = acc.current
    a.n++
    a.t += dt
    if (a.t >= 1) {
      ;(window as unknown as { __hero: { fps: number } }).__hero.fps = Math.round(a.n / a.t)
      a.n = 0
      a.t = 0
    }
  })
  return null
}

function Ready() {
  useEffect(() => {
    loaded.value = true
  }, [])
  return null
}

function Scene() {
  const world = useRef<THREE.Group>(null)
  const skyPivot = useRef<THREE.Group>(null)
  return (
    <>
      <HeroCamera />
      <Atmosphere />
      <group ref={skyPivot}>
        <Sky />
        <SunGlow />
      </group>
      <Lights />
      <PointerTracker world={world} />
      <Parallax world={world} sky={skyPivot} />
      <Suspense fallback={null}>
        <World ref={world} treeChildren={<Eyes />}>
          <Grass />
          <FlyingBlades />
          <CanopyLeaves />
        </World>
        <Ready />
      </Suspense>
      <Post />
      {import.meta.env.DEV && <FpsProbe />}
    </>
  )
}

export function Hero() {
  const maxDpr = Math.min(window.devicePixelRatio || 1, env.isMobile ? heroConfig.renderer.dprMobile : heroConfig.renderer.dprDesktop)
  // adaptive resolution: if the frame rate drops, render fewer pixels (down to dpr 1)
  const [dpr, setDpr] = useState(maxDpr)
  const track = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLElement>(null)

  useEffect(() => {
    heroScroll.track = track.current
    readScroll()
    heroScroll.p = heroScroll.raw
    window.addEventListener('scroll', readScroll, { passive: true })
    window.addEventListener('resize', readScroll)
    return () => {
      window.removeEventListener('scroll', readScroll)
      window.removeEventListener('resize', readScroll)
      heroScroll.track = null
    }
  }, [])

  return (
    <>
      <div ref={track} className={styles.track} style={{ height: `calc(100svh + ${heroConfig.scroll.lengthVh}vh)` }}>
        <section ref={stage} className={styles.stage} aria-label="The Great Deku Tree">
          <div className={styles.canvas} aria-hidden="true">
            <Canvas
              dpr={dpr}
              shadows={{ type: THREE.PCFShadowMap }}
              gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
              camera={{ fov: 35, position: [0, 6, 34], near: 0.5, far: 900 }}
            >
              <PerformanceMonitor
                factor={1}
                flipflops={4}
                onChange={({ factor }) => setDpr(Math.max(1, Math.round((1 + (maxDpr - 1) * factor) * 4) / 4))}
              />
              <Scene />
              <ScrollFx stage={stage} />
              <RenderGate />
              {params.debug && <Debug />}
            </Canvas>
          </div>
          <div className={styles.veil} aria-hidden="true" />
          <Overlay />
        </section>
      </div>
      <Inside />
    </>
  )
}

/** Writes scroll-driven CSS variables on the stage: --exit (overlay fade) and --veil (dark close-in). */
function ScrollFx({ stage }: { stage: React.RefObject<HTMLElement | null> }) {
  const last = useRef({ exit: -1, veil: -1 })
  useFrame(() => {
    const el = stage.current
    if (!el) return
    const sc = heroConfig.scroll
    const p = env.reducedMotion ? heroScroll.raw : heroScroll.p
    let exit = ramp(p, 0, sc.overlayOutBy)
    let veil = env.reducedMotion ? ramp(p, 0.15, 0.85) : smoother(ramp(p, sc.veilFrom, sc.veilTo))
    // snap the ends so the veil is fully open / fully closed
    if (exit > 0.998) exit = 1
    if (veil > 0.998) veil = 1
    if (Math.abs(exit - last.current.exit) > 1e-3) el.style.setProperty('--exit', exit.toFixed(3))
    if (Math.abs(veil - last.current.veil) > 1e-3) el.style.setProperty('--veil', veil.toFixed(3))
    last.current = { exit, veil }
  })
  return null
}

/**
 * Stops rendering while the tab is hidden, or once the camera is fully inside the tree
 * (the veil is opaque); scrolling back up resumes it.
 */
function RenderGate() {
  const setFrameloop = useThree((s) => s.setFrameloop)
  const frameloop = useThree((s) => s.frameloop)
  useEffect(() => {
    const update = () => {
      const inside = heroScroll.raw >= 1 && heroScroll.p >= 0.999
      setFrameloop(document.hidden || inside ? 'never' : 'always')
    }
    document.addEventListener('visibilitychange', update)
    window.addEventListener('scroll', update, { passive: true })
    return () => {
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('scroll', update)
    }
  }, [setFrameloop])
  // the damped progress reaches 1 a little after the scrollbar does: check once it settles
  useFrame(() => {
    if (frameloop === 'always' && heroScroll.raw >= 1 && heroScroll.p >= 0.999) setFrameloop('never')
  })
  return null
}
