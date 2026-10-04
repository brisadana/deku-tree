import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { makeOutline } from '../shaders/outline'
import { makeToon } from '../shaders/toon'
import { n3, paint, taperedTube } from './geo'
import { DUNGEON, ROOMS, roomInward, type RoomKind } from './layout'
import { Emerald } from './Emerald'
import { rng } from './textures'
import { fx } from './uniforms'

const CURSE = new THREE.Color('#6B3FA0')
const CURSE_HOT = new THREE.Color('#B07BEA')

/* ---------- Static architecture ---------- */

function buildWall() {
  const { radius } = DUNGEON
  const g = new THREE.CylinderGeometry(radius, radius + 3, 64, 96, 24, true)
  const pos = g.attributes.position as THREE.BufferAttribute
  const p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    const a = Math.atan2(p.z, p.x)
    const r = Math.hypot(p.x, p.z)
    const k = 1 + Math.sin(a * 22 + p.y * 0.15) * 0.012 + n3(p.x * 0.2, p.y * 0.12, p.z * 0.2) * 0.03
    pos.setXYZ(i, (p.x / r) * r * k, p.y, (p.z / r) * r * k)
  }
  g.computeVertexNormals()
  const dark = new THREE.Color('#4A3828')
  const mid = new THREE.Color('#7A5C3E')
  paint(g, (q, c) => {
    const ring = Math.sin(q.y * 1.4 + n3(q.x * 0.3, 0, q.z * 0.3) * 2) * 0.5 + 0.5
    c.copy(dark).lerp(mid, ring * 0.6)
  })
  g.translate(DUNGEON.center.x, DUNGEON.center.y + 6, DUNGEON.center.z)
  return g
}

function buildFloor() {
  const g = new THREE.CircleGeometry(DUNGEON.radius + 3, 64)
  g.rotateX(-Math.PI / 2)
  g.translate(DUNGEON.center.x, DUNGEON.floorY, DUNGEON.center.z)
  return g
}

function buildRoots(seed = 3) {
  const r = rng(seed)
  const { center, radius, floorY } = DUNGEON
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + r() * 0.3
    const pts: THREE.Vector3[] = []
    const y0 = floorY + 0.2
    const h = 18 + r() * 22
    for (let k = 0; k <= 5; k++) {
      const t = k / 5
      const aa = a + Math.sin(t * 3 + i) * 0.12
      const rr = radius - 0.6 - Math.sin(t * Math.PI) * (0.8 + r() * 1.4)
      pts.push(new THREE.Vector3(center.x + Math.cos(aa) * rr, y0 + t * h, center.z + Math.sin(aa) * rr))
    }
    parts.push(taperedTube(new THREE.CatmullRomCurve3(pts), 0.32 + r() * 0.18, 0.08, 40, 8))
  }
  return mergeGeometries(parts)
}

