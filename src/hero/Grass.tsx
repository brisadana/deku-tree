import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { env } from '../lib/env'
import { noiseGLSL } from '../shaders/noise'
import { heroConfig } from './hero.config'
import { treeParts } from './DekuTree'
import { buildTreeFootprint, useGroundField, type GroundField } from './groundField'
import { HU } from './uniforms'
import { pointer } from './usePointer'

/** Max trail points the shader loops over (uniform array size; reload). */
export const TRAIL_MAX = 24

/**
 * Cursor trail in the world group's local space: x, z, birth time (s), strength.
 * Written here, read by the grass shader (and by FlyingBlades for spawning).
 */
export const trail = {
  points: Array.from({ length: TRAIL_MAX }, () => new THREE.Vector4(0, 0, -1e3, 0)),
  head: 0,
  lastPush: -1e3,
  last: new THREE.Vector2(1e5, 1e5),
}

/** Smooth 2D value noise (0..1) for clumps. */
function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function vnoise(x: number, z: number) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const ux = fx * fx * (3 - 2 * fx)
  const uz = fz * fz * (3 - 2 * fz)
  const a = hash(ix, iz)
  const b = hash(ix + 1, iz)
  const c = hash(ix, iz + 1)
  const d = hash(ix + 1, iz + 1)
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz
}

/** Root/trunk footprint on the ground grid (0 free → 1 covered), built once the tree is in place. */
let footprint: Float32Array | null = null

/** How much the tree's roots cover x,z (0..1, soft at the edges). */
function rootsAt(field: GroundField, x: number, z: number) {
  if (!footprint) return Math.hypot(x, z) < heroConfig.grass.trunkRadius + 4 ? 1 : 0
  const gx = Math.floor((x + field.extent) / field.cell)
  const gz = Math.floor((z + field.extent) / field.cell)
  if (gx < 0 || gz < 0 || gx >= field.n || gz >= field.n) return 0
  return footprint[gz * field.n + gx]
}

/** True where grass grows (same rules as placement, without the randomness). */
export function meadowAt(field: GroundField, x: number, z: number) {
  const c = heroConfig.grass
  const r = Math.hypot(x, z)
  const inside = r < c.ringRadius || (z > 0 && z < c.frontReach && Math.abs(x) < c.frontHalfWidth)
  return inside && r > c.trunkRadius && rootsAt(field, x, z) < c.rootClearance && field.dirtAt(x, z) < 0.4 && !Number.isNaN(field.height(x, z))
}

/** Random blade roots inside the meadow: off the path, clear of the trunk, denser near the camera. */
function placeBlades(field: GroundField, count: number) {
  const c = heroConfig.grass
  const roots = new Float32Array(count * 3)
  const blades = new Float32Array(count * 4)
  let i = 0
  let guard = 0
  while (i < count && guard++ < count * 40) {
    // uniform over the bounding box of disc ∪ front strip, then keep what's inside
    const x = (Math.random() * 2 - 1) * Math.max(c.ringRadius, c.frontHalfWidth)
    const z = -c.ringRadius + Math.random() * (c.frontReach + c.ringRadius)
    const r = Math.hypot(x, z)
    const inDisc = r < c.ringRadius
    const inFront = z > 0 && z < c.frontReach && Math.abs(x) < c.frontHalfWidth
    if (!inDisc && !inFront) continue
    if (env.isMobile && Math.abs(x) > c.mobileHalfWidth) continue
    if (r < c.trunkRadius) continue
    // grass grows right up to the roots, thinning and shortening against them
    const rootCover = rootsAt(field, x, z)
    if (rootCover >= c.rootClearance || Math.random() < rootCover * 0.8) continue
    // clumps: some patches lush and tall, others thin and short
    const clump = vnoise(x / c.clumpScale, z / c.clumpScale) * 0.65 + vnoise(x / (c.clumpScale * 0.37), z / (c.clumpScale * 0.37)) * 0.35
    const lush = 1 - c.clumpStrength + c.clumpStrength * clump * 1.6
    if (Math.random() > lush) continue
    // blades get shorter toward the roots
    const nearTrunk = rootCover / c.rootClearance
    // camera side (+z) is denser
    const near = THREE.MathUtils.smoothstep(z, -c.ringRadius, c.frontReach * 0.7)
    if (Math.random() > THREE.MathUtils.lerp(c.farDensity, 1, near)) continue
    const y = field.height(x, z)
    if (Number.isNaN(y)) continue
    const dirt = field.dirtAt(x, z)
    if (dirt > 0.55 || Math.random() < dirt * 1.5) continue
    // thin out and shorten toward the edge of the ring
    const edge = inDisc && !inFront
      ? THREE.MathUtils.smoothstep(r, c.ringRadius * 0.85, c.ringRadius)
      : Math.max(THREE.MathUtils.smoothstep(Math.abs(x), c.frontHalfWidth * 0.8, c.frontHalfWidth), THREE.MathUtils.smoothstep(z, c.frontReach * 0.85, c.frontReach))
    if (Math.random() < edge * 0.6) continue
    roots.set([x, y - 0.02, z], i * 3)
    const h =
      c.bladeHeight *
      (1 - c.bladeHeightJitter / 2 + Math.random() * c.bladeHeightJitter) *
      (0.55 + 0.7 * clump) *
      (1 - dirt * 0.8) *
      (1 - edge * 0.4) *
      (1 - nearTrunk * 0.5)
    blades.set([h, 0.7 + Math.random() * 0.6, Math.random() * Math.PI * 2, Math.random()], i * 4)
    i++
  }
  return { roots: roots.subarray(0, i * 3), blades: blades.subarray(0, i * 4), count: i }
}

