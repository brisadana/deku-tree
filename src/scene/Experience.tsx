import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stats } from '@react-three/drei'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { env, params } from '../lib/env'
import { Director } from './Director'
import { Dungeon } from './Dungeon'
import { FallingLeaves } from './FallingLeaves'
import { Grass } from './Grass'
import { Ground } from './Ground'
import { SKY } from './palette'
import { PlaceholderTree } from './PlaceholderTree'
import { Sky } from './Sky'
import { Treeline } from './Treeline'
import { U } from './uniforms'
import styles from './Experience.module.css'

function Fog() {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    scene.fog = new THREE.Fog(SKY.day.horizon.clone(), 38, 150)
  }, [scene])
  return null
}

function Clock() {
  useFrame((_, dt) => {
    U.uTime.value += Math.min(dt, 0.05)
  })
  return null
}

function World() {
  const forest = useRef<THREE.Group>(null)
  const dungeon = useRef<THREE.Group>(null)
  return (
    <>
      <group ref={forest}>
        <hemisphereLight args={['#D6E6C6', '#2F5D4A', 1.1]} />
        <directionalLight color="#FFE4B0" intensity={2.4} position={U.uSunDir.value.clone().multiplyScalar(60)} />
        <Sky />
        <Ground />
        <Treeline />
        <Grass />
        <PlaceholderTree />
        <FallingLeaves />
      </group>
      <group ref={dungeon} visible={false}>
        <Dungeon />
      </group>
      {params.debug ? <OrbitControls target={[0, 4.8, 0]} /> : <Director forest={forest} dungeon={dungeon} />}
    </>
  )
}

export function Experience() {
  return (
    <div className={styles.canvas} aria-hidden="true">
      <Canvas
        flat
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: env.isMobile ? 55 : 42, position: [0, 1.4, 22], near: 0.1, far: 1000 }}
      >
        <Clock />
        <Fog />
        <World />
        {params.debug && <Stats />}
      </Canvas>
    </div>
  )
}
