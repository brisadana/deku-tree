import * as THREE from 'three'
import { FACE, ROOMS, roomInward } from '../scene/layout'
import { BEATS, ROOM_STOPS } from './beats'

type Key = { p: number; pos: THREE.Vector3; target: THREE.Vector3; fov?: number; /** linear travel instead of easing in/out */ linear?: boolean }

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

function roomPose(i: number, dist = 6.2, height = 1.9) {
  const { pos } = ROOMS[i]
  const inward = roomInward(pos)
  return {
    pos: pos.clone().addScaledVector(inward, dist).add(v(0, height, 0)),
    target: pos.clone().add(v(0, 1.35, 0)),
  }
}

const face = FACE.faceCenter
const mouth = FACE.mouth

/**
 * Camera keyframes along the story. Between two keys the camera eases in/out
 * (smootherstep), so every key reads as a beat; identical consecutive keys are holds.
 */
export const CAMERA_KEYS: Key[] = [
  // 1 — Hero: low angle, canopy leaving the frame, slow drift in
  { p: BEATS.hero[0], pos: v(0, 1.4, 22), target: v(0, 4.8, 0), fov: 42 },
  { p: 0.12, pos: v(0.6, 1.6, 19.5), target: v(0, 5.0, 0), fov: 42 },
  // 2 — Face: slow push-in, then hold for the eye interaction
  { p: 0.205, pos: face.clone().add(v(0.0, 0.6, 8.2)), target: face.clone().add(v(0, 0.45, 0)), fov: 38 },
  { p: BEATS.face[1], pos: face.clone().add(v(0.4, 0.65, 7.4)), target: face.clone().add(v(0, 0.45, 0)), fov: 38 },
  // 3 — Curse: pull back to a three-quarter view so the corruption can climb
  { p: 0.33, pos: v(-7.5, 3.2, 15), target: v(0, 6.2, 0), fov: 44 },
  { p: BEATS.curse[1], pos: v(-5.2, 2.4, 13), target: v(0, 7.2, 0), fov: 44 },
  // 4 — Entrance: square up on the mouth, then dolly in until black
  { p: 0.445, pos: mouth.clone().add(v(0, 0.35, 7.5)), target: mouth.clone(), fov: 40 },
  { p: 0.505, pos: mouth.clone().add(v(0, 0, 0.9)), target: mouth.clone().add(v(0, 0, -4)), fov: 50, linear: true },
  // (cut under the black wipe)
  // 5 — Rooms: travel then hold at each pedestal
  ...ROOM_STOPS.flatMap((r, i) => {
    const pose = roomPose(i)
    const arrive =
      i === 0
        ? { pos: pose.pos.clone().add(v(0, 2.2, 0)).addScaledVector(roomInward(ROOMS[0].pos), 4), target: pose.target }
        : pose
    return [
      ...(i === 0 ? [{ p: r.start + 0.004, ...arrive, fov: 46 }] : []),
      { p: r.hold, ...pose, fov: 42 },
      { p: r.end - 0.004, pos: pose.pos.clone().add(v(0, 0.15, -0.0)).lerp(pose.target, 0.06), target: pose.target, fov: 42 },
    ]
  }),
  // 6 — Emerald: lower, looking up as it rises
  { p: 0.85, ...roomPose(3, 6.8, 0.8), fov: 40 },
  {
    p: BEATS.emerald[1] - 0.004,
    pos: roomPose(3, 6.0, 0.9).pos,
    target: ROOMS[3].pos.clone().add(v(0, 2.6, 0)),
    fov: 38,
  },
  // 7 — Exit: start at the mouth, fast pull back to a sunny wide shot
  { p: BEATS.exit[0], pos: mouth.clone().add(v(0, 0.1, 1.6)), target: mouth.clone(), fov: 55 },
  { p: 0.965, pos: v(0, 5.2, 33), target: v(0, 7.0, 0), fov: 44 },
  { p: 1, pos: v(0, 5.4, 34.5), target: v(0, 7.0, 0), fov: 44 },
]

const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

/** Samples the keyframes at progress p into the provided vectors. Returns fov. */
export function sampleCamera(p: number, outPos: THREE.Vector3, outTarget: THREE.Vector3) {
  const keys = CAMERA_KEYS
  if (p <= keys[0].p) {
    outPos.copy(keys[0].pos)
    outTarget.copy(keys[0].target)
    return keys[0].fov ?? 42
  }
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i]
    if (p <= b.p) {
      const a = keys[i - 1]
      const raw = (p - a.p) / Math.max(1e-6, b.p - a.p)
      const t = b.linear ? raw * raw : smootherstep(raw)
      outPos.lerpVectors(a.pos, b.pos, t)
      outTarget.lerpVectors(a.target, b.target, t)
      return THREE.MathUtils.lerp(a.fov ?? 42, b.fov ?? 42, t)
    }
  }
  const last = keys[keys.length - 1]
  outPos.copy(last.pos)
  outTarget.copy(last.target)
  return last.fov ?? 42
}

/** True when the camera is between two keys that live in different worlds (forest ↔ dungeon). */
export const CUTS = [0.515, BEATS.exit[0]]
