import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { env } from '../lib/env'
import { treeParts } from './DekuTree'
import { eyeInput, eyeState, stepEyes } from './eyeMachine'
import { heroConfig } from './hero.config'
import { HU } from './uniforms'
import { inactiveFor, pointer } from './usePointer'

const SX = 28
const SY = 10

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragment = /* glsl */ `
uniform float uOpen, uGlow, uReveal, uAspect, uPupilShift, uPupilSize, uTime, uSide;
uniform vec2 uPupil;
uniform vec3 uCore, uAmber;
varying vec2 vUv;

void main() {
  vec2 p = vUv * 2.0 - 1.0;                       // -1..1 across and up
  // almond: lids open from the centre line outward
  float shape = pow(max(1.0 - p.x * p.x, 0.0), 0.8);
  float lid = shape * uOpen;
  float aa = fwidth(p.y) * 1.5 + 0.015;
  float mask = 1.0 - smoothstep(lid - aa, lid + aa * 0.5, abs(p.y));
  if (mask <= 0.001) discard;

  // iris: warm golden core falling off into dark amber, in round (aspect-corrected) units
  vec2 centre = vec2(uPupil.x * uPupilShift * 2.0, uPupil.y * 0.35);
  vec2 d2 = vec2((p.x - centre.x) * uAspect, p.y - centre.y);
  float d = length(d2);
  vec3 col = mix(uCore, uAmber, smoothstep(0.15, 1.9, d));
  // subtle pupil, a softer darker core that follows the cursor
  float pr = uPupilSize * uAspect;
  col *= mix(0.45, 1.0, smoothstep(pr * 0.35, pr, d));
  // carved feel: darker toward the lid edges
  float edge = clamp((lid - abs(p.y)) / max(lid, 1e-3), 0.0, 1.0);
  col *= 0.35 + 0.65 * smoothstep(0.0, 0.45, edge);
  // a very slow living shimmer
  float life = 1.0 + 0.05 * sin(uTime * 1.3 + uSide * 1.7);

  gl_FragColor = vec4(col * uGlow * life * uReveal, mask);
}
`

type EyeCfg = { position: [number, number, number]; tilt: number }

const ray = new THREE.Raycaster()

/**
 * Builds an eye grid in the tree frame and drapes it onto the bark: every vertex is
 * raycast along -Z onto the tree and lifted by `lift`, so the eye follows the carving.
 */
function conformedEye(e: EyeCfg, geometry: THREE.BufferGeometry) {
  const c = heroConfig.eyes
  const frame = treeParts.frame
  const model = treeParts.model
  const pos = geometry.attributes.position as THREE.BufferAttribute
  const tilt = THREE.MathUtils.degToRad(e.tilt)
  const cos = Math.cos(tilt)
  const sin = Math.sin(tilt)
  const [cx, cy, cz] = e.position
  const dir = new THREE.Vector3(0, 0, -1)
  const o = new THREE.Vector3()
  if (frame) {
    frame.updateMatrixWorld(true)
    dir.transformDirection(frame.matrixWorld)
  }
  const inv = frame ? frame.matrixWorld.clone().invert() : new THREE.Matrix4()
  let k = 0
  for (let j = 0; j <= SY; j++) {
    for (let i = 0; i <= SX; i++) {
      const lx = (i / SX - 0.5) * c.width
      const ly = (j / SY - 0.5) * c.height
      const x = cx + lx * cos - ly * sin
      const y = cy + lx * sin + ly * cos
      let z = cz
      if (frame && model) {
        o.set(x, y, cz + 2.5).applyMatrix4(frame.matrixWorld)
        ray.set(o, dir)
        ray.far = 6
        const hit = ray.intersectObject(model, true)[0]
        if (hit) z = hit.point.applyMatrix4(inv).z + c.lift
      }
      pos.setXYZ(k++, x, y, z)
    }
  }
  pos.needsUpdate = true
  geometry.computeBoundingSphere()
}

function eyeKey() {
  const c = heroConfig.eyes
  return JSON.stringify([c.left, c.right, c.width, c.height, c.lift])
}

/** Two almond eyes under the brows, driven by the eye state machine. */
export function Eyes() {
  const left = useRef<THREE.Mesh>(null)
  const right = useRef<THREE.Mesh>(null)
  const built = useRef({ key: '', at: -1 })

  const { geoms, uniforms, materials } = useMemo(() => {
    const geoms = [new THREE.PlaneGeometry(1, 1, SX, SY), new THREE.PlaneGeometry(1, 1, SX, SY)]
    const uniforms = {
      uOpen: { value: 0 },
      uGlow: { value: 0 },
      uReveal: HU.uReveal,
      uTime: HU.uTime,
      uAspect: { value: 1 },
      uPupilShift: { value: 0 },
      uPupilSize: { value: 0 },
      uPupil: { value: eyeState.pupil },
      uCore: { value: new THREE.Color() },
      uAmber: { value: new THREE.Color() },
    }
    const materials = [0, 1].map(
      (side) =>
        new THREE.ShaderMaterial({
          vertexShader: vertex,
          fragmentShader: fragment,
          uniforms: { ...uniforms, uSide: { value: side } },
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
          side: THREE.DoubleSide,
        }),
    )
    return { geoms, uniforms, materials }
  }, [])

  useEffect(
    () => () => {
      geoms.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
    },
    [geoms, materials],
  )

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const c = heroConfig.eyes

    // (re)drape the eyes when the tree is ready or the config changed (throttled for the GUI)
    const key = eyeKey()
    const now = HU.uTime.value
    if (treeParts.model && key !== built.current.key && now - built.current.at > 0.15) {
      conformedEye(c.left, geoms[0])
      conformedEye(c.right, geoms[1])
      built.current = { key, at: now }
    }

    eyeInput.inactiveFor = inactiveFor()
    eyeInput.ndc.copy(pointer.ndc)
    eyeInput.reducedMotion = env.reducedMotion
    // nothing wakes the tree before it has faded in
    if (HU.uReveal.value < 0.95) eyeInput.inactiveFor = Infinity
    stepEyes(dt)

    uniforms.uOpen.value = eyeState.lids
    uniforms.uGlow.value = eyeState.glow
    uniforms.uAspect.value = c.width / c.height
    uniforms.uPupilShift.value = c.pupilShift
    uniforms.uPupilSize.value = c.pupilSize
    uniforms.uCore.value.set(c.core)
    uniforms.uAmber.value.set(c.amber)
    const visible = eyeState.lids > 0.002
    if (left.current) left.current.visible = visible
    if (right.current) right.current.visible = visible
  })

  return (
    <>
      <mesh ref={left} geometry={geoms[0]} material={materials[0]} renderOrder={2} frustumCulled={false} />
      <mesh ref={right} geometry={geoms[1]} material={materials[1]} renderOrder={2} frustumCulled={false} />
    </>
  )
}
