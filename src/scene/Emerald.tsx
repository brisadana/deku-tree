import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeOutline } from '../shaders/outline'
import { makeToon } from '../shaders/toon'
import { organic01 } from '../motion/eases'
import { ROOMS } from './layout'
import { fx } from './uniforms'

/** Kokiri's Emerald (stylized placeholder): rises from the boss room's roots and spins. */
export function Emerald() {
  const group = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const base = ROOMS[3].pos

  const parts = useMemo(() => {
    const gem = new THREE.OctahedronGeometry(1, 0)
    gem.scale(0.42, 0.62, 0.42)
    return {
      gem,
      gemMat: makeToon({ color: '#3FCB7A', emissive: new THREE.Color('#1F9E58'), emissiveIntensity: 0.6 }),
      setting: makeToon({ color: '#E2B64C' }),
      outline: makeOutline({ width: 0.004, deform: false }),
    }
  }, [])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const e = organic01(fx.emerald)
    g.visible = fx.emerald > 0.001
    g.position.set(base.x, base.y + 0.4 + e * 2.4, base.z)
    g.rotation.y = fx.spin * 1.4
    g.scale.setScalar(0.6 + e * 1.0)
    if (light.current) light.current.intensity = e * 10
  })

  return (
    <group ref={group}>
      <mesh geometry={parts.gem} material={parts.gemMat} />
      <mesh geometry={parts.gem} material={parts.outline} />
      <mesh material={parts.setting} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.45, 0.06, 8, 24]} />
      </mesh>
      <pointLight ref={light} color="#7CF0A6" intensity={0} distance={8} />
    </group>
  )
}
