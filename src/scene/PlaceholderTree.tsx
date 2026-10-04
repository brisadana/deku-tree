import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { makeOutline } from '../shaders/outline'
import { makeToon } from '../shaders/toon'
import { treeDeformGLSL } from '../shaders/treeDeform'
import { n3, paint, taperedTube } from './geo'
import { makeLeafClusterTexture, rng } from './textures'
import { fx, U } from './uniforms'

/** Trunk silhouette as [radius, height]. */
const PROFILE: [number, number][] = [
  [3.6, -0.4], [3.1, 0.15], [2.55, 0.8], [2.2, 1.8], [2.05, 3.4], [2.0, 5.5],
  [2.05, 7.5], [2.35, 9.2], [2.8, 10.4], [2.3, 11.3], [0.6, 12.0],
]

export function trunkRadiusAt(y: number) {
  for (let i = 1; i < PROFILE.length; i++) {
    const [r1, y1] = PROFILE[i]
    const [r0, y0] = PROFILE[i - 1]
    if (y <= y1) return THREE.MathUtils.lerp(r0, r1, (y - y0) / (y1 - y0))
  }
  return PROFILE[PROFILE.length - 1][0]
}

/** Point on the trunk's front surface (+z), pushed out by `out`. */
function onFace(x: number, y: number, out = 0) {
  const r = trunkRadiusAt(y) + out
  return new THREE.Vector3(x, y, Math.sqrt(Math.max(r * r - x * x, 0)))
}

/** Anchors other systems (eyes, maw, camera) use to find the face. */
export const placeholderAnchors = {
  eyeL: onFace(-0.72, 5.55, -0.05),
  eyeR: onFace(0.72, 5.55, -0.05),
  mouth: onFace(0, 2.85, -0.05),
  faceCenter: onFace(0, 4.6, 0),
}

/** Canopy volumes as [x, y, z, radius]. */
const BLOBS: [number, number, number, number][] = [
  [0, 14.4, 0, 4.6], [-4.3, 12.9, 1.0, 3.6], [4.4, 13.1, 0.7, 3.8], [-2.5, 12.0, 3.1, 2.9],
  [2.6, 11.9, 3.0, 3.0], [0, 12.6, -3.6, 3.6], [-3.4, 15.6, -1.5, 3.0], [3.2, 15.9, -1.2, 3.0],
  [0, 16.9, 1.6, 2.6], [-6.7, 11.7, -0.6, 2.6], [6.8, 11.9, -0.4, 2.6], [0, 11.6, 3.6, 2.2],
]

const BARK = new THREE.Color('#8C7152')
const BARK_DARK = new THREE.Color('#5E4A37')
const MOSS = new THREE.Color('#5F8A5C')

function barkPaint(p: THREE.Vector3, c: THREE.Color) {
  const n = n3(p.x * 0.7, p.y * 0.35, p.z * 0.7)
  c.copy(BARK).lerp(BARK_DARK, THREE.MathUtils.clamp(0.35 + n * 0.5, 0, 1) * 0.6)
  const moss = THREE.MathUtils.smoothstep(1.6 - p.y, 0, 1.4) * THREE.MathUtils.clamp(0.5 + n, 0, 1)
  c.lerp(MOSS, moss * 0.75)
}

function buildTrunk() {
  const pts = PROFILE.map(([r, y]) => new THREE.Vector2(r, y))
  const g = new THREE.LatheGeometry(pts, 112)
  const pos = g.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const r = Math.hypot(v.x, v.z)
    if (r < 0.01) continue
    const a = Math.atan2(v.z, v.x)
    const front = Math.max(0, Math.sin(a)) // calmer bark where the face is
    const ridge =
      Math.sin(a * 13 + v.y * 0.25 + Math.sin(v.y * 0.8) * 0.6) * 0.07 * (1 - front * 0.75) +
      n3(v.x, v.y * 0.6, v.z) * 0.06
    const nr = r + ridge
    pos.setXYZ(i, (v.x / r) * nr, v.y, (v.z / r) * nr)
  }
  g.computeVertexNormals()
  return paint(g, barkPaint)
}

function buildRoots() {
  const angles = [0.6, -0.6, 1.45, -1.45, 2.2, -2.2, 2.85, -2.85]
  const parts = angles.map((a, i) => {
    const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a))
    const at = (r: number, y: number) => dir.clone().multiplyScalar(r).setY(y)
    const len = 6 + (i % 3) * 0.9
    const curve = new THREE.CatmullRomCurve3([at(1.9, 1.7), at(3.1, 0.75), at(len * 0.75, 0.15), at(len, -0.5)])
    return taperedTube(curve, 0.62, 0.12, 24, 10)
  })
  return paint(mergeGeometries(parts), barkPaint)
}

