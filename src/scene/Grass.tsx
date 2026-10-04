import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { env } from '../lib/env'
import { state } from '../lib/state'
import { fieldGLSL, fieldUniforms } from './Ground'
import { U } from './uniforms'

const TRAIL = 8
const RADIUS = 2.8

type Props = {
  count?: number
  /** Rectangle in world XZ: [minX, maxX, minZ, maxZ]. */
  bounds?: [number, number, number, number]
  /** Keep blades out of this radius around the trunk. */
  clearRadius?: number
}

/**
 * Instanced, wind-animated grass. All displacement happens on the GPU.
 * The cursor is projected onto the ground and kept as a short trail of
 * impulses; each impulse pushes blades away and springs back as it ages.
 */
export function Grass({
  count = env.isMobile ? 32000 : 95000,
  bounds = env.isMobile ? [-14, 14, -8, 34] : [-30, 30, -14, 34],
  clearRadius = 3.1,
}: Props) {
  const { camera } = useThree()

  const geometry = useMemo(() => {
    const blade = new THREE.PlaneGeometry(1, 1, 1, 4)
    blade.translate(0, 0.5, 0)
    const g = new THREE.InstancedBufferGeometry()
    g.index = blade.index
    g.attributes.position = blade.attributes.position
    g.attributes.uv = blade.attributes.uv

    const offsets = new Float32Array(count * 3)
    const params = new Float32Array(count * 4)
    const [x0, x1, z0, z1] = bounds
    let i = 0
    while (i < count) {
      const x = x0 + Math.random() * (x1 - x0)
      const z = z0 + Math.random() * (z1 - z0)
      const r = Math.hypot(x, z - 0.5)
      if (r < clearRadius + Math.random() * 1.2) continue
      // thin out far behind the tree where it is never seen
      if (z < -4 && Math.random() < 0.6) continue
      // taper blade height toward the field edges so it melts into the ground
      const edge = Math.min(x - x0, x1 - x, z - z0)
      const fade = Math.min(1, edge / 6)
      offsets.set([x, 0, z], i * 3)
      params.set(
        [
          Math.random() * Math.PI * 2, // rotation
          (0.35 + Math.random() * 0.45 + (r > 9 ? 0.15 : 0)) * (0.25 + 0.75 * fade), // height
          0.06 + Math.random() * 0.05, // width
          Math.random(), // seed
        ],
        i * 4,
      )
      i++
    }
    g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3))
    g.setAttribute('aParams', new THREE.InstancedBufferAttribute(params, 4))
    g.instanceCount = count
    return g
  }, [count, bounds, clearRadius])

  const uniforms = useMemo(
    () => ({
      ...THREE.UniformsLib.fog,
      ...fieldUniforms,
      uTime: U.uTime,
      uSunDir: U.uSunDir,
      uTrail: { value: Array.from({ length: TRAIL }, () => new THREE.Vector3()) },
      uRadius: { value: RADIUS },
      uTip: { value: new THREE.Color('#7FB06E') },
      uSunTip: { value: new THREE.Color('#D9C873') },
    }),
    [],
  )

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        fog: true,
        uniforms,
        defines: { TRAIL },
        vertexShader: /* glsl */ `
          attribute vec3 aOffset;
          attribute vec4 aParams;
          uniform float uTime;
          uniform vec3 uTrail[TRAIL];
          uniform float uRadius;
          varying float vH;
          varying float vSeed;
          varying vec2 vXZ;
          #include <fog_pars_vertex>

          void main() {
            float h = uv.y;
            vec3 p = position;
            p.x *= (1.0 - h * 0.9) * aParams.z;
            p.y *= aParams.y;
            float c = cos(aParams.x), s = sin(aParams.x);
            p = vec3(c * p.x, p.y, s * p.x);

            vec2 xz = aOffset.xz;
            // wind: slow rolling gusts + flutter
            float gust = sin(uTime * 0.9 + xz.x * 0.18 + xz.y * 0.11) * 0.5 + 0.5;
            float flutter = sin(uTime * 3.1 + aParams.w * 30.0 + xz.x * 0.7) * 0.25;
            vec2 bend = normalize(vec2(1.0, 0.35)) * (0.12 + gust * 0.32 + flutter * 0.4);

            // cursor trail push
            vec2 push = vec2(0.0);
            for (int i = 0; i < TRAIL; i++) {
              vec2 d = xz - uTrail[i].xy;
              float dist = length(d);
              float f = (1.0 - smoothstep(0.0, uRadius, dist)) * uTrail[i].z;
              push += (d / max(dist, 0.001)) * f;
            }
            float pl = length(push);
            if (pl > 1.6) push *= 1.6 / pl;
            bend += push * 1.6;

            float k = h * h;
            vec3 world = aOffset + p;
            world.xz += bend * k * aParams.y;
            world.y -= min(dot(bend, bend), 2.0) * k * 0.3 * aParams.y;

            vH = h;
            vSeed = aParams.w;
            vXZ = xz;
            vec4 mvPosition = viewMatrix * vec4(world, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }
        `,
        fragmentShader: /* glsl */ `
          ${fieldGLSL}
          uniform vec3 uTip, uSunTip;
          varying float vH;
          varying float vSeed;
          varying vec2 vXZ;
          #include <fog_pars_fragment>
          void main() {
            vec3 base = fieldColor(vXZ) * 0.8;
            vec3 tip = mix(uTip, uSunTip, step(0.82, vSeed) * 0.7);
            tip *= mix(0.75, 1.05, fbm(vXZ * 0.2 + 3.0));
            // three painted bands instead of a smooth gradient
            float b = vH < 0.35 ? 0.0 : (vH < 0.72 ? 0.5 : 1.0);
            vec3 col = mix(base, tip, mix(vH * 0.6, b, 0.6));
            col *= mix(1.0, 0.55, smoothstep(9.0, 3.5, length(vXZ - vec2(0.0, 0.5))) * (1.0 - vH));
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
            #include <fog_fragment>
          }
        `,
      }),
    [uniforms],
  )

  // Cursor → ground plane, recorded as an aging trail of impulses.
  const trail = useRef(Array.from({ length: TRAIL }, () => ({ x: 0, z: 0, t: -99 })))
  const last = useRef({ x: 1e9, z: 1e9, i: 0 })
  const tools = useMemo(
    () => ({
      ray: new THREE.Raycaster(),
      plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      hit: new THREE.Vector3(),
      ndc: new THREE.Vector2(),
    }),
    [],
  )

  // Slot 0 is the live cursor (blades stay parted while it hovers);
  // slots 1..TRAIL-1 are past positions that spring back as they age.
  const live = useRef({ x: 0, z: 0, s: 0, onGround: false })

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const p = state.pointer
    const since = performance.now() - p.lastMove
    const L = live.current
    if (p.seen && !env.isTouch && since < 100) {
      tools.ndc.set(p.ndcX, p.ndcY)
      tools.ray.setFromCamera(tools.ndc, camera)
      L.onGround = !!tools.ray.ray.intersectPlane(tools.plane, tools.hit)
      if (L.onGround) {
        const l = last.current
        if (Math.hypot(tools.hit.x - l.x, tools.hit.z - l.z) > 0.35) {
          l.i = (l.i % (TRAIL - 1)) + 1
          trail.current[l.i] = { x: l.x, z: l.z, t }
          l.x = tools.hit.x
          l.z = tools.hit.z
        }
        const k = 1 - Math.exp(-dt * 18)
        L.x += (tools.hit.x - L.x) * k
        L.z += (tools.hit.z - L.z) * k
      }
    }
    const target = L.onGround && since < 1500 ? 1 : 0
    L.s += (target - L.s) * (1 - Math.exp(-dt * (target ? 10 : 2.5)))

    const arr = uniforms.uTrail.value
    arr[0].set(L.x, L.z, L.s * 0.9)
    for (let i = 1; i < TRAIL; i++) {
      const it = trail.current[i]
      const age = t - it.t
      // damped spring: still pushed, then a small overshoot back, then rest
      const s = age < 0 || age > 5 ? 0 : Math.exp(-age * 1.15) * Math.cos(age * 3.0)
      arr[i].set(it.x, it.z, s * 0.7)
    }
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} />
}