/** One tapered blade, 4 segments, x = -1..1 across, y = 0..1 up. */
function bladeGeometry() {
  const seg = 4
  const pos: number[] = []
  const idx: number[] = []
  for (let s = 0; s < seg; s++) {
    const t = s / seg
    const w = Math.pow(1 - t, 0.7)
    pos.push(-w, t, 0, w, t, 0)
  }
  pos.push(0, 1, 0)
  for (let s = 0; s < seg - 1; s++) {
    const a = s * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const top = (seg - 1) * 2
  idx.push(top, top + 1, seg * 2)
  const g = new THREE.InstancedBufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
  g.setIndex(idx)
  return g
}

const vertexHead = /* glsl */ `
#define TRAIL_MAX ${TRAIL_MAX}
attribute vec3 aRoot;
attribute vec4 aBlade; // height, width scale, angle, variation
uniform float uTime, uNow;
uniform float uWidth, uWindStrength, uWindSpeed, uGustScale, uGustSpeed;
uniform vec2 uWindDir;
uniform vec4 uTrail[TRAIL_MAX]; // x, z, birth, strength
uniform vec4 uTrailBox;         // minx, minz, maxx, maxz (already padded by the radius)
uniform float uCursorRadius, uCursorStrength, uTrailLife, uDamping, uFreq;
varying float vT;
varying float vVar;
${noiseGLSL}
`

const vertexBody = /* glsl */ `
{
  float t = position.y;
  float h = aBlade.x;
  vec2 side = vec2(cos(aBlade.z), sin(aBlade.z));
  vec2 root = aRoot.xz;

  // wind: slow gusts rolling across the meadow + a little per-blade flutter
  vec2 drift = uWindDir * uTime * uGustSpeed;
  float gust = fbm((root - drift) / uGustScale);
  gust = smoothstep(0.25, 0.85, gust);
  float flutter = sin(uTime * uWindSpeed * 5.0 + aBlade.w * 40.0) * 0.06;
  vec2 lean = uWindDir * uWindStrength * (0.3 + gust * 1.1) + vec2(-uWindDir.y, uWindDir.x) * flutter;

  // cursor trail: each point pushes blades away, then lets go with a damped spring
  if (uCursorStrength > 0.0 && root.x > uTrailBox.x && root.x < uTrailBox.z && root.y > uTrailBox.y && root.y < uTrailBox.w) {
    vec2 push = vec2(0.0);
    for (int i = 0; i < TRAIL_MAX; i++) {
      vec4 tp = uTrail[i];
      float age = uNow - tp.z;
      if (age < 0.0 || age > uTrailLife || tp.w <= 0.0) continue;
      vec2 d = root - tp.xy;
      float dist = length(d);
      if (dist > uCursorRadius) continue;
      float fall = 1.0 - smoothstep(uCursorRadius * 0.15, uCursorRadius, dist);
      float spring = exp(-uDamping * age) * cos(uFreq * age);
      push += (d / max(dist, 1e-3)) * fall * tp.w * spring;
    }
    float pl = length(push);
    if (pl > 1.4) push *= 1.4 / pl;
    lean += push * uCursorStrength;
  }

  // bend along an arc: tip moves with lean, height shortens to keep the length
  float L = min(length(lean), 1.25);
  vec2 dir = L > 1e-4 ? lean / length(lean) : vec2(0.0);
  float bend = t * t;
  float y = h * t * (1.0 - 0.45 * L * L * t);
  vec2 off = dir * h * L * bend * 0.95;

  vec2 across = side * position.x * uWidth * aBlade.y * (1.0 - 0.3 * L);
  transformed = vec3(root.x + across.x + off.x, aRoot.y + max(y, 0.0), root.y + across.y + off.y);
  vT = t;
  vVar = aBlade.w;
}
`

const fragmentHead = /* glsl */ `
uniform vec3 uBase, uTip;
uniform float uVariation;
uniform float uReveal;
varying float vT;
varying float vVar;
`

const fragmentColor = /* glsl */ `
{
  float v = (vVar - 0.5) * uVariation;
  vec3 tip = uTip * (1.0 + v * 0.6) + vec3(0.04, 0.03, -0.02) * v;
  diffuseColor.rgb *= mix(uBase * (1.0 + v * 0.5), tip, pow(vT, 0.85));
}
`

/** Instanced grass blades covering the meadow, wind + cursor parting on the GPU. */
export function Grass() {
  const field = useGroundField()
  const count = env.isMobile ? heroConfig.grass.countMobile : heroConfig.grass.countDesktop

  const { geometry, uniforms, material } = useMemo(() => {
    const geometry = bladeGeometry()
    geometry.instanceCount = 0

    const uniforms = {
      uTime: HU.uTime,
      uReveal: HU.uReveal,
      uNow: { value: 0 },
      uWidth: { value: 0 },
      uWindStrength: { value: 0 },
      uWindSpeed: { value: 0 },
      uGustScale: { value: 1 },
      uGustSpeed: { value: 0 },
      uWindDir: { value: new THREE.Vector2(1, -0.35).normalize() },
      uTrail: { value: trail.points },
      uTrailBox: { value: new THREE.Vector4() },
      uCursorRadius: { value: 1 },
      uCursorStrength: { value: 0 },
      uTrailLife: { value: 1 },
      uDamping: { value: 1 },
      uFreq: { value: 1 },
      uBase: { value: new THREE.Color() },
      uTip: { value: new THREE.Color() },
      uVariation: { value: 0 },
    }
    const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', `${vertexHead}\nvoid main() {`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexBody}`)
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', `${fragmentHead}\nvoid main() {`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${fragmentColor}`)
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb *= uReveal;')
    }
    material.customProgramCacheKey = () => 'hero-grass'
    return { geometry, uniforms, material }
  }, [field, count])

  // place blades once the tree is in the scene, so they can hug its roots
  useLayoutEffect(() => {
    if (treeParts.model && treeParts.frame?.parent) footprint = buildTreeFootprint(field, treeParts.model, treeParts.frame.parent)
    const placed = placeBlades(field, count)
    geometry.setAttribute('aRoot', new THREE.InstancedBufferAttribute(placed.roots, 3))
    geometry.setAttribute('aBlade', new THREE.InstancedBufferAttribute(placed.blades, 4))
    geometry.instanceCount = placed.count
  }, [field, count, geometry])

  useLayoutEffect(() => () => geometry.dispose(), [geometry])

  useFrame(() => {
    const c = heroConfig.grass
    const now = HU.uTime.value
    uniforms.uNow.value = now
    uniforms.uWidth.value = c.bladeWidth
    uniforms.uWindStrength.value = c.windStrength
    uniforms.uWindSpeed.value = c.windSpeed
    uniforms.uGustScale.value = c.gustScale
    uniforms.uGustSpeed.value = c.gustSpeed
    uniforms.uCursorRadius.value = c.cursorRadius
    uniforms.uCursorStrength.value = env.reducedMotion ? 0 : c.cursorStrength
    uniforms.uTrailLife.value = c.trailLife
    uniforms.uDamping.value = c.springDamping
    uniforms.uFreq.value = c.springFreq
    uniforms.uBase.value.set(c.baseColor)
    uniforms.uTip.value.set(c.tipColor)
    uniforms.uVariation.value = c.variation

    // trail: drop a point every `trailSpacing` s while the cursor moves over the ground
    if (pointer.onGround && !env.reducedMotion) {
      const moved = trail.last.distanceTo({ x: pointer.ground.x, y: pointer.ground.z } as THREE.Vector2)
      if (now - trail.lastPush >= c.trailSpacing && moved > 0.04) {
        const strength = THREE.MathUtils.clamp(pointer.groundSpeed / 5, 0.2, 1)
        trail.points[trail.head].set(pointer.ground.x, pointer.ground.z, now, strength)
        trail.head = (trail.head + 1) % TRAIL_MAX
        trail.lastPush = now
        trail.last.set(pointer.ground.x, pointer.ground.z)
      }
    }
    // bounding box of live points, padded by the radius (lets far blades skip the loop)
    const box = uniforms.uTrailBox.value.set(1e5, 1e5, -1e5, -1e5)
    for (const p of trail.points) {
      if (now - p.z > c.trailLife || p.w <= 0) continue
      box.set(Math.min(box.x, p.x), Math.min(box.y, p.y), Math.max(box.z, p.x), Math.max(box.w, p.y))
    }
    box.x -= c.cursorRadius
    box.y -= c.cursorRadius
    box.z += c.cursorRadius
    box.w += c.cursorRadius
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} receiveShadow />
}