function buildBranches() {
  const parts = BLOBS.slice(1, 11).map(([x, y, z]) =>
    taperedTube(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(x * 0.1, 10.2, z * 0.1),
        new THREE.Vector3(x * 0.5, (10.6 + y) / 2, z * 0.5),
        new THREE.Vector3(x * 0.85, y - 0.6, z * 0.85),
      ]),
      0.55, 0.2, 16, 8,
    ),
  )
  return paint(mergeGeometries(parts), barkPaint)
}

function buildFace() {
  const parts: THREE.BufferGeometry[] = []
  for (const s of [-1, 1]) {
    // brow
    parts.push(
      taperedTube(
        new THREE.CatmullRomCurve3([onFace(s * 0.18, 6.05, 0.1), onFace(s * 0.8, 6.3, 0.16), onFace(s * 1.45, 5.95, 0.05)]),
        0.2, 0.1, 16, 8,
      ),
    )
    // moustache
    parts.push(
      taperedTube(
        new THREE.CatmullRomCurve3([
          onFace(s * 0.05, 4.35, 0.18), onFace(s * 0.75, 4.1, 0.2),
          onFace(s * 1.35, 3.45, 0.14), onFace(s * 1.55, 2.6, 0.08),
        ]),
        0.24, 0.07, 20, 8,
      ),
    )
  }
  const nose = new THREE.SphereGeometry(1, 16, 12)
  nose.scale(0.3, 0.62, 0.36)
  nose.translate(...onFace(0, 4.95, 0.12).toArray())
  parts.push(nose)
  // lower lip ridge
  parts.push(
    taperedTube(
      new THREE.CatmullRomCurve3([onFace(-0.85, 2.75, 0.02), onFace(0, 2.35, 0.12), onFace(0.85, 2.75, 0.02)]),
      0.14, 0.14, 16, 8,
    ),
  )
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()))
  g.computeVertexNormals()
  return paint(g, (p, c) => {
    barkPaint(p, c)
    c.multiplyScalar(1.08)
  })
}

function buildSockets() {
  const { eyeL, eyeR } = placeholderAnchors
  const defs: [THREE.Vector3, [number, number, number]][] = [
    [eyeL, [0.44, 0.27, 0.22]],
    [eyeR, [0.44, 0.27, 0.22]],
  ]
  return mergeGeometries(
    defs.map(([p, s]) => {
      const g = new THREE.SphereGeometry(1, 24, 16)
      g.scale(...s)
      g.rotateY(Math.atan2(p.x, p.z))
      g.translate(p.x, p.y, p.z)
      return g
    }),
  )
}

function buildCanopyBlobs() {
  const parts = BLOBS.map(([x, y, z, r]) => {
    const g = new THREE.IcosahedronGeometry(r, 3)
    const pos = g.attributes.position as THREE.BufferAttribute
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      v.multiplyScalar(1 + n3(v.x * 0.5 + x, v.y * 0.5 + y, v.z * 0.5) * 0.1)
      if (v.y < 0) v.y *= 0.72
      pos.setXYZ(i, v.x + x, v.y + y, v.z + z)
    }
    return g
  })
  const g = mergeGeometries(parts)
  g.computeVertexNormals()
  return g
}

/** Camera-facing brush-stroke leaf cards scattered over the canopy blobs. */
function buildCanopyCards(count: number) {
  const r = rng(11)
  const total = BLOBS.reduce((s, b) => s + b[3] * b[3], 0)
  const centers: number[] = []
  const normals: number[] = []
  const seeds: number[] = []
  for (const [x, y, z, rad] of BLOBS) {
    const n = Math.round((count * rad * rad) / total)
    for (let i = 0; i < n; i++) {
      const d = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize()
      if (d.y < -0.5 && r() < 0.7) d.y *= -0.3
      d.normalize()
      const k = 0.88 + r() * 0.16
      centers.push(x + d.x * rad * k, y + d.y * rad * k * (d.y < 0 ? 0.72 : 1), z + d.z * rad * k)
      normals.push(d.x, d.y, d.z)
      seeds.push(r(), r(), r(), r())
    }
  }
  const quad = new THREE.PlaneGeometry(1, 1)
  const g = new THREE.InstancedBufferGeometry()
  g.index = quad.index
  g.attributes.position = quad.attributes.position
  g.attributes.uv = quad.attributes.uv
  g.setAttribute('aCenter', new THREE.InstancedBufferAttribute(new Float32Array(centers), 3))
  g.setAttribute('aNormal', new THREE.InstancedBufferAttribute(new Float32Array(normals), 3))
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(seeds), 4))
  g.instanceCount = centers.length / 3
  return g
}

