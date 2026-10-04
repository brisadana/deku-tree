import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { env } from '../lib/env'
import { sceneColor } from './color'
import { heroConfig } from './hero.config'
import { Parallax, parallax } from './Parallax'
import { Post } from './Post'
import { Sky } from './Sky'
import { FlyingBlades, flyingStats } from './FlyingBlades'
import { Grass, trail } from './Grass'
import { HU } from './uniforms'
import { pointer, PointerTracker } from './usePointer'
import { preloadModels } from './useModels'
import { Lights, World } from './World'
import styles from './Hero.module.css'

preloadModels()

// dev/test hook: scripts read and tweak the live instances (Vite may serve cache-busted copies otherwise)
if (import.meta.env.DEV) Object.assign(window, { __hero: { config: heroConfig, HU, pointer, parallax, trail, flyingStats } })

/** Set once both models are in the scene. */
const loaded = { value: false }

const ease = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3)

/** Fixed camera: desktop or mobile framing from the config (re-read every frame for the GUI). */
function HeroCamera() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const width = useThree((s) => s.size.width)
  useFrame(() => {
    const c = heroConfig.camera
    const f = width < c.mobileBreakpoint ? c.mobile : c.desktop
    camera.position.set(...f.position)
    camera.lookAt(...f.target)
    if (camera.fov !== f.fov || camera.near !== c.near || camera.far !== c.far) {
      camera.fov = f.fov
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

/** Dev only: frames per second into window.__hero.fps (for scripted checks). */
function FpsProbe() {
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
      </group>
      <Lights />
      <PointerTracker world={world} />
      <Parallax world={world} sky={skyPivot} />
      <Suspense fallback={null}>
        <World ref={world}>
          <Grass />
          <FlyingBlades />
        </World>
        <Ready />
      </Suspense>
      <Post />
      {import.meta.env.DEV && <FpsProbe />}
    </>
  )
}

export function Hero() {
  const dpr = env.isMobile ? heroConfig.renderer.dprMobile : heroConfig.renderer.dprDesktop
  return (
    <section className={styles.hero} aria-label="The Great Deku Tree">
      <div className={styles.canvas} aria-hidden="true">
        <Canvas
          dpr={[1, dpr]}
          shadows={{ type: THREE.PCFShadowMap }}
          gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
          camera={{ fov: 35, position: [0, 6, 34], near: 0.5, far: 900 }}
        >
          <Scene />
          <VisibilityPause />
        </Canvas>
      </div>
    </section>
  )
}

/** Pauses rendering while the tab is hidden. */
function VisibilityPause() {
  const setFrameloop = useThree((s) => s.setFrameloop)
  useEffect(() => {
    const on = () => setFrameloop(document.hidden ? 'never' : 'always')
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [setFrameloop])
  return null
}
