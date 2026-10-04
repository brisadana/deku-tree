import { useFrame } from '@react-three/fiber'
import { forwardRef, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { DekuTree } from './DekuTree'
import { heroConfig } from './hero.config'
import { HU, patchMaterial } from './uniforms'
import { useForest } from './useModels'

const tmpColor = new THREE.Color()

const foliageHead = /* glsl */ `
uniform float uTime, uWindAmp, uWindSpeed, uWindFreq;
`
// amplitude grows with height; two detuned sines + a cross wobble, phase by position
const foliageBody = /* glsl */ `
{
  float hgt = max(transformed.y + 1.0, 0.0);
  float ph = (transformed.x + transformed.z * 0.7) * uWindFreq;
  float t = uTime * uWindSpeed;
  float sway = sin(t + ph) * 0.65 + sin(t * 2.3 + ph * 1.9) * 0.25;
  transformed.x += sway * hgt * uWindAmp;
  transformed.z += cos(t * 0.8 + ph * 1.3) * 0.45 * hgt * uWindAmp;
}
`

/** Clearing, forest, cliffs and path. Loaded at the origin with no transform. */
function Forest() {
  const { scene } = useForest()
  const uniforms = useMemo(
    () => ({ uTime: HU.uTime, uWindAmp: { value: 0 }, uWindSpeed: { value: 0 }, uWindFreq: { value: 0 } }),
    [],
  )
  const tinted = useRef<[THREE.MeshStandardMaterial, THREE.Color][]>([])

  useLayoutEffect(() => {
    tinted.current = []
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mat = m.material as THREE.MeshStandardMaterial
      m.castShadow = false
      m.receiveShadow = m.name === 'Ground' || m.name === 'Cliffs'
      if (m.name === 'Foliage') patchMaterial(mat, 'forest-foliage', uniforms, foliageHead, foliageBody)
      else patchMaterial(mat, `forest-${m.name}`)
      tinted.current.push([mat, mat.color.clone()])
    })
  }, [scene, uniforms])

  useFrame(() => {
    const c = heroConfig.forest
    uniforms.uWindAmp.value = c.windAmp
    uniforms.uWindSpeed.value = c.windSpeed
    uniforms.uWindFreq.value = c.windFreq
    for (const [mat, base] of tinted.current) mat.color.copy(base).multiply(tmpColor.set(c.tint))
  })

  return <primitive object={scene} />
}

/** Warm sun from behind-left-above (rim + tree shadow on the meadow) and a cool sky fill. */
export function Lights() {
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const { shadowExtent: e, shadowMapSize } = heroConfig.light

  useFrame(() => {
    const c = heroConfig.light
    const s = sun.current
    const h = hemi.current
    if (!s || !h) return
    s.color.set(c.sunColor)
    s.intensity = c.sunIntensity
    s.position.set(...c.sunPosition)
    s.shadow.bias = c.shadowBias
    s.shadow.normalBias = c.shadowNormalBias
    s.shadow.radius = c.shadowRadius
    h.color.set(c.hemiSky)
    h.groundColor.set(c.hemiGround)
    h.intensity = c.hemiIntensity
  })

  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-left={-e}
        shadow-camera-right={e}
        shadow-camera-top={e}
        shadow-camera-bottom={-e}
        shadow-camera-near={1}
        shadow-camera-far={140}
      />
    </>
  )
}

type WorldProps = { children?: ReactNode; treeChildren?: ReactNode }

/** Everything that turns with the cursor: forest, tree, grass. */
export const World = forwardRef<THREE.Group, WorldProps>(function World({ children, treeChildren }, ref) {
  return (
    <group ref={ref} name="world">
      <Forest />
      <DekuTree>{treeChildren}</DekuTree>
      {children}
    </group>
  )
})