function webGeometry(radius: number, spokes = 14, rings = 7) {
  const pts: number[] = []
  for (let s = 0; s < spokes; s++) {
    const a = (s / spokes) * Math.PI * 2
    pts.push(0, 0, 0, Math.cos(a) * radius, Math.sin(a) * radius, 0)
  }
  for (let ring = 1; ring <= rings; ring++) {
    const rr = (ring / rings) * radius
    for (let s = 0; s < spokes; s++) {
      const a0 = (s / spokes) * Math.PI * 2
      const a1 = ((s + 1) / spokes) * Math.PI * 2
      // sag between spokes for a hand-drawn feel
      const sag = 0.9
      const am = (a0 + a1) / 2
      pts.push(Math.cos(a0) * rr, Math.sin(a0) * rr, 0, Math.cos(am) * rr * sag, Math.sin(am) * rr * sag, 0)
      pts.push(Math.cos(am) * rr * sag, Math.sin(am) * rr * sag, 0, Math.cos(a1) * rr, Math.sin(a1) * rr, 0)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  return g
}

/* ---------- Placeholder props (replace freely) ---------- */

function Prop({ kind }: { kind: RoomKind }) {
  const mats = useMemo(
    () => ({
      steel: makeToon({ color: '#D9DEE0' }),
      gold: makeToon({ color: '#E2B64C' }),
      blue: makeToon({ color: '#3F6FB0' }),
      wood: makeToon({ color: '#9A6B3E' }),
      woodDark: makeToon({ color: '#6A4426' }),
      red: makeToon({ color: '#B8392E' }),
      band: makeToon({ color: '#C9B48A' }),
      gohmaShell: makeToon({ color: '#3D5A3A' }),
      eyeWhite: new THREE.MeshBasicMaterial({ color: '#F2E6C9' }),
      eyeRed: new THREE.MeshBasicMaterial({ color: '#D2392B' }),
      pupil: new THREE.MeshBasicMaterial({ color: '#0F1A14' }),
      outline: makeOutline({ width: 0.004, deform: false }),
    }),
    [],
  )
  switch (kind) {
    case 'sword':
      return (
        <group rotation-z={0.15}>
          <mesh material={mats.steel} position-y={0.75}>
            <boxGeometry args={[0.12, 1.1, 0.03]} />
          </mesh>
          <mesh material={mats.steel} position-y={1.34} rotation-z={Math.PI / 4}>
            <boxGeometry args={[0.085, 0.085, 0.03]} />
          </mesh>
          <mesh material={mats.blue} position-y={0.18}>
            <boxGeometry args={[0.42, 0.07, 0.09]} />
          </mesh>
          <mesh material={mats.woodDark} position-y={-0.02}>
            <cylinderGeometry args={[0.04, 0.045, 0.34, 10]} />
          </mesh>
          <mesh material={mats.gold} position-y={-0.21}>
            <sphereGeometry args={[0.065, 12, 8]} />
          </mesh>
        </group>
      )
    case 'shield':
      return (
        <group position-y={0.55} rotation-x={-0.1}>
          <mesh material={mats.wood} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.6, 0.6, 0.09, 32]} />
          </mesh>
          <mesh material={mats.outline} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.6, 0.6, 0.09, 32]} />
          </mesh>
          <mesh material={mats.woodDark} rotation-x={Math.PI / 2} position-z={0.03}>
            <torusGeometry args={[0.56, 0.05, 8, 32]} />
          </mesh>
          {/* stylized emblem: a leaf mark, not the Nintendo crest */}
          <mesh material={mats.red} position-z={0.055} rotation-z={0.4} scale={[0.16, 0.3, 0.02]}>
            <sphereGeometry args={[1, 16, 12]} />
          </mesh>
        </group>
      )
    case 'slingshot':
      return (
        <group position-y={0.1}>
          <mesh material={mats.wood} position-y={0.3}>
            <cylinderGeometry args={[0.06, 0.07, 0.6, 10]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} material={mats.wood} position={[s * 0.17, 0.78, 0]} rotation-z={-s * 0.45}>
              <cylinderGeometry args={[0.05, 0.06, 0.48, 10]} />
            </mesh>
          ))}
          <mesh material={mats.band} position-y={0.98}>
            <torusGeometry args={[0.3, 0.018, 6, 24, Math.PI]} />
          </mesh>
        </group>
      )
    case 'gohma':
      return (
        <group position-y={0.7}>
          <mesh material={mats.gohmaShell} scale={[0.75, 0.62, 0.62]}>
            <sphereGeometry args={[1, 24, 16]} />
          </mesh>
          <mesh material={mats.outline} scale={[0.75, 0.62, 0.62]}>
            <sphereGeometry args={[1, 24, 16]} />
          </mesh>
          <mesh material={mats.eyeRed} position-z={0.42} scale={[0.36, 0.36, 0.25]}>
            <sphereGeometry args={[1, 20, 14]} />
          </mesh>
          <mesh material={mats.pupil} position-z={0.6} scale={[0.07, 0.24, 0.05]}>
            <sphereGeometry args={[1, 12, 10]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} material={mats.gohmaShell} position={[s * 0.55, 0.45, 0.1]} rotation-z={-s * 0.7}>
              <coneGeometry args={[0.12, 0.6, 8]} />
            </mesh>
          ))}
        </group>
      )
  }
}

