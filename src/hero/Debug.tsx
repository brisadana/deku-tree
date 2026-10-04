import { Stats } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { treeParts } from './DekuTree'
import { eyeState, resetEyes } from './eyeMachine'
import { heroConfig } from './hero.config'

type GUI = import('lil-gui').GUI
type Obj = Record<string, unknown>

/** Slider ranges for keys where a guess would be wrong; everything else is inferred. */
const RANGES: Record<string, [number, number, number?]> = {
  fov: [15, 75, 0.5],
  yaw: [0, 10, 0.1],
  pitch: [0, 5, 0.1],
  tilt: [-45, 45, 0.5],
  rotationY: [-180, 180, 1],
  exposure: [0.3, 2.5, 0.01],
  midHeight: [0, 0.5, 0.005],
  zenithHeight: [0.1, 1, 0.01],
  parallaxFactor: [0, 1, 0.01],
  coverage: [0, 1, 0.01],
  softness: [0, 0.6, 0.01],
  opacity: [0, 1, 0.01],
  variation: [0, 1, 0.01],
  leafRatio: [0, 1, 0.01],
  farDensity: [0, 1, 0.01],
  clumpStrength: [0, 1, 0.01],
  canopyStart: [0, 1, 0.01],
  trunkTop: [0, 1, 0.01],
  pupilShift: [0, 0.4, 0.005],
  pupilSize: [0, 0.6, 0.005],
  drowsyOpen: [0, 1, 0.01],
  bloomThreshold: [0, 4, 0.01],
  bloomSmoothing: [0, 1, 0.01],
  vignetteOffset: [0, 1, 0.01],
  vignetteDarkness: [0, 1, 0.01],
  lift: [0, 0.3, 0.005],
}

/** Keys read once at startup; shown but marked. */
const RELOAD = new Set(['countDesktop', 'countMobile', 'ringRadius', 'trunkRadius', 'frontReach', 'frontHalfWidth', 'mobileHalfWidth', 'farDensity', 'bladeHeightJitter', 'clumpScale', 'clumpStrength', 'poolSize', 'dprDesktop', 'dprMobile', 'multisampling', 'height', 'shadowExtent', 'shadowMapSize', 'radius', 'smaa'])

function guessRange(key: string, v: number): [number, number, number] {
  const r = RANGES[key]
  if (r) return [r[0], r[1], r[2] ?? (r[1] - r[0]) / 200]
  if (Number.isInteger(v) && Math.abs(v) >= 10) return [0, Math.max(10, v * 3), 1]
  const m = Math.max(Math.abs(v) * 3, 1)
  return [v < 0 ? -m : 0, m, m / 300]
}

function build(gui: GUI, obj: Obj, path: string) {
  for (const [key, v] of Object.entries(obj)) {
    const label = RELOAD.has(key) ? `${key} (reload)` : key
    if (typeof v === 'number') {
      const [a, b, s] = guessRange(key, v)
      gui.add(obj, key, a, b, s).name(label)
    } else if (typeof v === 'string' && v.startsWith('#')) {
      gui.addColor(obj, key).name(label)
    } else if (typeof v === 'string' || typeof v === 'boolean') {
      gui.add(obj, key).name(label)
    } else if (Array.isArray(v) && v.every((x) => typeof x === 'number')) {
      const f = gui.addFolder(label).close()
      const axes = ['x', 'y', 'z', 'w']
      v.forEach((x, i) => {
        const span = Math.max(Math.abs(x) * 2, 5)
        f.add(v as unknown as Obj, String(i), x - span, x + span, span / 400).name(axes[i] ?? String(i))
      })
    } else if (Array.isArray(v)) {
      const f = gui.addFolder(label).close()
      v.forEach((item, i) => build(f.addFolder(String(i)), item as Obj, `${path}.${key}.${i}`))
    } else if (v && typeof v === 'object') {
      build(gui.addFolder(label).close(), v as Obj, `${path}.${key}`)
    }
  }
}

/**
 * `?debug=1`: a lil-gui panel bound live to heroConfig, fps stats, and a face picker:
 * Alt+click the tree to log the point in the tree's frame (for placing the eyes).
 */
export function Debug() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    let gui: GUI | null = null
    let alive = true
    const picked = { point: '—' }
    import('lil-gui').then(({ default: LilGUI }) => {
      if (!alive) return
      gui = new LilGUI({ title: 'Hero config (live)', width: 320 })
      const tools = gui.addFolder('Tools')
      tools.add(picked, 'point').name('Alt+click face →').listen().disable()
      tools.add({ wake: () => resetEyes() }, 'wake').name('reset eyes to SLEEP')
      tools.add({ log: () => console.log('heroConfig', JSON.stringify(heroConfig, null, 2)) }, 'log').name('log config JSON')
      tools.add(eyeState, 'state').listen().disable()
      build(gui, heroConfig as unknown as Obj, 'heroConfig')
    })

    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const onClick = (e: MouseEvent) => {
      if (!e.altKey || !treeParts.model || !treeParts.frame) return
      const r = gl.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const hit = ray.intersectObject(treeParts.model, true)[0]
      if (!hit) return
      const p = treeParts.frame.worldToLocal(hit.point.clone())
      picked.point = `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`
      console.log('[tree frame]', picked.point)
    }
    window.addEventListener('click', onClick)
    return () => {
      alive = false
      gui?.destroy()
      window.removeEventListener('click', onClick)
    }
  }, [camera, gl])

  return <Stats className="hero-stats" />
}