function canopyCardMaterial() {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: {
      ...THREE.UniformsLib.fog,
      uTime: U.uTime,
      uBreath: U.uBreath,
      uWind: U.uWind,
      uSunDir: U.uSunDir,
      uMap: { value: makeLeafClusterTexture() },
      uC0: { value: new THREE.Color('#24503D') },
      uC1: { value: new THREE.Color('#3A7457') },
      uC2: { value: new THREE.Color('#6BAA72') },
      uC3: { value: new THREE.Color('#B5D98C') },
      uGold: { value: new THREE.Color('#F4C95D') },
    },
    vertexShader: /* glsl */ `
      ${treeDeformGLSL}
      attribute vec3 aCenter;
      attribute vec3 aNormal;
      attribute vec4 aSeed;
      uniform vec3 uSunDir;
      varying vec2 vUv;
      varying float vLight;
      varying float vSeed;
      #include <fog_pars_vertex>
      void main() {
        vec3 c = treeDeform(aCenter);
        vec4 mvPosition = modelViewMatrix * vec4(c, 1.0);
        float a = aSeed.x * 6.2831 + sin(uTime * 0.8 + aSeed.y * 6.28) * 0.08 * uWind;
        vec2 q = mat2(cos(a), sin(a), -sin(a), cos(a)) * position.xy;
        mvPosition.xy += q * (1.7 + aSeed.z * 1.1);
        gl_Position = projectionMatrix * mvPosition;
        float nl = dot(normalize(aNormal), normalize(uSunDir));
        // fake ambient occlusion toward the canopy underside
        vLight = nl * 0.5 + 0.62 + aNormal.y * 0.18 - (1.0 - smoothstep(10.0, 14.0, aCenter.y)) * 0.25;
        vUv = uv;
        vSeed = aSeed.w;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uC0, uC1, uC2, uC3, uGold;
      varying vec2 vUv;
      varying float vLight;
      varying float vSeed;
      #include <fog_pars_fragment>
      void main() {
        vec4 t = texture2D(uMap, vUv);
        if (t.r < 0.5) discard;
        float l = vLight + (t.g - 0.8) * 0.5;
        vec3 col = l < 0.35 ? uC0 : (l < 0.58 ? uC1 : (l < 0.8 ? uC2 : uC3));
        col = mix(col, uGold, step(0.9, l) * step(0.7, vSeed) * 0.45);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  })
}

/** Procedural stand-in for the real model, built in tree space (y = 0 at the ground). */
export function PlaceholderTree() {
  const parts = useMemo(
    () => ({
      bark: makeToon({ vertexColors: true, deform: true, curse: true }),
      outline: makeOutline({ width: 0.0032 }),
      socket: new THREE.MeshBasicMaterial({ color: '#0F1A14' }),
      canopyInner: makeToon({ color: '#3A7457', deform: true }),
      cards: canopyCardMaterial(),
      solids: [buildTrunk(), buildRoots(), buildBranches(), buildFace()],
      sockets: buildSockets(),
      blobs: buildCanopyBlobs(),
      cardGeo: buildCanopyCards(2400),
    }),
    [],
  )

  // The maw: a dark opening behind the mouth that widens with fx.maw.
  const maw = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const m = maw.current
    if (!m) return
    const k = fx.maw
    m.scale.set(0.7 + k * 0.45, 0.4 + k * 0.85, 0.26 + k * 0.3)
    m.position.y = placeholderAnchors.mouth.y - k * 0.35
  })

  return (
    <group>
      {parts.solids.map((g, i) => (
        <group key={i}>
          <mesh geometry={g} material={parts.bark} />
          <mesh geometry={g} material={parts.outline} />
        </group>
      ))}
      <mesh geometry={parts.sockets} material={parts.socket} />
      <mesh
        ref={maw}
        material={parts.socket}
        position={placeholderAnchors.mouth}
        scale={[0.7, 0.4, 0.26]}
      >
        <sphereGeometry args={[1, 32, 20]} />
      </mesh>
      <mesh geometry={parts.blobs} material={parts.canopyInner} />
      <mesh geometry={parts.cardGeo} material={parts.cards} frustumCulled={false} />
    </group>
  )
}
