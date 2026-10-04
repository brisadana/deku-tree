import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { heroConfig } from './hero.config'
import { HU, patchMaterial } from './uniforms'
import { useTree } from './useModels'

const toRad = THREE.MathUtils.degToRad

/*
 * Sway and breathing are computed in the tree's normalised frame (metres,
 * base at y=0, face toward +Z), whatever the model's internal node transforms are.
 */
const head = /* glsl */ `
uniform float uTime;
uniform mat4 uToTree;
uniform mat4 uFromTree;
uniform float uHeight, uSway, uSwaySpeed, uCanopyStart, uBreath, uBreathPeriod, uTrunkTop;
`
const body = /* glsl */ `
{
  vec3 p = (uToTree * vec4(transformed, 1.0)).xyz;
  float h = clamp(p.y / uHeight, 0.0, 1.0);

  // canopy: slow sway that grows toward the top
  float c = smoothstep(uCanopyStart, 1.0, h);
  float t = uTime * uSwaySpeed;
  float ph = p.y * 0.07 + p.x * 0.05;
  p.x += (sin(t + ph) * 0.7 + sin(t * 2.1 + ph * 2.0) * 0.3) * uSway * c;
  p.z += sin(t * 0.8 + ph * 1.4 + 1.3) * 0.5 * uSway * c;

  // trunk: barely-there radial breathing, faded out under the canopy
  float trunk = 1.0 - smoothstep(uTrunkTop * 0.75, uTrunkTop, h);
  float b = sin(uTime * 6.2831853 / uBreathPeriod) * uBreath * trunk * smoothstep(0.0, 0.08, h);
  vec2 r = p.xz;
  p.xz += (length(r) > 1e-3 ? normalize(r) : vec2(0.0)) * b;

  transformed = (uFromTree * vec4(p, 1.0)).xyz;
}
`

type Props = { children?: ReactNode }

/** The Deku Tree, normalised to `heroConfig.tree.height`, mouth toward +Z. Children live in the same frame. */
export function DekuTree({ children }: Props) {
  const { scene } = useTree()
  const frame = useRef<THREE.Group>(null)
  const yaw = useRef<THREE.Group>(null)
  const uniforms = useMemo(
    () => ({
      uTime: HU.uTime,
      uToTree: { value: new THREE.Matrix4() },
      uFromTree: { value: new THREE.Matrix4() },
      uHeight: { value: heroConfig.tree.height },
      uSway: { value: 0 },
      uSwaySpeed: { value: 0 },
      uCanopyStart: { value: 0 },
      uBreath: { value: 0 },
      uBreathPeriod: { value: 6 },
      uTrunkTop: { value: 0.5 },
    }),
    [],
  )

  // scale + centre once, from the untransformed bounds
  const fit = useMemo(() => {
    scene.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const s = heroConfig.tree.height / size.y
    const c = box.getCenter(new THREE.Vector3())
    return { s, pos: [-c.x * s, -box.min.y * s, -c.z * s] as [number, number, number] }
  }, [scene])

  useLayoutEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.castShadow = true
      m.receiveShadow = false
      // leaf cards are single-sided in the source; show both faces so the canopy has no holes
      ;(m.material as THREE.Material).side = THREE.DoubleSide
      patchMaterial(m.material as THREE.Material, 'deku-tree', uniforms, head, body)
    })
  }, [scene, uniforms])

  useFrame(() => {
    const c = heroConfig.tree
    if (yaw.current) yaw.current.rotation.y = toRad(c.rotationY)
    frame.current?.position.set(...c.offset)
    uniforms.uSway.value = c.canopySway
    uniforms.uSwaySpeed.value = c.canopySwaySpeed
    uniforms.uCanopyStart.value = c.canopyStart
    uniforms.uBreath.value = c.breathAmount
    uniforms.uBreathPeriod.value = c.breathPeriod
    uniforms.uTrunkTop.value = c.trunkTop

    // mesh-local ↔ tree-frame matrices (only the single tree mesh needs them)
    if (!frame.current) return
    frame.current.updateMatrixWorld(true)
    const frameInv = new THREE.Matrix4().copy(frame.current.matrixWorld).invert()
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      uniforms.uToTree.value.multiplyMatrices(frameInv, m.matrixWorld)
      uniforms.uFromTree.value.copy(uniforms.uToTree.value).invert()
    })
  })

  return (
    <group ref={frame} name="treeFrame">
      <group ref={yaw}>
        <group scale={fit.s} position={fit.pos}>
          <primitive object={scene} />
        </group>
      </group>
      {children}
    </group>
  )
}