function Room({ index }: { index: number }) {
  const { pos, kind } = ROOMS[index]
  const spin = useRef<THREE.Group>(null)
  const gohma = useRef<THREE.Group>(null)
  const inward = useMemo(() => roomInward(pos), [pos])
  const side = useMemo(() => new THREE.Vector3(-inward.z, 0, inward.x), [inward])
  const mats = useMemo(
    () => ({
      platform: makeToon({ color: '#6E5034' }),
      stone: makeToon({ color: '#6F7B63' }),
      outline: makeOutline({ width: 0.003, deform: false }),
      flame: new THREE.MeshBasicMaterial({ color: '#FFB347' }),
      post: makeToon({ color: '#3C2B1C' }),
    }),
    [],
  )

  useFrame(() => {
    if (spin.current) spin.current.rotation.y = fx.spin * 0.6 + index
    if (gohma.current) gohma.current.scale.setScalar(Math.max(0.001, fx.gohma))
  })

  return (
    <group position={pos}>
      <mesh material={mats.platform} position-y={-0.25}>
        <cylinderGeometry args={[3.4, 3.1, 0.5, 40]} />
      </mesh>
      <mesh material={mats.outline} position-y={-0.25}>
        <cylinderGeometry args={[3.4, 3.1, 0.5, 40]} />
      </mesh>
      <mesh material={mats.stone} position-y={0.45}>
        <cylinderGeometry args={[0.55, 0.7, 0.9, 16]} />
      </mesh>
      <mesh material={mats.outline} position-y={0.45}>
        <cylinderGeometry args={[0.55, 0.7, 0.9, 16]} />
      </mesh>
      <group ref={kind === 'gohma' ? gohma : undefined} position-y={1.0}>
        <group ref={spin}>
          <Prop kind={kind} />
        </group>
      </group>
      {[-1, 1].map((s) => {
        const p = side.clone().multiplyScalar(s * 2.2).addScaledVector(inward, -0.8)
        return (
          <group key={s} position={[p.x, 0, p.z]}>
            <mesh material={mats.post} position-y={0.8}>
              <cylinderGeometry args={[0.08, 0.12, 1.6, 8]} />
            </mesh>
            <mesh material={mats.flame} position-y={1.78}>
              <coneGeometry args={[0.16, 0.42, 10]} />
            </mesh>
          </group>
        )
      })}
      <pointLight position={[0, 2.4, 0]} color="#FFB45A" intensity={22} distance={16} decay={1.6} />
    </group>
  )
}

/** Interior of the Deku Tree: a hollow trunk with four platforms (rooms). */
export function Dungeon() {
  const parts = useMemo(() => {
    const webs = [
      { pos: DUNGEON.center.clone().setY(-96.5), rot: [-Math.PI / 2, 0, 0.3], r: 8 },
      { pos: new THREE.Vector3(5, -89, -27), rot: [0, -0.4, 0], r: 3.5 },
      { pos: new THREE.Vector3(-2, -88, -28.5), rot: [0, 0.3, 0.6], r: 4.2 },
      { pos: new THREE.Vector3(-14, -96, -20), rot: [0, 1.0, 0], r: 3 },
    ]
    return {
      wall: buildWall(),
      floor: buildFloor(),
      roots: buildRoots(),
      webs: webs.map((w) => ({ ...w, geo: webGeometry(w.r) })),
      wallMat: makeToon({ vertexColors: true, side: THREE.BackSide }),
      floorMat: makeToon({ color: '#2B2219' }),
      rootMat: makeToon({ color: '#3B2C1E', emissive: CURSE, emissiveIntensity: 1 }),
      rootOutline: makeOutline({ width: 0.003, deform: false }),
      webMat: new THREE.LineBasicMaterial({ color: '#E8E2D0', transparent: true, opacity: 0.55, fog: true }),
    }
  }, [])

  useFrame(() => {
    const g = fx.rootGlow
    parts.rootMat.emissive.copy(CURSE).lerp(CURSE_HOT, g * 0.25)
    parts.rootMat.emissiveIntensity = 0.05 + g * 0.55
  })

  return (
    <group>
      <mesh geometry={parts.wall} material={parts.wallMat} />
      <mesh geometry={parts.floor} material={parts.floorMat} />
      <mesh geometry={parts.roots} material={parts.rootMat} />
      <mesh geometry={parts.roots} material={parts.rootOutline} />
      {parts.webs.map((w, i) => (
        <lineSegments
          key={i}
          geometry={w.geo}
          material={parts.webMat}
          position={w.pos}
          rotation={w.rot as [number, number, number]}
        />
      ))}
      {ROOMS.map((_, i) => (
        <Room key={i} index={i} />
      ))}
      <Emerald />
      <hemisphereLight args={['#8A76A8', '#2A1C12', 1.5]} />
    </group>
  )
}
